import { bboxRedis } from "../db";
import { WS_EVENTS } from "../events";
import { wsServer } from "./initStream";

export default function initCameraBBoxSubscriber() {
    bboxRedis.psubscribe("live-face-tracker:camera-events:*");

    bboxRedis.on("pmessage", (_pattern, channel, message) => {
        // channel = live-face-tracker:camera-events:entry_1
        const cameraCode = channel.split(":").pop();

        const payload = JSON.parse(message);

        wsServer.broadcast({
            type: WS_EVENTS.FACE_BBOX,
            payload : {
                cameraCode,
                trackId: payload.track_id,
                personId: payload.person_id,
                bbox: payload.bbox,
                timestamp: payload.timestamp,
                similarity: payload.similarity,
                frameWidth: payload.frame_width,
                frameHeight: payload.frame_height,
            }
        });
    });
}
