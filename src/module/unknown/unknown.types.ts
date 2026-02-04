import zod from "zod";
import createUnknownSchema from "./unknown.schema";

export type CreateUnknownEventDTO = zod.infer<typeof createUnknownSchema>;

export interface GetUnknownPersonsDTO {
    id: string,
    avatar: string,
    eventCount: number;
    firstSeen: number;
    lastSeen: number;
    status: string;
}   