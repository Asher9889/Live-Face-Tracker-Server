import { redisSub } from "../db";
import { WS_EVENTS } from "../events";
import { presenceService } from "../module/presence";
import { wsServer } from "./initStream";
import normalizeBBox from "./normalizeBBox";

type FaceBBoxPayload = {
    event: "track_update" | "track_lost" | "person_update" | "person_entered" | "person_exit";
    camera_code: string;
    track_id: number;
    bbox: [number, number, number, number];
    frameTs: number;
    eventTs: number;
    frame_width: number;
    frame_height: number;
    person_id?: string;
    similarity?: number;
};

export default function initCameraBBoxSubscriber() {
    redisSub.psubscribe("live-face-tracker:camera-events:*");

    redisSub.on("pmessage", (_pattern, channel, message) => {
        // channel = live-face-tracker:camera-events:entry_1
        const cameraCode = channel.split(":").pop();

        const payload: FaceBBoxPayload = JSON.parse(message); // track_update

        const { person_id, camera_code, track_id, bbox, frameTs, eventTs, frame_width, frame_height } = payload;

        let normalizedBBox;
        if (payload.event !== "track_lost") {
            normalizedBBox = normalizeBBox(payload.bbox, payload.frame_width, payload.frame_height);
        }
        wsServer.broadcast({
            type: WS_EVENTS.FACE_BBOX,
            payload: {
                event: payload.event,
                cameraCode,
                trackId: payload.track_id,
                personId: payload?.person_id,
                bbox: normalizedBBox ?? {},
                frameTs: payload.frameTs,
                eventTs: payload.eventTs,
                similarity: payload?.similarity,
                frameWidth: payload.frame_width,
                frameHeight: payload.frame_height,
            }
        });

        switch (payload.event) {
            case "person_entered":
                presenceService.onPersonEntered({ employeeId: person_id!!, cameraCode: payload.camera_code, gateRole: "ENTRY", trackId: track_id, eventTs: eventTs, confidence: payload?.similarity ?? 0 });
                break;

            case "person_exit":
                presenceService.onPersonExit({ employeeId: person_id!!, cameraCode: payload.camera_code, gateRole: "EXIT", trackId: track_id, eventTs: eventTs, confidence: payload?.similarity ?? 0 });
                break;    
            // case "person_update": 
            //     presenceService.onPersonUpdate({ employeeId: person_id!!, trackId: track_id, eventTs: eventTs });
            //     break;
            // case "track_lost": 
            //     presenceService.onTrackLost({ employeeId: person_id!!, trackId: track_id, });
            //     break;
        }
    });
}