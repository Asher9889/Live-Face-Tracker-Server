import { Worker } from "bullmq";
import IORedis from "ioredis";
import PresenceModel from "./presence.model";
import { attendanceService } from "../attendance";
import { redisConfig } from "../../db/connectRedis";
import { presenceLogService } from "./presence.module";
import { miliSecondsToISoDate } from "../../utils";

const connection = new IORedis(redisConfig);

const presenceWorker = new Worker("presence", async (job) => {
    if (job.name !== "confirm-exit") return;

    const { employeeId, exitTs } = job.data;

    const presence = await PresenceModel.findOne({ employeeId, state: { $in: ["EXIT_PENDING", "PENDING_EXIT"] }, pendingExitAt: exitTs, }).lean();

    if (!presence) {
        console.log("[CONFIRM EXIT] No presence record found for employee", employeeId);
        return;
    };

    await PresenceModel.updateOne(
        { employeeId, state: { $in: ["EXIT_PENDING", "PENDING_EXIT"], pendingExitAt: exitTs, } },
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

    await presenceLogService.insertLog({
        employeeId,
        eventType: "EXIT_CONFIRMED",
        fromState: "EXIT_PENDING",
        toState: "OUT",
        cameraCode: presence.lastCameraCode,
        occurredAt: exitTs,
        date: miliSecondsToISoDate(exitTs),
        source: "face_recognition",
        confidence: presence.confidence,
    });

    console.log("[OUT]", employeeId);
},
    { connection }
);

export default presenceWorker;