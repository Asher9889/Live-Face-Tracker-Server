import cron from "node-cron";
import { AttendanceModel } from "../module/attendance";
import { PresenceModel } from "../module/presence";
import { todayDate } from "../utils";



export function startAttendanceCron() {
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
                const exitTime = session.lastSeenAt;

                // 2. Close attendance session
                await AttendanceModel.updateOne(
                    { _id: session._id, exitAt: { $exists: false } }, // idempotent guard
                    {
                        $set: {
                            exitAt: exitTime,
                            isExitMissing: true,
                            exitSource: "SYSTEM_RECOVERY"
                        }
                    }
                );

                // 3. Reset presence
                await PresenceModel.updateOne(
                    { employeeId: session.employeeId },
                    {
                        $set: {
                            state: "OUT",
                            pendingExitAt: null,
                            lastChangedAt: Date.now()
                        }
                    }
                );

                console.log("[CRON] Closed session:", session.employeeId);
            }

            console.log("[CRON] Attendance auto-close completed");
        } catch (error) {
            console.error("[CRON ERROR]", error);
        }
    });
}