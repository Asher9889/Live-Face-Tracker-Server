import zod from "zod";
import { PoseEnum, AllowedPoses } from "./unknown.types";

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
    unknownId: zod.string(),

    timestamp: zod.string().transform((val) => Number(val)),
    meanEmbedding: zod.string().transform((val) => JSON.parse(val)).pipe(zod.array(zod.number())),
})

const mergeUnknownSchema = zod.object({
    sourceIds: zod
        .array(zod.string().min(1))
        .min(2, "At least 2 identities required"),
});

// const createUnknownSchema = zod.object({
//     unknown_id: zod.string().nullable().optional().default(null),

//     camera_code: zod.string().min(1),

//     timestamp: zod.string()
//         .transform((val) => Number(val))
//         .pipe(zod.number().int().positive()),

//     embedding_count: zod.string()
//         .transform((val) => Number(val))
//         .pipe(zod.number().int().positive()),

//     centroid_embedding: zod.string()
//         .transform((val) => { return JSON.parse(val) })
//         .pipe(zod.array(zod.number())),

//     // 🔥 IMPORTANT: poses is JSON string → record
//     poses: zod.preprocess((val) => {
//         if (typeof val === "string") {
//             try { return JSON.parse(val); } catch (e) { return val; }
//         }
//         return val;
//     }, zod.record(
//         zod.string(),
//         zod.object({
//             embedding: zod.array(zod.number()),
//             quality: zod.number().min(0).max(1),
//             face_size: zod.object({ w: zod.number().int().positive(), h: zod.number().int().positive() }),
//             ts: zod.number().int().positive()
//         })
//     ).refine((record) => {
//         // ensure keys are allowed poses
//         const keys = Object.keys(record || {});
//         return keys.length > 0 && keys.every(k => AllowedPoses.includes(k));
//     }, { message: 'At least one valid pose is required and keys must be one of ' + AllowedPoses.join(', ') })),

//     // 🔥 builder_stats is also JSON string
//     builder_stats: zod.preprocess((val) => {
//         if (typeof val === "string") {
//             try { return JSON.parse(val); } catch (e) { return val; }
//         }
//         return val;
//     }, zod.object({
//         count: zod.number().int().positive(),
//         poses: zod.array(PoseEnum).min(1),
//         max_quality: zod.number().min(0).max(1),
//         avg_quality: zod.number().min(0).max(1)
//     }))
// });





// Updare unknown identity schema


const createUnknownSchema = zod.object({
    unknown_id: zod.string().nullable().optional().default(null),

    camera_code: zod.string().min(1),

    // ✅ string → number
    timestamp: zod.string()
        .refine(val => !isNaN(Number(val)), { message: "Invalid timestamp" })
        .transform(val => Number(val))
        .pipe(zod.number().int().positive()),

    // ✅ string → number
    embedding_count: zod.string()
        .refine(val => !isNaN(Number(val)), { message: "Invalid embedding_count" })
        .transform(val => Number(val))
        .pipe(zod.number().int().positive()),

    // ✅ string → JSON → array
    centroid_embedding: zod.string()
        .refine(val => {
            try { JSON.parse(val); return true; } catch { return false; }
        }, { message: "Invalid centroid_embedding JSON" })
        .transform(val => JSON.parse(val))
        .pipe(zod.array(zod.number())),

    // ✅ string → JSON → record
    poses: zod.string()
        .refine(val => {
            try {
                const value = JSON.parse(val);
                console.log("Parsed poses JSON:", value);
                console.log("typeof values is:", typeof value);
                return true;
            }
            catch { return false; }
        }, { message: "Invalid poses JSON" })
        .transform(val => JSON.parse(val))
        .pipe(
            zod.record(
                zod.string(),
                zod.object({
                    embedding: zod.array(zod.number()),
                    quality: zod.number().min(0).max(1),
                    face_size: zod.object({
                        w: zod.number().int().positive(),
                        h: zod.number().int().positive()
                    }),
                    ts: zod.number().int().positive()
                })
            ).refine((record) => {
                const keys = Object.keys(record || {});
                return keys.length > 0 && keys.every(k => AllowedPoses.includes(k));
            }, {
                message: 'At least one valid pose is required and keys must be one of ' + AllowedPoses.join(', ')
            })
        ),

    // ✅ string → JSON → object
    builder_stats: zod.string()
        .refine(val => {
            try { JSON.parse(val); return true; } catch { return false; }
        }, { message: "Invalid builder_stats JSON" })
        .transform(val => JSON.parse(val))
        .pipe(
            zod.object({
                count: zod.number().int().positive(),
                poses: zod.array(PoseEnum).min(1),
                max_quality: zod.number().min(0).max(1),
                avg_quality: zod.number().min(0).max(1)
            })
        )
});

const poseSchema = zod.object({
    embedding: zod
        .array(zod.number())
        .length(512, "Embedding must be 512 dimensions"),

    quality: zod
        .number()
        .min(0)
        .max(1),

    faceSize: zod.object({
        w: zod.number().int().positive(),
        h: zod.number().int().positive()
    }),
    ts: zod.number().int().positive(),
});

const updateUnknownSchema = zod.object({
    unknownId: zod.string().min(1),

    timestamp: zod.coerce.number(), // comes as string

    cameraCode: zod.string().min(1),

    poses: zod.string()
        .refine(val => {
            try {
                const value = JSON.parse(val);
                console.log("Parsed poses JSON:", value);
                console.log("typeof values is:", typeof value);
                return true;
            }
            catch { return false; }
        }, { message: "Invalid poses JSON" })
        .transform(val => JSON.parse(val))
        .pipe(
            zod.record(
                zod.string(),
                zod.object({
                    embedding: zod.array(zod.number()),
                    quality: zod.number().min(0).max(1),
                    face_size: zod.object({
                        w: zod.number().int().positive(),
                        h: zod.number().int().positive()
                    }),
                    ts: zod.number().int().positive()
                })
            ).refine((record) => {
                const keys = Object.keys(record || {});
                return keys.length > 0 && keys.every(k => AllowedPoses.includes(k));
            }, {
                message: 'At least one valid pose is required and keys must be one of ' + AllowedPoses.join(', ')
            })
        ),
})

export default createUnknownEventSchema;
export { updateUnknownSchema, createUnknownIdentityDTO, createUnknownPersonEventSchema, mergeUnknownSchema, createUnknownSchema };