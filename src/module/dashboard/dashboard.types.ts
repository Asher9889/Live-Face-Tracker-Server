import z from "zod";
import { dashboardAttendanceSummaryQuerySchema } from "./dashboard.validation";

export type DashboardAttendanceSummaryQueryDTO = z.infer<typeof dashboardAttendanceSummaryQuerySchema>;

export type DashboardAttendanceSummaryResponse = {
    range: {
        from: string;
        to: string;
        timezone: string;
    };
    stats: {
        totalRecords: number;
        uniqueEmployees: number;
        totalWorkDurationMinutes: number;
        unknownEvents: number;
        lateEntries: number;
        earlyExits: number;
    };
};
