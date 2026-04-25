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

const timezoneSchema = z.string().default("Asia/Kolkata").refine((tz) => DateTime.now().setZone(tz).isValid, {
    error: "Invalid timezone",
});

export const attendanceEmployeeTimelineQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date format. Expected YYYY-MM-DD" }),
    timezone: timezoneSchema,
});

export const attendanceEmployeeSummaryQuerySchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, { error: "Invalid month format. Expected YYYY-MM" }),
    timezone: timezoneSchema,
});

export const attendanceCalendarQuerySchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, { error: "Invalid month format. Expected YYYY-MM" }),
    timezone: timezoneSchema,
});

export const attendanceEmployeeExportQuerySchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid from date format. Expected YYYY-MM-DD" }),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid to date format. Expected YYYY-MM-DD" }),
    format: z.enum(["csv"]).default("csv"),
    timezone: timezoneSchema,
    async: z.coerce.boolean().optional().default(false),
});
