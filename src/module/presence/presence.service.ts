import PresenceModel from "./presence.model";
import PresenceLogService from "./logs/presence-log.service";
import { PresenceState, GateRole, RuntimePresence, PresenceDTO } from "./presence.types";
import { attendanceService } from "../attendance";
import { ExitType, PresenceLogType } from "../../domain/types";
import { envConfig } from "../../config";
import { DateTime } from "luxon";
import { miliSecondsToISoDate } from "../../utils";

export default class PresenceService {
    private presenceMap = new Map<string, RuntimePresence>();

    private readonly EXIT_TIMEOUT_AFTER_EXIT_GATE = envConfig.exitTimeoutAfterExitGate ?? (45 * 60 * 1000); // 45 sec
    private readonly EXIT_TIMEOUT_AFTER_ENTRY_GATE = envConfig.exitTimeoutAfterEntryGate ?? (3 * 60 * 60 * 1000); // 3 hours

    constructor(private readonly logService: PresenceLogService) { }

    async recoverFromDBOnStartup() {
        const now = Date.now();
        const activeUsers = await PresenceModel.find({ state: "IN" }).lean();

        for (const record of activeUsers) {
            const presence: RuntimePresence = {
                employeeId: record.employeeId,
                state: record.state, // "IN" or "OUT"
                lastSeenAt: record.lastSeenAt,
                lastGate: record.lastGate,
                entryCameraCode: record.lastGate === "ENTRY" ? record.lastCameraCode : undefined,
                exitCameraCode: record.lastGate === "EXIT" ? record.lastCameraCode : undefined,
                exitTimerId: null,
            };
            this.presenceMap.set(record.employeeId, presence);
            const timeout = presence.lastGate === "EXIT" ? this.EXIT_TIMEOUT_AFTER_EXIT_GATE : this.EXIT_TIMEOUT_AFTER_ENTRY_GATE;
            const remaining = timeout - (now - presence.lastSeenAt);

            if (remaining <= 0) {
                await this.markOUT(presence, "SYSTEM_RECOVERY", "system", 0);
            } else {
                this.scheduleExit(presence, remaining, "system", 0);
            }
        }

        console.log(`[PRESENCE] Recovery done. Active users: ${this.presenceMap.size}`);
    }

    async onPersonEntered(params: { employeeId: string; cameraCode: string; gateRole: GateRole; eventTs: number; confidence: number; }) {
        const { employeeId, cameraCode, gateRole, eventTs, confidence } = params;

        let presence = this.presenceMap.get(employeeId);

        if (!presence) {
            presence = {
                employeeId,
                state: "OUT",
                lastSeenAt: eventTs,
                lastGate: gateRole,
            };
            this.presenceMap.set(employeeId, presence);
        }

        // heartbeat
        presence.lastSeenAt = eventTs;
        presence.lastGate = gateRole;

        if (gateRole === "ENTRY") {
            presence.entryCameraCode = cameraCode;
        } else {
            presence.exitCameraCode = cameraCode;
        }

        // cancel pending exit
        if (presence.exitTimerId) {
            clearTimeout(presence.exitTimerId);
            presence.exitTimerId = null;
            console.log("[UPDATE] Cancelled pending exit timer for user ", presence.employeeId);

        }

        // ENTRY → start session
        if (presence.state === "OUT" && gateRole === "ENTRY") {
            await this.markIN(presence, cameraCode, eventTs, confidence);
        } else {
            await this.updateMarkIN(presence, cameraCode, eventTs, confidence)
        }
    }

    onPersonExit(params: { employeeId: string; cameraCode: string; eventTs: number; confidence: number; }) {
        const { employeeId, cameraCode, eventTs, confidence } = params;

        const presence = this.presenceMap.get(employeeId);
        if (!presence || presence.state === "OUT") return;

        presence.lastSeenAt = eventTs;
        presence.lastGate = "EXIT";
        presence.exitCameraCode = cameraCode;
        const timeout = this.EXIT_TIMEOUT_AFTER_EXIT_GATE;

        this.scheduleExit(presence, timeout, "face_recognition", confidence);
    }

    getAllPresence() {
        const allPresence = Array.from(this.presenceMap.values()).map(p => ({
            employeeId: p.employeeId,
            state: p.state,
            lastSeenAt: p.lastSeenAt,
            lastGate: p.lastGate,
            entryCameraCode: p.entryCameraCode,
            exitCameraCode: p.exitCameraCode,
        }));
        return allPresence;
    }

