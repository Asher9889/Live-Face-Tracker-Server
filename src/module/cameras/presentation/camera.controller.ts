import { NextFunction, Response, Request } from "express";
import CameraService from "../application/camera.service";
import { CreateCameraDTO } from "../application/dtos/CreateCameraDTO";
import { ApiResponse } from "../../../utils";
import { StatusCodes } from "http-status-codes";
import { createViewerToken } from "../../../stream/livekitToken";

export default class CameraController {
    private cameraService: CameraService;

    constructor(cameraService: CameraService) {
        this.cameraService = cameraService;
        this.createCamera = this.createCamera.bind(this);
        this.getAllCameras = this.getAllCameras.bind(this);
        this.getToken = this.getToken.bind(this);
    }

    async createCamera(req: Request, res: Response, next: NextFunction) {
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

    async getAllCameras(req: Request, res: Response, next: NextFunction) {
        try {
            const cameras = await this.cameraService.getAllCameras();
            return ApiResponse.success(res, "Cameras fetched successfully", cameras, StatusCodes.OK)
        } catch (error) {
            console.log("error is:", error)
            return next(error);
        }
    }

    async getToken(req: Request, res: Response, next: NextFunction) {
        try {
            const cameraId = req.params.cameraId as string;
            // Use user ID if authenticated, otherwise efficient random identity
            const identity = (req as any).user?.id || `user_${Math.random().toString(36).substring(7)}`;

            const token = await createViewerToken(cameraId, identity);

            return ApiResponse.success(res, "Token generated successfully", { token }, StatusCodes.OK);
        } catch (error) {
            console.log("error getting token:", error);
            return next(error);
        }
    }

}