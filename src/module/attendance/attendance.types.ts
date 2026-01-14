export type AttendenceQueryDTO = {
    cursor?: string;
    limit?: string;
    from?: string;
    to?: string;
    type?: string;
    status?: string;
}

export type AttendenceFilterDTO = {
    lastChangedAt?: {
        $gte: string;
        $lte: string;
    };
    lastGate?: {
        $in: string[];
    };
}
