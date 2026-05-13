import PresenceModel from "./presence.model";
import PresenceLogService from "./logs/presence-log.service";
import { PresenceState, GateRole, RuntimePresence, PresenceDTO } from "./presence.types";
import { attendanceService } from "../attendance";
import { envConfig } from "../../config";
import { logger, miliSecondsToISoDate } from "../../utils";
import { unknownService } from "../unknown/unknown.module";
import { CreateUnknownPersonEventDTO } from "../unknown/unknown.types";
import presenceQueue from "./presence.queue";
import mongoose from "mongoose";
import { presenceLogService } from "./presence.module";



export default class PresenceService {

    constructor(private readonly logService: PresenceLogService) { }

    private isExitPendingState(state?: string | null) {
        return state === "EXIT_PENDING" || state === "PENDING_EXIT";
    }


    async onPersonEntered(params: { employeeId: string; cameraCode: string; gateRole: GateRole; eventTs: number; confidence: number; }) {
        try {
            const { employeeId, cameraCode, eventTs, confidence } = params;

            let presence = await PresenceModel.findOne({ employeeId });

            // CASE 1: OUT → IN (or new record)
            {
                const session = await mongoose.startSession();
                try {
                    session.startTransaction();
                    if (!presence || presence.state === "OUT") {

                        const updatedPresence = await PresenceModel.findOneAndUpdate(
                            { employeeId, state: { $ne: "IN" } },
                            {
                                $set: {
                                    state: "IN",
                                    lastSeenAt: eventTs,
                                    lastChangedAt: eventTs,
                                    date: miliSecondsToISoDate(eventTs),
                                    lastGate: "ENTRY",
                                    pendingExitAt: null,
                                    lastCameraCode: cameraCode,
                                    confidence,
                                },
                            },
                            { upsert: true, new: true, session: session }
                        );

                        if (!updatedPresence) {
                            console.warn("Failed to update presence for employee", employeeId);
                            await session.abortTransaction();
                            return;
                        }

                        await attendanceService.openSession({
                            employeeId,
                            entryAt: eventTs,
                            entrySource: "ENTRY_CAMERA",
                            entryConfidence: confidence,
                            entryCameraCode: cameraCode,
                        }, session);

                        await this.logService.insertLog({
                            employeeId,
                            eventType: "ENTRY_DETECTED",
                            fromState: "OUT",
                            toState: "IN",
                            cameraCode,
                            occurredAt: eventTs,
                            date: miliSecondsToISoDate(eventTs),
                            source: "face_recognition",
                            confidence,
                        }, session);
                        console.log("[IN]", employeeId);
                        await session.commitTransaction();

                        console.log({ employeeId, action: "ENTRY_CONFIRMED", cameraCode, confidence });

                        return; 
                    }
                } catch (error) {
                    console.error("Error processing entry event for employee", employeeId, error);
                    await session.abortTransaction();
                    throw error;
                } finally {
                    await session.endSession();
                }
            }


            // CASE 2: cancel exit

            {
                const session = await mongoose.startSession();
                try {
                    session.startTransaction();

                    if (this.isExitPendingState(presence?.state)) {
                        await PresenceModel.findOneAndUpdate(
                            { employeeId, state: { $in: ["EXIT_PENDING", "PENDING_EXIT"] } },
                            {
                                $set: {
                                    lastSeenAt: eventTs,
                                    lastChangedAt: eventTs,
                                    state: "IN",
                                    pendingExitAt: null,
                                    lastGate: "ENTRY",
                                    lastCameraCode: cameraCode,
                                    confidence,
                                },
                            }, { session: session }
                        );

                        attendanceService.updateSessionLastSeen(employeeId, miliSecondsToISoDate(eventTs), eventTs, session);

                        await this.logService.insertLog({
                            employeeId,
                            eventType: "EXIT_CANCELLED",
                            fromState: "EXIT_PENDING",
                            toState: "IN",
                            cameraCode,
                            occurredAt: eventTs,
                            date: miliSecondsToISoDate(eventTs),
                            source: "face_recognition",
                            confidence,
                        }, session);

                        // update attendance open session lastSeenAt
                        // await attendanceService.updateSessionLastSeen(employeeId, miliSecondsToISoDate(eventTs), eventTs);

                        console.log("[CANCEL EXIT]", employeeId);
                        await session.commitTransaction();
                        return;
                    }

                } catch (error) {
                    await session.abortTransaction();
                    console.info({ employeeId, action: "EXIT_CANCELLED", cameraCode, confidence, error });
                    throw error;
                } finally {
                    await session.endSession();
                }
            }

            // CASE 3: heartbeat + log
            try {
                await PresenceModel.findOneAndUpdate(
                    { employeeId, state: "IN" },
                    {
                        $set: {
                            lastSeenAt: eventTs,
                            lastChangedAt: eventTs,
                            lastGate: "ENTRY",
                            lastCameraCode: cameraCode,
                            confidence,
                        },
                    }
                );

                await attendanceService.updateSessionLastSeen(employeeId, miliSecondsToISoDate(eventTs), eventTs);

                await this.logService.insertLog({
                    employeeId,
                    eventType: "FACE_DETECTED",
                    fromState: "IN",
                    toState: "IN",
                    cameraCode,
                    occurredAt: eventTs,
                    date: miliSecondsToISoDate(eventTs),
                    source: "face_recognition",
                    confidence,
                });


            } catch (error) {
                throw error;
            }
        } catch (error) {
            throw error;
        }
    }


    async onPersonExited(params: { employeeId: string; cameraCode: string; gateRole: GateRole; eventTs: number; confidence: number; }) {
        try {
            const { employeeId, cameraCode, gateRole, eventTs, confidence } = params;
    
            const presence = await PresenceModel.findOne({ employeeId });
    
            if (!presence || presence.state === "OUT") {
                console.log("[EXIT IGNORED] due to already out", employeeId);
                return
            };
    
            if (this.isExitPendingState(presence.state)) {
                console.log("[EXIT DUPLICATE IGNORED]", employeeId);
                return;
            }
    
            await PresenceModel.updateOne(
                { employeeId },
                {
                    $set: {
                        state: "EXIT_PENDING",
                        pendingExitAt: eventTs,
                        lastSeenAt: eventTs,
                        lastChangedAt: eventTs,
                        lastGate: "EXIT",
                        lastCameraCode: cameraCode,
                        confidence,
                    },
                }
            );
    
            await presenceLogService.insertLog({
                employeeId,
                eventType: "EXIT_DETECTED",
                fromState: presence.state as PresenceState,
                toState: "EXIT_PENDING",
                cameraCode,
                occurredAt: eventTs, // add 1 second to ensure this log is after the entry log in case of quick exit
                date: miliSecondsToISoDate(eventTs),
                source: "face_recognition",
                confidence,
            });
    
            await presenceQueue.add("confirm-exit", { employeeId, exitTs: eventTs },
                {
                    delay: envConfig.exitTimeoutAfterExitGate,
                    jobId: `exit-${employeeId}-${eventTs}`,
                    removeOnComplete: true,
                    removeOnFail: false,
                }
            );
            
    
            console.log("[EXIT PENDING]", employeeId);
        } catch (error) {
            logger.error(`Error occurred while processing exit event for person ${params.employeeId}: ${error}`);
        }
    }

    async onUnknownEntered(params: CreateUnknownPersonEventDTO) {
        await unknownService.createUnknownPersonEvent(params);
    }
}
