import zod from "zod";

const createUnknownEventSchema = zod.object({
    camera_code: zod.string(),
    pid: zod.string(),
    reason: zod.string(),
    tid: zod.string(),
    timestamp: zod.string(),
});

const createUnknownIdentityDTO = zod.object({
    cameraCode: zod.string(),
    representativeEmbedding: zod.string(),
    timestamp: zod.string(),
    embeddingCount: zod.string()
})

const createUnknownPersonEventSchema = zod.object({
    cameraCode: zod.string(),
    timestamp: zod.string(),
    unknownId: zod.string(),
    meanEmbedding: zod.string()
})

export default createUnknownEventSchema;
export { createUnknownIdentityDTO, createUnknownPersonEventSchema };