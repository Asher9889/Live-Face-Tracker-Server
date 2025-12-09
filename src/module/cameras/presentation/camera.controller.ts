import { NextFunction, Response, Request } from "express";
import CameraService from "../application/camera.service";
import { CreateCameraDTO } from "../application/dtos/CreateCameraDTO";
import { ApiResponse } from "../../../utils";
import { StatusCodes } from "http-status-codes";

export default class CameraController {
    private cameraService: CameraService;

    constructor(cameraService:CameraService) {
        this.cameraService = cameraService;
    }
    
    async createCamera(req: Request, res: Response, next: NextFunction){
        try { 
            const dto: CreateCameraDTO = {
                name: req.body.name,
                code: req.body.code,
                gateType: req.body.gateType,
                location: req.body.location,
                rtspUrl: req.body.rtspUrl,
                credentials: req.body.credentials,
                streamConfig: req.body.streamConfig,
                enabled: req.body.enabled,
                roi: req.body.roi,
                wsStreamId: req.body.wsStreamId,
                status: req.body.status
            };
            const camera = await this.cameraService.createCamera(dto);
            return ApiResponse.success(res, "Camera created successfully", camera, StatusCodes.CREATED)
        } catch (error) {
            console.log("error is:", error)
            return next(error);
        }
    }

}