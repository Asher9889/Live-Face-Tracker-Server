import z from "zod";
import { attendanceEventsQuerySchema } from "./attendance.validation";

export type AttendenceQueryDTO = {
    cursor: string;
    limit: string;
    from: string;
    to: string;
    type: string;
    status: string;
}

export type AttendanceEventsQueryDTO = z.infer<typeof attendanceEventsQuerySchema>;

export type AttendenceFilterDTO = {
    lastChangedAt?: {
        $gte: string;
        $lte: string;
    };
    lastGate?: {
        $in: string[];
    };
}
