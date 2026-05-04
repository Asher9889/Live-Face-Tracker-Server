// presence.worker.ts
import { Worker } from "bullmq";
import IORedis from "ioredis";
import PresenceModel from "./presence.model";
import { attendanceService } from "../attendance";
import { presenceQueueConnection } from "./presence.queue";

const connection = new IORedis(presenceQueueConnection);

const presenceWorker = new Worker("presence", async (job) => {
    if (job.name !== "confirm-exit") return;

    const { employeeId, exitTs } = job.data;

    const presence = await PresenceModel.findOne({ employeeId });

    if (!presence) return;

    // 🔥 CRITICAL VALIDATION
    if (
        presence.state === "IN" &&
        presence.pendingExitAt === exitTs
    ) {
        await PresenceModel.updateOne(
            { employeeId },
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

        await attendanceService.endSession({
            employeeId,
            exitAt: exitTs,
            exitSource: "EXIT_CAMERA",
            exitCameraCode: presence.lastCameraCode,
            exitConfidence: presence.confidence,
        });

        console.log("[OUT]", employeeId);
    } else {
        console.log("[IGNORED EXIT]", employeeId);
    }
},
    { connection }
);

export default presenceWorker;