    private scheduleExit(presence: RuntimePresence, timeout: number, source: "system" | "face_recognition" | "manual", confidence: number) {
        if (presence.exitTimerId) {
            clearTimeout(presence.exitTimerId);
        }

        presence.exitTimerId = setTimeout(async () => {
            const idle = Date.now() - presence.lastSeenAt;
            if (presence.state === "IN" && presence.lastGate === "EXIT" && idle >= timeout) {
                await this.markOUT(presence, "EXIT_DETECTED", source, confidence);
            }
        }, timeout);
    }

    private async markIN(presence: RuntimePresence, cameraCode: string, eventTs: number, confidence: number) {
        presence.state = "IN";

        await PresenceModel.findOneAndUpdate(
            { employeeId: presence.employeeId },
            {
                $set: {
                    state: "IN",
                    lastSeenAt: eventTs,
                    lastChangedAt: eventTs,
                    date: miliSecondsToISoDate(eventTs),
                    lastGate: "ENTRY",
                    lastCameraCode: cameraCode,
                    confidence: confidence
                },
                $setOnInsert: {
                    employeeId: presence.employeeId,
                },
            },
            { upsert: true }
        ).lean();

        await this.logService.insertLog({
            employeeId: presence.employeeId,
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
            employeeId: presence.employeeId,
            entryAt: eventTs,
            entrySource: "ENTRY_CAMERA",
            entryCameraCode: cameraCode,
            entryConfidence: confidence
        });

        console.log(`[PRESENCE] ${presence.employeeId} → IN`);
    }

    private async updateMarkIN(presence: RuntimePresence, cameraCode: string, eventTs: number, confidence: number) {
        presence.state = "IN";
        presence.lastSeenAt = eventTs;
        console.log("[UPDATE] Updating presence of user ", presence.employeeId);
        if (presence.exitTimerId) {
            clearTimeout(presence.exitTimerId);
            presence.exitTimerId = null;
        }
        const timeout = presence.lastGate === "EXIT" ? this.EXIT_TIMEOUT_AFTER_EXIT_GATE : this.EXIT_TIMEOUT_AFTER_ENTRY_GATE;
        const remaining = timeout - (Date.now() - presence.lastSeenAt);
        this.scheduleExit(presence, remaining, "system", 0);
        await PresenceModel.findOneAndUpdate(
            { employeeId: presence.employeeId },
            {
                $set: {
                    state: "IN",
                    lastSeenAt: eventTs,
                    lastGate: "ENTRY",
                    lastCameraCode: cameraCode,
                    confidence: confidence
                },
            }
        ).lean();

        await this.logService.insertLog({
            employeeId: presence.employeeId,
            eventType: "FACE_DETECTED",
            fromState: "IN",
            toState: "IN",
            cameraCode,
            occurredAt: eventTs,
            date: miliSecondsToISoDate(eventTs),
            source: "face_recognition",
            confidence,
        });
    }

    private async markOUT(presence: RuntimePresence, reason: ExitType, source: "system" | "face_recognition" | "manual" = "system", confidence: number) {
        presence.state = "OUT"; // 
        presence.exitTimerId = null;
        const exitTs = presence.lastSeenAt;

        const cameraCode = presence.exitCameraCode ?? presence.entryCameraCode ?? "unknown";

        await PresenceModel.findOneAndUpdate(
            { employeeId: presence.employeeId, state: "IN" },
            {
                $set: {
                    state: "OUT",
                    lastChangedAt: exitTs,
                    date: miliSecondsToISoDate(exitTs),
                    lastGate: "EXIT",
                    lastCameraCode: cameraCode,
                    confidence: confidence
                },
            }
        );

        await this.logService.insertLog({
            employeeId: presence.employeeId,
            eventType: reason as PresenceLogType,
            fromState: "IN",
            toState: "OUT",
            cameraCode,
            occurredAt: exitTs,
            date: miliSecondsToISoDate(exitTs),
            source: source ?? "system",
        });

        await attendanceService.endSession({
            employeeId: presence.employeeId,
            exitAt: exitTs,
            exitSource: reason,
            exitConfidence: confidence,
            exitCameraCode: cameraCode,
        });

        console.log(`[PRESENCE] ${presence.employeeId} → OUT (${reason})`);
    }
}
