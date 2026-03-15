import zod from "zod";
import createUnknownSchema, { createUnknownPersonEventSchema } from "./unknown.schema";
import { createUnknownIdentityDTO } from "./unknown.schema";

export type CreateUnknownEventDTO = zod.infer<typeof createUnknownSchema>;
export type CreateUnknownIdentityDTO = zod.infer<typeof createUnknownIdentityDTO>;
export type CreateUnknownPersonEventDTO = zod.infer<typeof createUnknownPersonEventSchema>

export type CreateUnknownPersonEventServiceDTO = {
  cameraCode: string
  timestamp: string
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
