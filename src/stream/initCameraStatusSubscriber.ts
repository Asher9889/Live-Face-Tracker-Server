import redis from "../db/connectRedis";
import { RedisEventNames } from "../events/EventNames";
import { wsServer } from "./initStream";

function initCameraStatusSubscriber() {
    const subscriber = redis.duplicate(); // duplicate redis connection

    subscriber.subscribe(RedisEventNames.CAMERA_STATE_CHANGED);

    subscriber.on("message", (channel, message) => {
        if(channel !== RedisEventNames.CAMERA_STATE_CHANGED) return;
        const data = JSON.parse(message);
        wsServer.broadcast({
            type: RedisEventNames.CAMERA_STATE_CHANGED,
            ...data,
        }); // data = cameraId, status, lastFrameAt
    })
}

export default initCameraStatusSubscriber;
