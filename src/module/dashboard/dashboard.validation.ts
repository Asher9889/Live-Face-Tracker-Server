import { z } from "zod";
import { DateTime } from "luxon";
import { GATE_TYPE } from "../cameras/domain/camera.constant";

const parseCSVList = () =>
    z.string()
        .transform((value) =>
            value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
        );

const parseCSVEnum = (allowed: string[]) =>
    z.string()
        .transform((value) =>
            value
                .split(",")
                .map((item) => item.trim().toUpperCase())
                .filter((item) => allowed.includes(item))
        );

const normalizeTimezone = (timezone: string) =>
    timezone
        .trim()
        .split("/")
        .map((segment) => segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : segment)
        .join("/");

const timezoneSchema = z.preprocess((value) => {
    if (typeof value !== "string") return value;
    return normalizeTimezone(value);
}, z.string().default("Asia/Kolkata").refine((timezone) => {
    return DateTime.now().setZone(timezone).isValid;
}, { error: "Invalid timezone" }));

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date format. Expected YYYY-MM-DD" });

export const dashboardAttendanceSummaryQuerySchema = z.object({
    date: dateSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    timezone: timezoneSchema,
    department: z.string().trim().min(1).optional(),
    cameraIds: parseCSVList().optional().default([]),
    gateType: parseCSVEnum(Object.values(GATE_TYPE)).optional().default([]),
    employeeIds: parseCSVList().optional().default([]),
}).superRefine((value, ctx) => {
    if (!value.date && (!value.from || !value.to)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["date"],
            message: "Provide either date or both from and to",
        });
    }
});
