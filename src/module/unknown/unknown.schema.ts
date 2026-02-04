import zod from "zod";

const createUnknownEventSchema = zod.object({
    camera_code: zod.string(),
    pid: zod.string(),
    reason: zod.string(),
    tid: zod.string(),
    timestamp: zod.string(),
});

export default createUnknownEventSchema;