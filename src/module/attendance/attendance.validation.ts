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

const timezoneSchema = z.string().default("Asia/Kolkata").refine((tz) => DateTime.now().setZone(tz).isValid, {
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
    sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
    timezone: timezoneSchema,
});

// Reports query schemas
const modeEnum = z.enum(["daily", "monthly", "custom"]);

const reportsBaseFilters = z.object({
    mode: modeEnum,
    date: dateSchema.optional(),
    month: monthSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    employeeId: z.string().trim().min(1).optional().transform((v) => (v === "" ? undefined : v)),
    employeeName: z.string().trim().optional().transform((v) => (v === "" ? undefined : v)),
    department: z.string().trim().optional().transform((v) => (v === "" || v === "all" ? undefined : v)),
    status: z.string().optional(),
    lateOnly: z.coerce.boolean().optional().default(false),
    missingExitOnly: z.coerce.boolean().optional().default(false),
    timezone: timezoneSchema,
});

export const reportsRowsQuerySchema = reportsBaseFilters.extend({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(25),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
}).superRefine((value, ctx) => {
    if (value.mode === "monthly" && !value.month) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["month"], message: "month is required for monthly mode" });
    }
    if (value.mode === "daily" && !value.date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "date is required for daily mode" });
    }
    if (value.mode === "custom" && (!value.startDate || !value.endDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate", "endDate"], message: "startDate and endDate are required for custom mode" });
    }
});

export const reportsSummaryQuerySchema = reportsBaseFilters.superRefine((value, ctx) => {
    if (value.mode === "monthly" && !value.month) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["month"], message: "month is required for monthly mode" });
    }
    if (value.mode === "daily" && !value.date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "date is required for daily mode" });
    }
    if (value.mode === "custom" && (!value.startDate || !value.endDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate", "endDate"], message: "startDate and endDate are required for custom mode" });
    }
});

export const reportsExportBodySchema = z.object({
    mode: modeEnum,
    date: dateSchema.optional(),
    month: monthSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    scope: z.enum(["ALL_ROWS", "SELECTED_ROWS", "SELECTED_EMPLOYEES"]).default("ALL_ROWS"),
    rowIds: z.array(z.string()).optional(),
    employeeIds: z.array(z.string()).optional(),
    filters: z.object({
        employeeId: z.string().optional(),
        employeeName: z.string().optional(),
        department: z.string().optional(),
        status: z.string().optional(),
        lateOnly: z.coerce.boolean().optional(),
        missingExitOnly: z.coerce.boolean().optional(),
    }).optional(),
    format: z.enum(["csv", "xlsx"]).default("csv"),
    timezone: timezoneSchema,
    registeredOnly: z.coerce.boolean().optional().default(true),
    includeTimeline: z.coerce.boolean().optional().default(true),
}).superRefine((value, ctx) => {
    if (value.mode === "daily" && !value.date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "date is required for daily mode" });
    }
    if (value.mode === "monthly" && !value.month) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["month"], message: "month is required for monthly mode" });
    }
    if (value.mode === "custom" && (!value.startDate || !value.endDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate", "endDate"], message: "startDate and endDate are required for custom mode" });
    }
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate must be greater than or equal to startDate" });
    }
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
