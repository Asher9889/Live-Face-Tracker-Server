import zod from "zod";
import createUnknownSchema, { createUnknownPersonEventSchema, mergeUnknownSchema } from "./unknown.schema";
import { createUnknownIdentityDTO } from "./unknown.schema";

export type CreateUnknownEventDTO = zod.infer<typeof createUnknownSchema>;
export type CreateUnknownIdentityDTO = zod.infer<typeof createUnknownIdentityDTO>;
export type CreateUnknownPersonEventDTO = zod.infer<typeof createUnknownPersonEventSchema>
export type MergeUnknownDTO = zod.infer<typeof mergeUnknownSchema>

export type CreateUnknownPersonEventServiceDTO = {
  cameraCode: string
  timestamp: number
  unknownId: string
  meanEmbedding: number[]
}

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
