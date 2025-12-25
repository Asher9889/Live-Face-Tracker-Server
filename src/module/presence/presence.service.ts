import mongoose from "mongoose";
import EmployeePresence from "./presence.model";
import { redis } from "../../db";

type PresenceState = "IN" | "OUT";
type GateRole = "ENTRY" | "EXIT";

interface EmployeePresence {
    employeeId: string;
    state: PresenceState;
    lastSeenAt: number;
    lastGate: GateRole;
    cameraCode: string;
    activeTrackIds: Set<number>;
    exitTimerId?: NodeJS.Timeout | null;
};

interface ICamera {
    code: string;
    gateType: GateRole;
}


export default class PresenceService {
    private employeeMap = new Map<string, EmployeePresence>();
    private cameraMap = new Map<string, ICamera>();


    constructor() { 
        
    }

    private EXIT_TIMEOUT_MS = 2 * 60 * 1000;

    // state transition | Must be private | mutate state.
    private async markIN(presence: EmployeePresence) {
        presence.state = "IN";

        const empIdStr = presence.employeeId;

        // if (mongoose.Types.ObjectId.isValid(empIdStr)) {
        //     const empObjectId = new mongoose.Types.ObjectId(empIdStr);

            await EmployeePresence.findOneAndUpdate(
                { employeeId: empIdStr },
                {
                    employeeId: empIdStr,
                    cameraCode: presence.cameraCode,
                    state: "IN",
                    lastChangedAt: Date.now(),
                },
                { upsert: true }
            );
        // } else {
        //     console.error(`[ERROR] Invalid ObjectId received: ${empIdStr}`);
        // }
        console.log(`[PRESENCE] EMP ${presence.employeeId} → IN (${presence.cameraCode})`);
    }

    private async markOUT(presence: EmployeePresence) {
        presence.state = "OUT";
        presence.activeTrackIds.clear();
        presence.exitTimerId = null;

        await EmployeePresence.findOneAndUpdate(
            { employeeId: presence.employeeId },
            {
                state: "OUT",
                lastChangedAt: Date.now(),
            }
        );
        console.log(`[PRESENCE] EMP ${presence.employeeId} → OUT (${presence.cameraCode})`);
    }

    // Event handlers (public) called by AI events
    async onPersonEntered(params: { employeeId: string, cameraCode: string, gateRole: GateRole, trackId: number, eventTs: number; }) {
        const { employeeId, trackId, cameraCode, gateRole, eventTs } = params;
        let presence = this.employeeMap.get(employeeId);
        if (!presence) {
            presence = {
                employeeId,
                state: "OUT",
                lastSeenAt: eventTs,
                lastGate: gateRole,
                cameraCode,
                activeTrackIds: new Set(),
                exitTimerId: null,
            };
            this.employeeMap.set(employeeId, presence);
        }

        // Track bookkeeping
        presence.activeTrackIds.add(trackId);
        presence.lastSeenAt = eventTs;
        presence.lastGate = gateRole;
        presence.cameraCode = cameraCode;

        // Cancel pending exit
        if (presence.exitTimerId) {
            clearTimeout(presence.exitTimerId);
            presence.exitTimerId = null;
        }

        if (presence.state === "OUT" && gateRole === "ENTRY") {
            await this.markIN(presence);
        }

        // if (presence.state === "IN" && gateRole === "EXIT") {
        //     this.startExitTimer(presence);
        // }

    }


    async onPersonUpdate(params: { employeeId: string; trackId: number; eventTs: number; }) {
        const { employeeId, trackId, eventTs } = params;
        const presence = this.employeeMap.get(employeeId);
        if (!presence) return;

        presence.lastSeenAt = eventTs;
        presence.activeTrackIds.add(trackId);
        // Cancel exit if person reappeared
        if (presence.exitTimerId) {
            clearTimeout(presence.exitTimerId);
            presence.exitTimerId = null;
        }
    }


    async onTrackLost(params: { employeeId: string; trackId: number; }) {
        const { employeeId, trackId } = params;
        const presence = this.employeeMap.get(employeeId);
        if (!presence) return;
        presence.activeTrackIds.delete(trackId);
        if (presence.activeTrackIds.size === 0) {
            this.startExitTimer(presence);
        }
    }

//     /**
//   * Exit debounce logic
//   */
    private startExitTimer(presence: EmployeePresence) {
        if (presence.exitTimerId) return;

        presence.exitTimerId = setTimeout(async () => {
            const now = Date.now();
            const idle = now - presence.lastSeenAt;

            if (idle >= this.EXIT_TIMEOUT_MS && presence.state === "IN") {
                await this.markOUT(presence);
            }
        }, this.EXIT_TIMEOUT_MS);
    }

}