import { redisSub } from "../db";
import { RedisEventNames } from "../events/EventNames";
import { wsServer } from "./initStream";

function initCameraStatusSubscriber() {
    redisSub.subscribe(RedisEventNames.CAMERA_STATE_CHANGED);

    redisSub.on("message", (channel, message) => {
        if(channel !== RedisEventNames.CAMERA_STATE_CHANGED) return;
        const data = JSON.parse(message);
        wsServer.broadcast({
            type: RedisEventNames.CAMERA_STATE_CHANGED,
            payload: {
                cameraId: data.cameraId,
                status: data.status,
                lastFrameAt: data.lastFrameAt,
            }
        }); // data = cameraId, status, lastFrameAt
    })
}

export default initCameraStatusSubscriber;
