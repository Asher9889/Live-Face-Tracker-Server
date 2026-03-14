import zod from "zod";
import createUnknownSchema from "./unknown.schema";
import { createUnknownIdentityDTO } from "./unknown.schema";

export type CreateUnknownEventDTO = zod.infer<typeof createUnknownSchema>;
export type CreateUnknownIdentityDTO = zod.infer<typeof createUnknownIdentityDTO>;

export interface GetUnknownPersonsDTO {
    id: string,
    avatar: string,
    eventCount: number;
    firstSeen: number;
    lastSeen: number;
    status: string;
}   

export interface UnknownEmbeddingDTO {
    id: string;
    representativeEmbedding: number[];
    representativeImageKey: string;
}
