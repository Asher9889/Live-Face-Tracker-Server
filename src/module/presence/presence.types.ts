export const PRESENCE_STATE = {
  IN: "IN",
  OUT: "OUT",
  EXIT_PENDING: "EXIT_PENDING",
  PENDING_EXIT: "PENDING_EXIT",
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
    entryCameraCode: string;
    exitCameraCode?: string;
    exitTimerId?: NodeJS.Timeout | null;
}

// Inside to outside world.
export type PresenceDTO = {
  employeeId: string;
  state: "IN" | "OUT" | "EXIT_PENDING" | "PENDING_EXIT";
  lastSeenAt: number;
  lastGate: "ENTRY" | "EXIT";
  entryCameraCode?: string;
  exitCameraCode?: string;
};
