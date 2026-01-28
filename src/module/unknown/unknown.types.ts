import zod from "zod";
import createUnknownSchema from "./unknown.schema";

export type CreateUnknownDTO = zod.infer<typeof createUnknownSchema>;

