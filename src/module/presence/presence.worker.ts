import { Worker } from "bullmq";
import IORedis from "ioredis";
import PresenceModel from "./presence.model";
import { attendanceService } from "../attendance";
import { redisConfig } from "../../db/connectRedis";
import { presenceLogService } from "./presence.module";
import { logger, miliSecondsToISoDate } from "../../utils";

const connection = new IORedis(redisConfig);

const presenceWorker = new Worker("presence", async (job) => {
    try {
        logger.info(`Received job: ${job.name}, Data: ${JSON.stringify(job.data)}`);
        if (job.name !== "confirm-exit") return;

        let { employeeId, exitTs } = job.data;

        exitTs = Number(exitTs) + 1000; // for correct log order

        const presence = await PresenceModel.findOne({ employeeId, state: { $in: ["EXIT_PENDING", "PENDING_EXIT"] }}).lean();

        if (!presence) {
            logger.info(`[CONFIRM EXIT] No presence record found for employee: ${employeeId}`);
            return;
        }; 

        await PresenceModel.updateOne(
            { employeeId, state: { $in: ["EXIT_PENDING", "PENDING_EXIT"] }, pendingExitAt: exitTs },
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
            exitAt: exitTs, // add 1 second to ensure this log is after the entry log in case of quick exit
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
            occurredAt: exitTs, // add 1 second to ensure this log is after the entry log in case of quick exit
            date: miliSecondsToISoDate(exitTs), 
            source: "face_recognition",
            confidence: presence.confidence,
        });

        console.log("[OUT]", employeeId);
    } catch (error) {

        logger.error(
            {
                errorMessage:
                    error instanceof Error
                        ? error.message
                        : String(error),

                errorStack:
                    error instanceof Error
                        ? error.stack
                        : undefined,
            },

            "Error processing presence worker job"
        );
        throw error;
    }
},
    { connection }
);

presenceWorker.on("failed", (job, error) => {
    logger.error({
        jobId: job?.id, jobName: job?.name, errorMessage: error.message,
        errorStack: error.stack
    }, "Presence worker job failed");
});

presenceWorker.on("error", (error) => {
    logger.error({ error }, "Presence worker error");
});

void presenceWorker.waitUntilReady()
    .then(() => {
        logger.info("Presence worker is ready and connected to Redis");
    })
    .catch((error) => {
        logger.error({ error }, "Presence worker failed to become ready");
    });

export default presenceWorker;