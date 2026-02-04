import { NextFunction, Request, Response } from "express";
import { CreateUnknownEventDTO } from "./unknown.types";
import { unknownService } from "./unknown.module";
import { ApiResponse } from "../../utils";

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
}
    
export default UnknownController;