import PresenceModel from "./presence.model";
import PresenceLogService from "./logs/presence-log.service";
import { PresenceState, GateRole, RuntimePresence, PresenceDTO } from "./presence.types";
import { attendanceService } from "../attendance";
import { envConfig } from "../../config";
import { miliSecondsToISoDate } from "../../utils";
import { unknownService } from "../unknown/unknown.module";
import { CreateUnknownPersonEventDTO } from "../unknown/unknown.types";
import presenceQueue from "./presence.queue";

export default class PresenceService {
   
    constructor(private readonly logService: PresenceLogService) { }

    async recoverFromDBOnStartup() {
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

    async onPersonEntered(params: { employeeId: string; cameraCode: string; gateRole: GateRole; eventTs: number; confidence: number; }) {
        const { employeeId, cameraCode, eventTs, confidence } = params;

        const presence = await PresenceModel.findOne({ employeeId });

        // 🟢 CASE 1: OUT → IN (idempotent safe)
        if (!presence || presence.state === "OUT") {

            const updated = await PresenceModel.findOneAndUpdate(
                { employeeId, state: "OUT" }, // 🔥 guard
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
