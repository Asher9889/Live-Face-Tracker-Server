import { StatusCodes } from "http-status-codes";
import { redis } from "../../../db";
import { RedisEventNames } from "../../../events/EventNames";
import { ApiError } from "../../../utils";
import { CameraStatusDTO } from "../application/dtos/CreateCameraDTO";
import Camera from "../domain/camera.entity";
import CameraModel from "./camera.model";
import ICameraRepository from "./ICamera.repository";

export default class CameraRepository implements ICameraRepository {
    async save(camera: Camera): Promise<Camera> {
        const doc = await CameraModel.create(camera.toJSON());
        return doc;
    }
    async findByCode(code: string): Promise<Camera | null> {
        const doc = await CameraModel.findOne({ code }, { _id: 1 }).lean();
        return doc;
    }
    async getAll(){
        const docs = await CameraModel.find().lean();
        return docs;
    }
    async getAllStatus(): Promise<CameraStatusDTO[]> {
        const cameras = await CameraModel.find({}, { _id: 0, code: 1, status: 1}).lean();

        const pipeline = redis.pipeline();
        cameras.forEach(camera => {
            pipeline.hgetall(RedisEventNames.CAMERA_STATE(camera.code));
        });

        const results = await pipeline.exec();

        if(!results || results.length === 0 || results === null){
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to get camera status");
        }
       
        const cameraStatus: CameraStatusDTO[] = [];

        cameras.forEach((camera , index) => {
            const state = results[index]; 
            if(!state) return;
            let redisState = state[1] as Record<"status" | "lastFrameAt" | "stoppedAt" | "ingressId" | "streamStartTs", string>;
            const code = camera.code;
            cameraStatus.push({
                code: code,
                status: redisState.status,
                lastFrameAt: redisState.lastFrameAt ? Number(redisState.lastFrameAt) : null, 
                stoppedAt: redisState.stoppedAt ? Number(redisState.stoppedAt) : null,
                streamStartTs: redisState.streamStartTs ? Number(redisState.streamStartTs) : null
            })
        })

        return cameraStatus;
    }
}