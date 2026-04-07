import { NextFunction, Request, Response } from "express";
import { CreateUnknownEventDTO, CreateUnknownIdentityDTO, CreateUnknownPersonEventDTO, CreateUnknownSchemaDTO, MergeUnknownDTO, updateUnknownSchemaDTO } from "./unknown.types";
import { unknownService } from "./unknown.module";
import { ApiError, ApiResponse } from "../../utils";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from 'uuid';
import { UnknownIdentityModel } from "./unknown-identity.model";
import axios from "axios";

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

    mergeUnknown = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { sourceIds } = req.body as MergeUnknownDTO;
            console.log("Source", sourceIds)
            const ids = sourceIds;

            const identities = await UnknownIdentityModel.find({
                _id: { $in: ids }
            });

            const embeddings = identities.map(i => i.representativeEmbedding);
            const counts = identities.map(i => i.embeddingCount);

            const ress = await axios.post("http://localhost:4001/merge", {
                embeddings,
                counts
            });
            /**
             * {
                status: 'error',
                message: 'Embeddings too different (similarity=0.330)'
                }
             */

            console.log(ress.data);
            if (ress.data.status === "error") {
                throw new ApiError(StatusCodes.BAD_REQUEST, `Do not merge. ${ress.data.message}`);
            }

            // const data = await unknownService.mergeUnknown(sourceIds);
            return ApiResponse.success(res, "Unknown merged successfully", ress.data);
        } catch (error) {
            return next(error);
        }
    }


}

export default UnknownController;