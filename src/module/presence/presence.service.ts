import PresenceModel from "./presence.model";
import PresenceLogService from "./logs/presence-log.service";
import { PresenceState, GateRole, RuntimePresence, PresenceDTO } from "./presence.types";
import { attendanceService } from "../attendance";
import { envConfig } from "../../config";
import { miliSecondsToISoDate } from "../../utils";
import { unknownService } from "../unknown/unknown.module";
import { CreateUnknownPersonEventDTO } from "../unknown/unknown.types";
import presenceQueue from "./presence.queue";
import { DateTime } from "luxon";

export default class PresenceService {

    private midnightReconcilerTimer: NodeJS.Timeout | null = null;

    constructor(private readonly logService: PresenceLogService) { }
    
    async recoverFromDBOnStartup() {
        await this.closeStaleOpenSessionsFromPreviousDays();

        const now = Date.now();
        const pendingExits = await PresenceModel.find({
            state: "IN",
            pendingExitAt: { $ne: null },
        }).lean();

        for (const presence of pendingExits as any[]) {
            const employeeId = String(presence.employeeId);
            const exitTs = Number(presence.pendingExitAt);
            const delay = Math.max(0, exitTs - now);

            await presenceQueue.add(
                "confirm-exit",
                { employeeId, exitTs },
                {
                    delay,
                    jobId: `exit-${employeeId}-${exitTs}`,
                    removeOnComplete: true,
                    removeOnFail: true,
                }
            );
        }
    }

    private async closeStaleOpenSessionsFromPreviousDays() {
        const boundary = DateTime.now().setZone("Asia/Kolkata").startOf("day");
        const today = boundary.toFormat("yyyy-MM-dd");
        const exitTs = boundary.toMillis();

        const staleOpenPresences = await PresenceModel.find({
            state: "IN",
            date: { $lt: today },
        }).lean();

        for (const presence of staleOpenPresences as any[]) {
            const employeeId = String(presence.employeeId);
            const cameraCode = String(presence.lastCameraCode ?? "SYSTEM");
            const confidence = typeof presence.confidence === "number" ? presence.confidence : 0;

            await PresenceModel.updateOne(
                { employeeId },
                {
                    $set: {
                        state: "OUT",
                        pendingExitAt: null,
                        lastSeenAt: exitTs,
                        lastChangedAt: exitTs,
                        date: today,
                        lastGate: "EXIT",
                        lastCameraCode: cameraCode,
                        confidence,
                    },
                }
            );

            await this.logService.insertLog({
                employeeId,
                eventType: "SYSTEM_RECOVERY",
                fromState: "IN",
                toState: "OUT",
                cameraCode,
                occurredAt: exitTs,
                date: today,
                source: "system",
                confidence,
                note: "Auto closed on startup after midnight",
            });

            await attendanceService.endSession({
                employeeId,
                exitAt: exitTs,
                exitSource: "SYSTEM_RECOVERY",
                exitCameraCode: cameraCode,
                exitConfidence: confidence,
            });
        }
    }

    async onPersonEntered(params: { employeeId: string; cameraCode: string; gateRole: GateRole; eventTs: number; confidence: number; }) {
        const { employeeId, cameraCode, eventTs, confidence } = params;

        let presence = await PresenceModel.findOne({ employeeId });

        // 🟢 CASE 1: OUT → IN (idempotent safe)
        if (!presence || presence.state === "OUT") {

            const updated = await PresenceModel.findOneAndUpdate(
                { employeeId }, // 🔥 guard
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
                { upsert: true, new: true }
            );

            if (updated) {
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
                });

                await attendanceService.openSession({
                    employeeId,
                    entryAt: eventTs,
                    entrySource: "ENTRY_CAMERA",
                    entryConfidence: confidence,
                    entryCameraCode: cameraCode,
                });

                console.log("[IN]", employeeId);
            }

            return;
        }

        // 🟡 CASE 2: cancel exit
        if (presence.pendingExitAt) {
            await PresenceModel.updateOne(
                { employeeId },
                {
                    $set: {
                        lastSeenAt: eventTs,
                        lastChangedAt: eventTs,
                        pendingExitAt: null,
                        lastGate: "ENTRY",
                        lastCameraCode: cameraCode,
                        confidence,
                    },
                }
            );

            // update attendance open session lastSeenAt
            await attendanceService.updateSessionLastSeen(employeeId, miliSecondsToISoDate(eventTs), eventTs);
            
            console.log("[CANCEL EXIT]", employeeId);
            return;
        }

        // 🔵 CASE 3: heartbeat
        await PresenceModel.updateOne(
            { employeeId },
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

        // update attendance open session lastSeenAt for ongoing sessions
        await attendanceService.updateSessionLastSeen(employeeId, miliSecondsToISoDate(eventTs), eventTs);
       
    }


    async onPersonExited(params: { employeeId: string; cameraCode: string; gateRole: GateRole; eventTs: number; confidence: number; }) {
        const { employeeId, cameraCode, gateRole, eventTs, confidence } = params;

        const presence = await PresenceModel.findOne({ employeeId });

        if (!presence || presence.state === "OUT") return;

        await PresenceModel.updateOne(
            { employeeId },
            {
                $set: {
                    pendingExitAt: eventTs,
                    lastSeenAt: eventTs,
                    lastChangedAt: eventTs,
                    lastGate: "EXIT",
                    lastCameraCode: cameraCode,
                    confidence,
                },
            }
        );

        await presenceQueue.add(
            "confirm-exit",
            { employeeId, exitTs: eventTs },
            {
                delay: envConfig.exitTimeoutAfterExitGate,
                jobId: `exit-${employeeId}-${eventTs}`,
                removeOnComplete: true,
                removeOnFail: true,
            }
        );

        console.log("[EXIT PENDING]", employeeId);
    }

    async onUnknownEntered(params: CreateUnknownPersonEventDTO) {
        await unknownService.createUnknownPersonEvent(params);
    }
}
