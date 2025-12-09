export const GATE_TYPE = {
    ENTRY: "ENTRY",
    EXIT: "EXIT",
    BOTH: "BOTH",
    VISITOR: "VISITOR"
} as const;

export type TGateType = typeof GATE_TYPE[keyof typeof GATE_TYPE];