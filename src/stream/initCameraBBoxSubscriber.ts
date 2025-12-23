import { redisSub } from "../db";
import { WS_EVENTS } from "../events";
import { wsServer } from "./initStream";
import normalizeBBox from "./normalizeBBox";

export default function initCameraBBoxSubscriber() {
    redisSub.psubscribe("live-face-tracker:camera-events:*");

    redisSub.on("pmessage", (_pattern, channel, message) => {
        // channel = live-face-tracker:camera-events:entry_1
        const cameraCode = channel.split(":").pop();

        const payload = JSON.parse(message); // track_update

        let normalizedBBox;
        if(payload.event !== "track_lost") {
            normalizedBBox = normalizeBBox(payload.bbox, payload.frame_width, payload.frame_height);
        }


        wsServer.broadcast({
            type: WS_EVENTS.FACE_BBOX,
            payload : {
                event: payload.event,
                cameraCode,
                trackId: payload.track_id,
                personId: payload.person_id,
                bbox: normalizedBBox ?? {},
                timestamp: payload.timestamp,
                similarity: payload.similarity,
                frameWidth: payload.frame_width,
                frameHeight: payload.frame_height,
            }
        });
    });
}
