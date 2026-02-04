import zod from "zod";
import createUnknownSchema from "./unknown.schema";

export type CreateUnknownEventDTO = zod.infer<typeof createUnknownSchema>;

// export type CreateUnknownEventDTO = {
//     camera_code: string;
//     pid: string;
//     reason: string;
//     tid: string;
//     timestamp: string;
// }