import { NextFunction, Request, Response } from "express";
import { CreateUnknownEventDTO, CreateUnknownIdentityDTO, CreateUnknownPersonEventDTO, CreateUnknownSchemaDTO, MergeUnknownDTO, updateUnknownSchemaDTO } from "./unknown.types";
import { unknownService } from "./unknown.module";
import { ApiError, ApiResponse, saveUnknownDebugImages } from "../../utils";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from 'uuid';
import { IUnknownIdentity, UnknownIdentityModel } from "./unknown-identity.model";
import axios from "axios";
import mongoose from "mongoose";

class UnknownController {
    async createUnknownEvent(req: Request, res: Response, next: NextFunction) {
        try {
            const { camera_code, pid, reason, tid, timestamp } = req.body as CreateUnknownEventDTO;
            const faces = req.files as Express.Multer.File[];
            const { eventId, identityId } = await unknownService.createUnknownEvent({ camera_code, pid, reason, tid, timestamp }, faces);
            return ApiResponse.success(res, "Unknown event created successfully", { eventId, identityId });
        } catch (error) {
            return next(error);
        }
    }

    async createUnknownPersonEvents(req: Request, res: Response, next: NextFunction) {
        try {
            const { cameraCode, timestamp, unknownId, meanEmbedding } = req.body as CreateUnknownPersonEventDTO;
            const face = req.file;

            if (!face) throw new ApiError(StatusCodes.BAD_REQUEST, "Face is required");
            const data = await unknownService.createUnknownPersonEvent({ cameraCode, timestamp, unknownId, meanEmbedding }, face);

            return ApiResponse.success(res, "Unknown person event created successfully", data);
        } catch (error) {
            return next(error);
        }
    }

    async createUnknownIdentity(req: Request, res: Response, next: NextFunction) {
        try {
            const payload = req.body as CreateUnknownSchemaDTO;

            if (!payload) {
                throw new Error("Missing payload");
            }

            const files = req.files as Express.Multer.File[];


            // Debug: save uploaded images (raw + decoded) when enabled
            try { await saveUnknownDebugImages(req, { endpoint: "unknown.create" }); } catch (e) { /* swallow */ }

            // 🔥 Map files by pose name
            const fileMap: Record<string, Express.Multer.File> = {};

            for (const file of files) {
                // fieldname = face_frontal
                const pose = file.fieldname.replace("face_", "");
                fileMap[pose] = file;
            }

            const data = await unknownService.createUnknownIdentity(payload, fileMap);
            console.log("Controller created identity", data);

            return ApiResponse.success(res, "Unknown identity created successfully", data);
        } catch (error) {
            return next(error);
        }
    }

    async updateUnknownIdentity(req: Request, res: Response, next: NextFunction) {
        try {
            // const { unknownId } = req.params;
            const payload = req.body as updateUnknownSchemaDTO;

            if (!payload) {
                throw new Error("Missing payload");
            }

            const files = req.files as Express.Multer.File[];

            // Debug: save uploaded images (raw + decoded) when enabled
            try { await saveUnknownDebugImages(req, { endpoint: "unknown.update", unknownId: payload.unknownId }); } catch (e) { /* swallow */ }

            // 🔥 Map files by pose name
            const fileMap: Record<string, Express.Multer.File> = {};

            for (const file of files) {
                // fieldname = face_frontal
                const pose = file.fieldname.replace("face_", "");
                fileMap[pose] = file;
            }

            const data = await unknownService.updateUnknownIdentity(payload.unknownId, payload, fileMap);

            return ApiResponse.success(res, "Unknown identity updated successfully", data);
        } catch (error) {
            return next(error);
        }
    }

