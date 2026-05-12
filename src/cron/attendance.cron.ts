import cron from "node-cron";
import { AttendanceModel } from "../module/attendance";
import { PresenceModel } from "../module/presence";
import { miliSecondsToISoDate, todayDate } from "../utils";
import { presenceLogService } from "../module/presence/presence.module";



export default function startAttendanceCron() {
    console.info("[CRON] Initializing attendance cron job...");
    // Runs at 9:30 PM daily
    cron.schedule("30 21 * * *", async () => {
        console.log("[CRON] Attendance auto-close started");

        try {
            const today = todayDate();

            // 1. Find open sessions
            const openSessions = await AttendanceModel.find({
                date: today,
                exitAt: { $exists: false },
            }).lean();


            console.log(`[CRON] Found ${openSessions.length} open sessions`);

            for (const session of openSessions) {
                let exitTime = session.lastSeenAt ?? session.entryAt;
                exitTime += 2 * 1000; // add 2 second buffer to lastSeenAt or entryAt

                if (typeof exitTime !== "number") {
                    console.warn("[CRON] Skipping session without lastSeenAt", session._id);
                    continue;
                }

                const presence = await PresenceModel.findOne({ employeeId: session.employeeId }).lean();

                if (!presence) {
                    console.warn("[CRON] No presence record found for employee", session.employeeId);
                    continue;
                }
                const runtimeConfidence = typeof presence?.confidence === "number" ? presence.confidence : undefined;
                const runtimeCameraCode = typeof presence?.lastCameraCode === "string" ? presence.lastCameraCode : session.entryCameraCode;

                // 2. Close attendance session
                const result = await AttendanceModel.updateOne(
                    { _id: session._id, exitAt: { $exists: false } }, // idempotent guard
                    {
                        $set: {
                            exitAt: exitTime,
                            lastSeenAt: exitTime,
                            isExitMissing: true,
                            exitSource: "SYSTEM_RECOVERY"
                        }
                    }
                );

                if (result.modifiedCount === 0) {
                    console.log("[CRON] Session already closed:", session.employeeId);
                    continue;
                }

                // 3. Reset presence
                await PresenceModel.updateOne(
                    { employeeId: session.employeeId },
                    {
                        $set: {
                            state: "OUT",
                            lastSeenAt: exitTime,
                            lastChangedAt: exitTime,
                            lastGate: "EXIT",
                            lastCameraCode: runtimeCameraCode,
                            ...(typeof runtimeConfidence === "number" ? { confidence: runtimeConfidence } : {}),
                            pendingExitAt: null,
                        }
                    }
                );

                await presenceLogService.insertLog({
                    employeeId: (session.employeeId).toString(),
                    eventType: "SYSTEM_RECOVERY",
                    fromState: "IN",
                    toState: "OUT",
                    cameraCode: presence.lastCameraCode,
                    occurredAt: exitTime,
                    date: miliSecondsToISoDate(exitTime),
                    source: "system",
                    confidence: presence.confidence,
                });

                console.log("[CRON] Closed session:", session.employeeId);
            }

            console.log("[CRON] Attendance auto-close completed");
        } catch (error) {
            console.error("[CRON ERROR]", error);
        }
    }, { timezone: "Asia/Kolkata" });
}