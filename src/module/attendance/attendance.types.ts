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


// export type AttendanceEventDTO = {
//     entryConfidence: number;
//     exitConfidence: number;
//     entryAt: number;
//     entrySource: string;
//     exitSource: string;
//     date: string;
//     entryCameraCode: string;
//     exitCameraCode: string;
//     durationMs: number;
//     exitAt: number;
//     employee: {
//         id: string;
//         name: string;
//         avatar: string;
//         department: string;
//         role: string;
//     }
// }

export interface AttendanceEventDTO {
  id: string;
  timestamp: string;          // ISO
  type: "ENTRY" | "EXIT";
  gate: string;
  status: "VERIFIED" | "UNKNOWN";
  confidence: number;
  source: "FACE_AI" | "SYSTEM" | "MANUAL";

  isLate?: boolean;
  isEarlyExit?: boolean;
}


export interface TodayAttendanceSessionDTO {
  id: string;                 // session id
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  department?: string;
  designation?: string;

  date: string;               // YYYY-MM-DD
  firstEntry: string;         // ISO
  lastExit?: string;          // ISO

  totalDuration: number;      // minutes
  breakDuration: number;      // minutes

  status: "COMPLETED" | "ONGOING" | "INCOMPLETE";
  flags: ("LATE_ENTRY" | "EARLY_EXIT" | "MISSING_EXIT")[];

  events: AttendanceEventDTO[];
}
