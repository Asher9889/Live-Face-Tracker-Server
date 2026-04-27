import { DateTime } from "luxon";
import z from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date format. Expected YYYY-MM-DD" });
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, { error: "Invalid month format. Expected YYYY-MM" });

const parseCSVEnum = (allowed: string[]) =>
    z.string().optional().transform((value) => {
        if (!value) return [];

        return value
            .split(",")
            .map((item) => item.trim().toUpperCase())
            .filter((item) => allowed.includes(item));
    });

const timezoneSchema = z.string().default("UTC").refine((tz) => DateTime.now().setZone(tz).isValid, {
    error: "Invalid timezone",
});

const baseAttendanceListQuerySchema = z.object({
    employeeId: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).optional(),
    status: parseCSVEnum(["VERIFIED", "UNKNOWN", "SUSPICIOUS"]),
    eventType: parseCSVEnum(["ENTRY", "EXIT"]),
    limit: z.coerce.number().int().min(1),
    offset: z.coerce.number().int().min(0),
    sortBy: z.enum(["timestamp", "employeeName", "gate"]),
    sortOrder: z.enum(["asc", "desc"]),
    timezone: timezoneSchema,
    isLate: z.coerce.boolean().optional(),
    isEarlyExit: z.coerce.boolean().optional(),
});

export const attendanceEventsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    timezone: timezoneSchema,
});

export const attendanceDateQuerySchema = baseAttendanceListQuerySchema.extend({
    date: dateSchema,
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z.enum(["timestamp", "employeeName", "gate"]).default("timestamp"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    status: parseCSVEnum(["VERIFIED", "UNKNOWN", "SUSPICIOUS"]),
    eventType: parseCSVEnum(["ENTRY", "EXIT"]),
});

export const attendanceRangeQuerySchema = baseAttendanceListQuerySchema.extend({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z.enum(["timestamp", "employeeName", "gate"]).default("timestamp"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    status: parseCSVEnum(["VERIFIED", "UNKNOWN", "SUSPICIOUS"]),
    eventType: parseCSVEnum(["ENTRY", "EXIT"]),
}).superRefine((value, ctx) => {
    if (value.dateFrom > value.dateTo) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dateTo"],
            message: "dateTo must be greater than or equal to dateFrom",
        });
    }
});

export const attendanceEmployeeTimelineQuerySchema = z.object({
    date: dateSchema,
    timezone: timezoneSchema,
});

export const attendanceEmployeeSummaryQuerySchema = z.object({
    month: monthSchema,
    timezone: timezoneSchema,
});

export const attendanceCalendarQuerySchema = z.object({
    month: monthSchema,
    timezone: timezoneSchema,
});

export const attendanceCurrentStateQuerySchema = z.object({
    date: dateSchema.optional(),
    employeeId: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).optional(),
    registeredOnly: z.coerce.boolean().optional().default(true),
    includeCompleted: z.coerce.boolean().optional().default(false),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z.enum(["firstEntryAt", "lastSeenAt", "employeeName", "department"]).optional().default("lastSeenAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    timezone: timezoneSchema,
});

export const attendanceEmployeeSessionQuerySchema = z.object({
    date: dateSchema.optional(),
    timezone: timezoneSchema,
});

export const attendanceEmployeeExportQuerySchema = z.object({
    from: dateSchema,
    to: dateSchema,
    format: z.enum(["csv", "xlsx"]).default("csv"),
    timezone: timezoneSchema,
    async: z.coerce.boolean().optional().default(false),
}).superRefine((value, ctx) => {
    if (value.from > value.to) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["to"],
            message: "to must be greater than or equal to from",
        });
    }
});

export const attendanceReportExportBodySchema = z.object({
    date: dateSchema,
    scope: z.enum(["ALL_EMPLOYEES", "SELECTED_EMPLOYEES"]),
    format: z.enum(["csv", "xlsx"]).optional().default("csv"),
    employeeIds: z.array(z.string().min(1)).optional(),
    department: z.string().trim().min(1).optional(),
    registeredOnly: z.coerce.boolean().optional().default(true),
    includeUnregistered: z.coerce.boolean().optional().default(false),
    timezone: timezoneSchema,
}).superRefine((value, ctx) => {
    if (value.scope === "SELECTED_EMPLOYEES" && (!value.employeeIds || value.employeeIds.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["employeeIds"],
            message: "employeeIds are required when scope is SELECTED_EMPLOYEES",
        });
    }
});
