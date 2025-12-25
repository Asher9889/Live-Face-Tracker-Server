import { redis } from "../../../db";
import { RedisEventNames } from "../../../events/EventNames";
import CameraModel from "./camera.model";

export default async function loadCameraConfigsToRedis() {
    try {
        const cameraConfigs = await CameraModel.find({}, { gateType: 1, code: 1, _id: 0 });
        const pipeline = redis.pipeline();

        cameraConfigs.length > 0 &&
            cameraConfigs.forEach((config: { code: string, gateType: string }) => {
                pipeline.hset(RedisEventNames.CAMERA_GATE_KEY, config.code, config.gateType);
            });
        await pipeline.exec();
        console.log('Successfully loaded camera configs to Redis');
    } catch (error) {
        console.error('Error loading camera configs to Redis:', error);
    }
}