import { AttendenceQueryDTO } from "../module/attendance/attendance.types";

export const ENTRY_TYPE = ["ENTRY_CAMERA"] as const;
export const EXIT_TYPE = ["EXIT_CAMERA", "AUTO_EXIT_TIMEOUT", "SYSTEM_RECOVERY", "MANUAL_CORRECTION"] as const;
export const PRESENCE_LOG_TYPE = ["ENTRY_DETECTED", "EXIT_DETECTED", "AUTO_EXIT_TIMEOUT", "SYSTEM_RECOVERY", "MANUAL_CORRECTION"] as const;

export type EntryType = typeof ENTRY_TYPE[number];
export type ExitType = typeof EXIT_TYPE[number];
export type PresenceLogType = typeof PRESENCE_LOG_TYPE[number];
