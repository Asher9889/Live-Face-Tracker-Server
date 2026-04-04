import zod from "zod";
import createUnknownEventSchema,{ createUnknownPersonEventSchema, mergeUnknownSchema, createUnknownSchema, updateUnknownSchema } from "./unknown.schema";
import { createUnknownIdentityDTO } from "./unknown.schema";

export const AllowedPoses = ["left", "left_mid", "frontal", "right_mid", "right"];
export const PoseEnum = zod.enum(AllowedPoses);


export type CreateUnknownEventDTO = zod.infer<typeof createUnknownEventSchema>;
export type CreateUnknownIdentityDTO = zod.infer<typeof createUnknownIdentityDTO>;
export type CreateUnknownPersonEventDTO = zod.infer<typeof createUnknownPersonEventSchema>
export type MergeUnknownDTO = zod.infer<typeof mergeUnknownSchema>
export type CreateUnknownSchemaDTO = zod.infer<typeof createUnknownSchema>;
export type updateUnknownSchemaDTO = zod.infer<typeof updateUnknownSchema>;

export type PoseKey = "left" | "left_mid" | "frontal" | "right_mid" | "right";
export type PoseMap = Partial<Record<PoseKey, PoseData>>;
export type PoseData = {
  embedding: number[];
  quality: number;
  faceSize: {
    w: number;
    h: number;
  };
  imageKey: string;
  ts: number;
};

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
