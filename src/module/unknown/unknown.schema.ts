import zod from "zod";

const createUnknownSchema = zod.object({
    camera_code: zod.string(),
    pid: zod.string(),
    reason: zod.string(),
    tid: zod.string(),
    timestamp: zod.string(),
});

export default createUnknownSchema;