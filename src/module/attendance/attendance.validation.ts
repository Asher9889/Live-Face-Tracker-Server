import { DateTime } from "luxon";
import z from "zod";
import { todayDate } from "../../utils";

const parseCSVEnum = (allowed: string[]) =>
    z.string()
        .transform(v =>
            v.split(",")
                .map(x => x.trim().toUpperCase())
                .filter(x => allowed.includes(x))
        );

const now = todayDate();

export const attendanceEventsQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    cursor: z.coerce.number().optional(),

    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date format. Expected YYYY-MM-DD" }).default(now),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date format. Expected YYYY-MM-DD" }).default(now),

    type: parseCSVEnum(["ENTRY", "EXIT"]).default(["ENTRY", "EXIT"]),
    status: parseCSVEnum(["VERIFIED", "UNKNOWN"]).default(["VERIFIED", "UNKNOWN"]),
});
