const GATE_TYPE = {
    ENTRY: "ENTRY",
    EXIT: "EXIT",
    BOTH: "BOTH",
    VISITOR: "VISITOR"
} as const;

const CAMERA_ROLE = {
    REGISTER: "REGISTER",
    ASSIST: "ASSIST",
    OBSERVE: "OBSERVE",
} as const;


type TGateType = typeof GATE_TYPE[keyof typeof GATE_TYPE];
type TCameraRole = typeof CAMERA_ROLE[keyof typeof CAMERA_ROLE];

export { GATE_TYPE, CAMERA_ROLE, TGateType, TCameraRole };