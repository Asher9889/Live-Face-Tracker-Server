import z from "zod";
import {
  attendanceDateQuerySchema,
  reportsSummaryQuerySchema,
  reportsRowsQuerySchema,
  reportsExportBodySchema,
  attendanceCalendarQuerySchema,
  attendanceEmployeeExportQuerySchema,
  attendanceEmployeeSummaryQuerySchema,
  attendanceEmployeeTimelineQuerySchema,
  attendanceEventsQuerySchema,
  attendanceRangeQuerySchema,
  attendanceCurrentStateQuerySchema,
  attendanceEmployeeSessionQuerySchema,
  attendanceReportExportBodySchema,
} from "./attendance.validation";

export type AttendenceQueryDTO = {
    cursor: string;
    limit: string;
    from: string;
    to: string;
    type: string;
    status: string;
}

export type AttendanceEventsQueryDTO = z.infer<typeof attendanceEventsQuerySchema>;
export type AttendanceDateQueryDTO = z.infer<typeof attendanceDateQuerySchema>;
export type AttendanceRangeQueryDTO = z.infer<typeof attendanceRangeQuerySchema>;
export type AttendanceEmployeeTimelineQueryDTO = z.infer<typeof attendanceEmployeeTimelineQuerySchema>;
export type AttendanceEmployeeSummaryQueryDTO = z.infer<typeof attendanceEmployeeSummaryQuerySchema>;
export type AttendanceEmployeeCalendarQueryDTO = z.infer<typeof attendanceCalendarQuerySchema>;
export type AttendanceEmployeeExportQueryDTO = z.infer<typeof attendanceEmployeeExportQuerySchema>;
export type AttendanceCurrentStateQueryDTO = z.infer<typeof attendanceCurrentStateQuerySchema>;
export type AttendanceReportExportBodyDTO = z.infer<typeof attendanceReportExportBodySchema>;
export type ReportsExportBodyDTO = z.infer<typeof reportsExportBodySchema>;
export type AttendanceEmployeeSessionQueryDTO = z.infer<typeof attendanceEmployeeSessionQuerySchema>;
export type ReportsSummaryQueryDTO = z.infer<typeof reportsSummaryQuerySchema>;
export type ReportsRowsQueryDTO = z.infer<typeof reportsRowsQuerySchema>;

export interface ReportsSummaryData {
  present: number;
  absent: number;
  late: number;
  avgHours: string;
  missingExit: number;
  overtime: number;
  totalEmployees: number;
}

export interface ReportRowDaily {
  id: string;
  employeeId: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  lastSeenAt?: string | null;
  workHours?: string | null;
  status: "Present" | "Absent" | "Late" | "Half Day";
  currentStatus: "In" | "Out";
  lateStatus: boolean;
  missingExit: boolean;
}

export interface ReportRowMonthly {
  id: string;
  employeeId: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  avgWorkHours: string;
  overtimeDays: number;
  missingExits: number;
}

export type ReportsRowsData<T = ReportRowDaily | ReportRowMonthly> = {
  mode: "daily" | "monthly" | "custom";
  rows: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

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
  employeeId?: string | null;
  employeeIdToView?: string | null;
  employeeName: string;
  employeeAvatar?: string | null;
  department?: string | null;
  designation?: string | null;
  timestamp: string;          // ISO
  type: "ENTRY" | "EXIT";
  gate: string;
  status: "VERIFIED" | "UNKNOWN" | "SUSPICIOUS";
  confidence: number;
  source: "FACE_AI" | "SYSTEM" | "MANUAL";

  isLate?: boolean;
  isEarlyExit?: boolean;
  date?: string;
  lastCameraCode?: string;
  lastChangedAt?: number;
  lastGate?: "ENTRY" | "EXIT";
  lastSeenAt?: number;
  state?: "IN" | "OUT";
}


export interface AttendanceStatsDTO {
  totalRecords: number;
  uniqueEmployees: number;
  totalWorkDuration: number;
  unknownEvents: number;
  lateEntries: number;
  earlyExits: number;
}

export interface AttendancePaginationDTO {
  limit: number;
  offset: number;
  total: number;
}

export interface AttendanceDateResponseDTO {
  date: string;
  events: AttendanceEventDTO[];
  stats: AttendanceStatsDTO;
  pagination: AttendancePaginationDTO;
}

export interface AttendanceRangeResponseDTO {
  attendanceEvents: AttendanceEventDTO[];
  pagination: AttendancePaginationDTO;
  nextCursor: number | null;
  hasMore: boolean;
  dateRange: {
    from: string;
    to: string;
  };
}

export interface AttendanceRecentEventsResponseDTO {
  attendanceEvents: AttendanceEventDTO[];
  nextCursor: number | null;
  hasMore: boolean;
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
