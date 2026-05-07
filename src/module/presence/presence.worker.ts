import { Worker } from "bullmq";
import IORedis from "ioredis";
import PresenceModel from "./presence.model";
import { attendanceService } from "../attendance";
import { envConfig } from "../../config";
import { redisConfig } from "../../db/connectRedis";

const connection = new IORedis(redisConfig);

const EXIT_PENDING_STATES = new Set(["EXIT_PENDING", "PENDING_EXIT"]);

function isExitPendingState(state?: string | null) {
    return !!state && EXIT_PENDING_STATES.has(state);
}

const presenceWorker = new Worker("presence", async (job) => {
    if (job.name !== "confirm-exit") return;

    const { employeeId, exitTs } = job.data;

    const presence = await PresenceModel.findOne({ employeeId }).lean();

    if (!presence) {
        console.log("[CONFIRM EXIT] No presence record found for employee", employeeId);
        return;
    };

    const pendingExitAt = Number(presence.pendingExitAt ?? 0);
    const toleranceMs = Math.min(5000, Math.max(1000, Math.floor(Number(envConfig.exitTimeoutAfterExitGate ?? 0) / 10) || 1000));
    const isPendingExit = isExitPendingState(presence.state) && pendingExitAt > 0;
    const isValidPendingExit = isPendingExit && Math.abs(pendingExitAt - Number(exitTs)) <= toleranceMs;

    console.log(
        `[PRESENCE WORKER] confirm-exit employee=${employeeId} exitTs=${exitTs} state=${presence.state} pendingExitAt=${pendingExitAt} diff=${Math.abs(pendingExitAt - Number(exitTs))} tol=${toleranceMs}`
    );

    if (!isValidPendingExit) {
        console.log("[IGNORED EXIT]", employeeId);
        return;
    }

    await attendanceService.endSession({
        employeeId,
        exitAt: exitTs,
        exitSource: "EXIT_CAMERA",
        exitCameraCode: presence.lastCameraCode,
        exitConfidence: presence.confidence,
    });

    await PresenceModel.updateOne(
        { employeeId, state: { $in: ["EXIT_PENDING", "PENDING_EXIT"] } },
        {
            $set: {
                state: "OUT",
                lastSeenAt: exitTs,
                lastChangedAt: exitTs,
                lastGate: "EXIT",
                lastCameraCode: presence.lastCameraCode,
                confidence: presence.confidence,
                pendingExitAt: null,
            },
        }
    );

    console.log("[OUT]", employeeId);
},
    { connection }
);

export default presenceWorker;