export const ENTRY_TYPE = ["ENTRY_CAMERA"] as const;
export const EXIT_TYPE = ["EXIT_CAMERA", "EXIT_DETECTED", "AUTO_EXIT_TIMEOUT", "SYSTEM_RECOVERY", "MANUAL_CORRECTION"] as const;
export const PRESENCE_LOG_TYPE = ["ENTRY_DETECTED", "EXIT_DETECTED", "EXIT_CONFIRMED", "EXIT_PENDING", "PENDING_EXIT", "EXIT_CANCELLED", "AUTO_EXIT_TIMEOUT", "SYSTEM_RECOVERY", "MANUAL_CORRECTION", "FACE_DETECTED"] as const;

export type EntryType = typeof ENTRY_TYPE[number];
export type ExitType = typeof EXIT_TYPE[number];
export type PresenceLogType = typeof PRESENCE_LOG_TYPE[number];
 