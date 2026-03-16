import { NextFunction, Request, Response } from "express";
import { CreateUnknownEventDTO, CreateUnknownIdentityDTO, CreateUnknownPersonEventDTO } from "./unknown.types";
import { unknownService } from "./unknown.module";
import { ApiError, ApiResponse } from "../../utils";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from 'uuid';

class UnknownController {
    async createUnknownEvent(req: Request, res: Response, next: NextFunction){
        try {
            const { camera_code, pid, reason, tid, timestamp } = req.body as CreateUnknownEventDTO;
            const faces = req.files as Express.Multer.File[];
            const { eventId, identityId } = await unknownService.createUnknownEvent({ camera_code, pid, reason, tid, timestamp }, faces);
            return ApiResponse.success(res, "Unknown event created successfully", { eventId, identityId });
        } catch (error) { 
            return next(error);
        }
    }

    async createUnknownPersonEvents(req: Request, res: Response, next: NextFunction){
        try {
            const { cameraCode, timestamp, unknownId, meanEmbedding } = req.body as CreateUnknownPersonEventDTO;
            const face = req.file;
            
            if(!face) throw new ApiError(StatusCodes.BAD_REQUEST, "Face is required");
            const data = await unknownService.createUnknownPersonEvent({ cameraCode, timestamp, unknownId, meanEmbedding }, face);
            
            return ApiResponse.success(res, "Unknown person event created successfully", data);
        } catch (error) {
            return next(error);
        }
    }

    async createUnknownIdentity(req: Request, res: Response, next: NextFunction){
        try {
            const { cameraCode, timestamp, representativeEmbedding, embeddingCount } = req.body as CreateUnknownIdentityDTO;
            const face = req.file;

            if(!face) throw new ApiError(StatusCodes.BAD_REQUEST, "Face is required");
            const data = await unknownService.createUnknownIdentity({ cameraCode, timestamp, representativeEmbedding, embeddingCount }, face);

            return ApiResponse.success(res, "Unknown identity created successfully", data);
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
}
    
export default UnknownController;