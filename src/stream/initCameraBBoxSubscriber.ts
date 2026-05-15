import { redisSub } from "../db";
import { WS_EVENTS } from "../events";
import { cameraService } from "../module/cameras";
import { TCameraRole, TGateType } from "../module/cameras/domain/camera.constant";
import { TDepartment, TRole } from "../module/employees/domain/employee.constants";
import { employeeService } from "../module/shared/minio/minio.client";
// import { presenceService } from "../module/presence/presence.module";
import { wsServer } from "./initStream";
import normalizeBBox from "./normalizeBBox";

type FaceBBoxPayload = {
    event: "track_update" | "track_lost" | "person_update" | "person_entered" | "person_exited" | "unknown_entered" | "unknown_exited";
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


type NotificationPayload = {
    name: string;
    id: string;
    role: TRole;
    department: TDepartment;
    avatar: string | null;
}

type TCameraData = {
    cameraCode: string;
    cameraName: string;
    gateType: TGateType
}

type employeeId = string;
type cameraCode = string;

const notificationEmployeeMap = new Map<employeeId, NotificationPayload>(); // person_id to employeeId mapping for notifications
const cameraMap = new Map<cameraCode, TCameraData>(); // camera_code to camera name mapping for notifications

const knownNotificationEvents = new Set(["person_entered", "person_exited"]);
const unknownNotificationEvents = new Set(["unknown_entered", "unknown_exited"]);


export default function initCameraBBoxSubscriber() {
    redisSub.psubscribe("live-face-tracker:camera-events:*");

    redisSub.on("pmessage", async (_pattern, channel, message) => {
        // channel = live-face-tracker:camera-events:entry_1
        const cameraCode = channel.split(":").pop();

        const payload: FaceBBoxPayload = JSON.parse(message); // track_update

        const { person_id, camera_code, track_id, bbox, frameTs, eventTs, frame_width, frame_height, event } = payload;

        let normalizedBBox;
        if (payload.event !== "track_lost") {
            normalizedBBox = normalizeBBox(payload.bbox, payload.frame_width, payload.frame_height);
        }

        if (payload.event === "person_exited") {
            console.log("[Event] person_exit event happened for person", payload.person_id);
        }
        if (payload.event === "person_entered") {
            console.log("[Event] person_entered event happened for person", payload.person_id);
        }

        const cameraData = cameraMap.get(camera_code);
        if (!cameraData) {
            const camera = await cameraService.getCameraByCode(camera_code);
            if (camera) {
                cameraMap.set(camera_code, { cameraCode: camera_code, cameraName: camera.name, gateType: camera.gateType });
            } else {
                console.warn(`Camera with code ${camera_code} not found in database`);
            }
        }

        let cameraName = cameraData ? cameraData.cameraName : camera_code;




        if (knownNotificationEvents.has(payload.event)) {
            console.log(`[Notification] ${payload.event} event for person_id ${payload.person_id} at camera ${cameraCode}`);
            if (!payload.person_id) {
                return;
            }

            const notificationPayload = notificationEmployeeMap.get(payload.person_id)
            if (!notificationPayload) {
                const data = await employeeService.getEmployeeNotificationData(payload.person_id);
                notificationEmployeeMap.set(data.id, data);
            }

            wsServer.broadcast({
                type: WS_EVENTS.UI_EVENT_NOTIFICATION,
                payload: {
                    ...notificationEmployeeMap.get(payload.person_id),
                    cameraCode,
                    cameraName
                }
            });
        }



        // Broadcast the event to WebSocket clients 
        // wsServer.broadcast({
        //     type: WS_EVENTS.FACE_BBOX,
        //     payload: {
        //         event: payload.event,
        //         cameraCode,
        //         trackId: payload.track_id,
        //         personId: payload?.person_id,
        //         bbox: normalizedBBox ?? {},
        //         frameTs: payload.frameTs,
        //         eventTs: payload.eventTs,
        //         similarity: payload?.similarity,
        //         frameWidth: payload.frame_width,
        //         frameHeight: payload.frame_height,
        //     }
        // });

    });
}