    getUnknownPersons = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const persons = await unknownService.getUnknownPersons();
            return ApiResponse.success(res, "Unknown persons fetched successfully", persons, StatusCodes.OK, persons.length);
        } catch (error) {
            return next(error);
        }
    }

    findAllEmbeddings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const embeddings = await unknownService.findAllEmbeddings();
            return ApiResponse.success(res, "Unknown embeddings fetched successfully", embeddings, StatusCodes.OK, embeddings.length);
        } catch (error) {
            return next(error);
        }
    }

    // mergeUnknown = async (req: Request, res: Response, next: NextFunction) => {
    //     try {
    //         const { sourceIds } = req.body as MergeUnknownDTO;
    //         console.log("Source", sourceIds)
    //         const ids = sourceIds;

    //         const identities = await UnknownIdentityModel.find({
    //             _id: { $in: ids }
    //         });

    //         const embeddings = identities.map(i => i.representativeEmbedding);
    //         const counts = identities.map(i => i.embeddingCount);

    //         const ress = await axios.post("http://localhost:4001/merge", {
    //             embeddings,
    //             counts
    //         });
    //         /**
    //          * {
    //             status: 'error',
    //             message: 'Embeddings too different (similarity=0.330)'
    //             }
    //          */

    //         console.log(ress.data);
    //         if (ress.data.status === "error") {
    //             throw new ApiError(StatusCodes.BAD_REQUEST, `Do not merge. ${ress.data.message}`);
    //         }

    //         // const data = await unknownService.mergeUnknown(sourceIds);
    //         return ApiResponse.success(res, "Unknown merged successfully", ress.data);
    //     } catch (error) {
    //         return next(error);
    //     }
    // }

    // mergeUnknown = async (req: Request, res: Response, next: NextFunction) => {
    //     try {
    //         const { sourceIds } = req.body as MergeUnknownDTO;

    //         if (!sourceIds || sourceIds.length < 2) {
    //             throw new ApiError(StatusCodes.BAD_REQUEST, "At least 2 identities required to merge");
    //         }

    //         // 1. Fetch identities
    //         const identities = await UnknownIdentityModel.find({
    //             _id: { $in: sourceIds }
    //         });

    //         if (identities.length !== sourceIds.length) {
    //             throw new ApiError(StatusCodes.NOT_FOUND, "Some identities not found");
    //         }

    //         // 2. Collect embeddings (IMPORTANT FIX)
    //         const embeddings: number[][] = [];
    //         const counts: number[] = [];

    //         for (const identity of identities) {
    //             if (identity.representativeEmbedding) {
    //                 embeddings.push(identity.representativeEmbedding);
    //                 counts.push(identity.embeddingCount || 1);
    //             }

    //             if (identity.poses) {
    //                 for (const pose of Object.values(identity.poses)) {
    //                     if (pose?.embedding) {
    //                         embeddings.push(pose.embedding);
    //                         counts.push(1); // pose = single sample
    //                     }
    //                 }
    //             }
    //         }

    //         // 3. Validate via AI service
    //         const aiRes = await axios.post("http://localhost:4001/merge", {
    //             embeddings,
    //             counts
    //         });

    //         if (aiRes.data.status === "error") {
    //             throw new ApiError(
    //                 StatusCodes.BAD_REQUEST,
    //                 `Do not merge. ${aiRes.data.message}`
    //             );
    //         }

    //         const { centroid } = aiRes.data;

    //         // 4. Merge poses (BEST PER TYPE)
    //         const mergedPoses: any = {};

    //         for (const identity of identities) {
    //             if (!identity.poses) continue;

    //             for (const [poseType, poseData] of Object.entries(identity.poses)) {
    //                 if (!poseData) continue;

    //                 if (!mergedPoses[poseType]) {
    //                     mergedPoses[poseType] = poseData;
    //                 } else {
    //                     // pick higher quality
    //                     if ((poseData.quality || 0) > (mergedPoses[poseType].quality || 0)) {
    //                         mergedPoses[poseType] = poseData;
    //                     }
    //                 }
    //             }
    //         }

    //         // 5. Pick best representative image
    //         let bestRep = identities[0];

    //         for (const identity of identities) {
    //             if ((identity.faceQuality || 0) > (bestRep.faceQuality || 0)) {
    //                 bestRep = identity;
    //             }
    //         }

    //         // 6. Aggregate counts
    //         const totalCount = identities.reduce(
    //             (sum, i) => sum + (i.embeddingCount || 0),
    //             0
    //         );

    //         // 7. Create new merged identity
    //         const mergedIdentity = await UnknownIdentityModel.create({
    //             representativeEmbedding: centroid,
    //             embeddingCount: totalCount,
    //             poses: mergedPoses,
    //             faceImage: bestRep.faceImage,
    //             faceQuality: bestRep.faceQuality
    //         });

    //         // 8. Delete old identities
    //         await UnknownIdentityModel.deleteMany({
    //             _id: { $in: sourceIds }
    //         });

    //         return ApiResponse.success(res, "Unknown merged successfully", mergedIdentity);

    //     } catch (error) {
    //         return next(error);
    //     }
    // };



    mergeUnknown = async (req: Request, res: Response, next: NextFunction) => {
        const session = await mongoose.startSession();
        try {

            session.startTransaction();
            const { sourceIds } = req.body as MergeUnknownDTO;

            if (!sourceIds || sourceIds.length < 2) {
                throw new ApiError(StatusCodes.BAD_REQUEST, "At least 2 identities required");
            }

            const identities = await UnknownIdentityModel.find({
                _id: { $in: sourceIds }
            });

            if (identities.length !== sourceIds.length) {
                throw new ApiError(StatusCodes.NOT_FOUND, "Some identities not found");
            }

            // ================================
            // 🔥 CHANGE 1: Collect embeddings + weights + quality
            // WHY: counts alone is weak signal
            // ================================

            const embeddings: number[][] = [];
            const weights: number[] = [];
            const qualities: number[] = [];

            for (const identity of identities) {
                // representative embedding
                if (identity.representativeEmbedding) {
                    embeddings.push(identity.representativeEmbedding);

                    weights.push(identity.embeddingCount); // historical weight
                    qualities.push(identity.representativeQuality); // fallback
                }

                // pose embeddings
                if (identity.poses) {
                    for (const pose of Object.values(identity.poses)) {
                        if (pose?.embedding) {
                            embeddings.push(pose.embedding);
                            weights.push(1); // single sample
                            qualities.push(pose.quality); 
                        }
                    }
                }
            }

            // ================================
            // 🔥 CHANGE 2: Send richer payload
            // ================================
            const aiRes = await axios.post("http://localhost:4001/merge", {
                embeddings,
                weights,
                qualities
            });

            if (aiRes.data.status === "error") {
                throw new ApiError(
                    StatusCodes.BAD_REQUEST,
                    `Do not merge. ${aiRes.data.message}`
                );
            }

            const { mergedEmbedding, minSimilarity, avgSimilarity, outliers } = aiRes.data;

            // ================================
            // 🔥 CHANGE 3: Safety validation
            // WHY: prevent identity corruption
            // ================================
            if (minSimilarity < 0.55) {
                throw new ApiError(
                    StatusCodes.BAD_REQUEST,
                    `Merge rejected due to low similarity (${minSimilarity})`
                );
            }

            // ================================
            // 🔥 CHANGE 4: Merge poses (best quality per pose)
            // ================================
            const mergedPoses: any = {};

            for (const identity of identities) {
                if (!identity.poses) continue;

                for (const [poseType, poseData] of Object.entries(identity.poses)) {
                    if (!poseData) continue;

                    if (!mergedPoses[poseType]) {
                        mergedPoses[poseType] = poseData;
                    } else if ((poseData.quality || 0) > (mergedPoses[poseType].quality || 0)) {
                        mergedPoses[poseType] = poseData;
                    }
                }
            }

            // ================================
            // 🔥 CHANGE 5: Pick best representative image
            // ================================
            let bestRep = identities[0];

            for (const identity of identities) {
                if ((identity.representativeQuality || 0) > (bestRep?.representativeQuality || 0)) {
                    bestRep = identity;
                }
            }

            // ================================
            // 🔥 CHANGE 6: Aggregate counts
            // ================================
            const totalCount = identities.reduce(
                (sum, i) => sum + (i.embeddingCount || 0),
                0
            );

            // ================================
            // 🔥 CHANGE 7: CREATE merged identity
            // ================================
            // Ensure payload matches mongoose expectations — cast to any to satisfy TS overloads
            const mergedDoc = {
                representativeEmbedding: mergedEmbedding,
                embeddingCount: totalCount,
                poses: mergedPoses,

                representativeImageKey: bestRep?.representativeImageKey,
                representativePose: bestRep?.representativePose,
                representativeQuality: bestRep?.representativeQuality,

                firstSeen: Math.min(...identities.map(i => i.firstSeen)),
                lastSeen: Math.max(...identities.map(i => i.lastSeen)),

                cameraCode: identities[0]?.cameraCode ?? ""
            } as IUnknownIdentity;

            const mergedIdentity = await UnknownIdentityModel.create(mergedDoc);
            if(!mergedIdentity) {
                throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to create merged identity");
            }

            // ================================
            // ⚠️ CHANGE 8: SOFT DELETE (IMPORTANT)
            // WHY: prevent irreversible corruption
            // ================================
            await UnknownIdentityModel.updateMany(
                { _id: { $in: sourceIds } },
                {
                    status: "merged", // instead of delete
                    mergedInto: mergedIdentity._id, // reference to new identity
                }
            );

            await session.commitTransaction();

            return ApiResponse.success(res, "Merged successfully", {
                mergedIdentity,
                metrics: {
                    minSimilarity,
                    avgSimilarity,
                    outliers
                }
            });

        } catch (error) {
            await session.abortTransaction();
            return next(error);
        }
    };

}

export default UnknownController;