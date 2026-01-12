import PresenceModel from "./presence.model";
import PresenceLogService from "./logs/presence-log.service";

type PresenceState = "IN" | "OUT";
type GateRole = "ENTRY" | "EXIT";

interface RuntimePresence {
    employeeId: string;
    state: PresenceState;
    lastSeenAt: number;
    lastGate: GateRole;
    entryCameraCode?: string | undefined;
    exitCameraCode?: string | undefined;
    activeTrackIds: Set<number>;
    exitTimerId?: NodeJS.Timeout | null;
}

export default class PresenceService {
    private employeeMap = new Map<string, RuntimePresence>();

    private readonly EXIT_TIMEOUT_ENTRY = 5 * 60 * 1000; // 5 min
    private readonly EXIT_TIMEOUT_EXIT = 45 * 1000;      // 45 sec

    constructor(private readonly presenceLogService: PresenceLogService) { }

    // STARTUP RECOVERY
    async recoverFromDBOnStartup() {
        const now = Date.now();

        const activePresences = await PresenceModel.find({ state: "IN" }).lean();

        for (const record of activePresences) {
            const presence: RuntimePresence = {
                employeeId: record.employeeId,
                state: "IN",
                lastSeenAt: record.lastSeenAt,            // ✅ FIX
                lastGate: record.lastGate,                // ✅ FIX
                entryCameraCode:
                    record.lastGate === "ENTRY"
                        ? record.lastCameraCode
                        : undefined,
                exitCameraCode:
                    record.lastGate === "EXIT"
                        ? record.lastCameraCode
                        : undefined,
                activeTrackIds: new Set(),
                exitTimerId: null,
            };

            this.employeeMap.set(record.employeeId, presence);

            const idleTime = now - presence.lastSeenAt;
            const timeout =
                presence.lastGate === "EXIT"
                    ? this.EXIT_TIMEOUT_EXIT
                    : this.EXIT_TIMEOUT_ENTRY;

            const timeoutLeft = timeout - idleTime;

            if (timeoutLeft <= 0) {
                await this.markOUT(presence, "SYSTEM_RECOVERY");
            } else {
                this.scheduleExit(presence, timeoutLeft);
            }
        }

        console.log(`[PRESENCE] Recovery completed: ${this.employeeMap.size} active users`);
    }

    // ENTRY
    async onPersonEntered(params: {
        employeeId: string;
        cameraCode: string;
        gateRole: GateRole;
        trackId: number;
        eventTs: number;
        confidence: number;
    }) {
        const { employeeId, cameraCode, gateRole, trackId, eventTs, confidence } = params;

        let presence = this.employeeMap.get(employeeId);
        if (!presence) {
            presence = {
                employeeId,
                state: "OUT",
                lastSeenAt: eventTs,
                lastGate: gateRole,
                activeTrackIds: new Set(),
            };
            this.employeeMap.set(employeeId, presence);
        }

        console.log("onPersonEntered", params);
        // heartbeat
        presence.lastSeenAt = eventTs;
        presence.lastGate = gateRole;
        presence.activeTrackIds.add(trackId);

        if (gateRole === "ENTRY") {
            presence.entryCameraCode = cameraCode;
        } else {
            presence.exitCameraCode = cameraCode;
        }

        // cancel pending exit
        if (presence.exitTimerId) {
            clearTimeout(presence.exitTimerId);
            presence.exitTimerId = null;
        }

        if (presence.state === "OUT" && gateRole === "ENTRY") {
            await this.markIN(presence, cameraCode, eventTs, confidence);
        }
    }

    // EXIT SIGNAL
    onPersonExit(params: { employeeId: string; trackId: number; eventTs: number; cameraCode: string; gateRole: string; confidence: number;}) {
        console.log("onPersonExit", params);
        const { employeeId, trackId, eventTs, cameraCode, confidence } = params;
        const presence = this.employeeMap.get(employeeId);
        if (!presence || presence.state === "OUT") {
            console.log("Returning due to user state is out or not present.")
            return;
        }

        presence.lastSeenAt = eventTs;
        presence.activeTrackIds.delete(trackId);

        if (presence.activeTrackIds.size > 0) return;

        const timeout = presence.lastGate === "EXIT" ? this.EXIT_TIMEOUT_EXIT : this.EXIT_TIMEOUT_ENTRY;

        this.scheduleExit(presence, timeout);
    }

    // ⏱ EXIT SCHEDULER
    private scheduleExit(presence: RuntimePresence, timeout: number) {
        if (presence.exitTimerId) {
            clearTimeout(presence.exitTimerId);
        }

        presence.exitTimerId = setTimeout(async () => {
            const idle = Date.now() - presence.lastSeenAt;
            if (idle >= timeout && presence.state === "IN") {
                await this.markOUT(presence, "AUTO_EXIT_TIMEOUT");
            }
        }, timeout);
    }

    // MARK IN
    private async markIN(
        presence: RuntimePresence,
        cameraCode: string,
        eventTs: number,
        confidence: number
    ) {
        const prevState = presence.state;
        presence.state = "IN";

        await PresenceModel.findOneAndUpdate(
            { employeeId: presence.employeeId },
            {
                employeeId: presence.employeeId,
                state: "IN",
                lastSeenAt: eventTs,
                lastChangedAt: eventTs,
                lastGate: "ENTRY",
                lastCameraCode: cameraCode,
            },
            { upsert: true }
        );

        await this.presenceLogService.insertLog({
            employeeId: presence.employeeId,
            eventType: "ENTRY_DETECTED",
            fromState: prevState,
            toState: "IN",
            cameraCode,
            occurredAt: eventTs,
            source: "face_recognition",
            confidence,
        });

        console.log(`[PRESENCE] ${presence.employeeId} → IN`);
    }

    // MARK OUT
    private async markOUT(
        presence: RuntimePresence,
        reason: "EXIT_DETECTED" | "AUTO_EXIT_TIMEOUT" | "SYSTEM_RECOVERY" = "AUTO_EXIT_TIMEOUT"
    ) {
        const prevState = presence.state;
        presence.state = "OUT";
        presence.activeTrackIds.clear();
        presence.exitTimerId = null;

        const cameraCode = presence.exitCameraCode ?? presence.entryCameraCode ?? "unknown";

        await PresenceModel.findOneAndUpdate(
            { employeeId: presence.employeeId, state: "IN" },
            {
                state: "OUT",
                lastChangedAt: Date.now(),
                lastGate: presence.lastGate,
                lastCameraCode: cameraCode,
            }
        );

        await this.presenceLogService.insertLog({
            employeeId: presence.employeeId,
            eventType: reason,
            fromState: prevState,
            toState: "OUT",
            cameraCode,
            occurredAt: Date.now(),
            source: reason === "EXIT_DETECTED" ? "face_recognition" : "system",
            note: reason === "AUTO_EXIT_TIMEOUT" ? "No boundary activity within timeout" : undefined,
        });

        console.log(`[PRESENCE] ${presence.employeeId} → OUT (${reason})`);
    }


}
