export const PRESENCE_STATE = {
  IN: "IN",
  OUT: "OUT",
} as const;

export const GATE_ROLE = {
  ENTRY: "ENTRY",
  EXIT: "EXIT",
} as const;

export type PresenceState = typeof PRESENCE_STATE[keyof typeof PRESENCE_STATE];
export type GateRole = typeof GATE_ROLE[keyof typeof GATE_ROLE];

export interface RuntimePresence {
    employeeId: string;
    state: PresenceState;
    lastSeenAt: number;
    lastGate: GateRole;
    entryCameraCode?: string | undefined;
    exitCameraCode?: string | undefined;
    exitTimerId?: NodeJS.Timeout | null;
}
