import { redisSub } from "../db";
import { WS_EVENTS } from "../events";
import { cameraService } from "../module/cameras";
import { TCameraRole, TGateType } from "../module/cameras/domain/camera.constant";
import { TDepartment, TRole } from "../module/employees/domain/employee.constants";
import { onPersonEntered } from "../module/presence/presence-ui-event.resolver";
import { employeeService } from "../module/shared/minio/minio.client";
import { UnknownIdentityModel } from "../module/unknown/unknown-identity.model";
import envConfig from "../config/env.config";
// import { presenceService } from "../module/presence/presence.module";
import { wsServer } from "./initStream";
import normalizeBBox from "./normalizeBBox";
import { logger } from "../utils";

export type FaceBBoxPayload = {
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

        let cameraData = cameraMap.get(camera_code);
        // If camera data is not in the map, fetch from database and cache it
        if (!cameraData) {
            const camera = await cameraService.getCameraByCode(camera_code);
            if (camera) {
                cameraMap.set(camera_code, { cameraCode: camera_code, cameraName: camera.name, gateType: camera.gateType });
                cameraData = cameraMap.get(camera_code);
            } else {
                console.warn(`Camera with code ${camera_code} not found in database`);
            }
        }

        let cameraName = cameraData ? cameraData.cameraName : camera_code;



        // Build event-specific UI payloads
        let uiEventPayload: any = null;

        switch (payload.event) {
            case "person_entered":
                console.log(`[Event] person_entered for person`, payload.person_id);
                if (payload.person_id) {
                    // prefer resolver which enriches with cameraName, gateRole, note
                    uiEventPayload = await onPersonEntered(payload.event, payload);

                    // fallback: simple employee fetch
                    if (!uiEventPayload) {
                        try {
                            const data = await employeeService.getEmployeeNotificationData(payload.person_id);
                            uiEventPayload = {
                                ...data,
                                cameraCode: camera_code,
                                cameraName,
                                eventTs: payload.eventTs,
                                note: `${data.name} was detected entering at ${cameraName}`,
                                noteKey: "person_entered",
                            };
                        } catch (e) {
                            console.warn(`[UI] failed to fetch employee data for ${payload.person_id}`, e);
                        }
                    } else {
                        uiEventPayload.noteKey = "person_entered";
                    }
                }
                break;

            case "person_exited":
                console.log(`[Event] person_exited for person`, payload.person_id);
                if (payload.person_id) {
                    try {
                        const data = await employeeService.getEmployeeNotificationData(payload.person_id);
                        uiEventPayload = {
                            ...data,
                            cameraCode: camera_code,
                            cameraName,
                            eventTs: payload.eventTs,
                            note: `${data.name} was detected exiting from ${cameraName}`,
                            noteKey: "person_exited",
                        };
                    } catch (e) {
                        console.warn(`[UI] failed to fetch employee data for ${payload.person_id}`, e);
                    }
                }
                break;

            case "unknown_entered":
                console.log(`[Event] unknown_entered for track_id`, payload.track_id);
                // Unknown identities are stored in UnknownIdentityModel; person_id may contain the identity id
                if (payload.person_id) {
                    try {
                        const identity = await UnknownIdentityModel.findById(payload.person_id).lean();
                        const avatar = identity?.representativeImageKey ? `https://minio.mssplonline.in/${envConfig.minioEmployeeBucketName}/${identity.representativeImageKey}` : null;
                        uiEventPayload = {
                            id: payload.person_id,
                            name: null,
                            role: "Unknown",
                            department: null,
                            avatar,
                            cameraCode: camera_code,
                            cameraName,
                            eventTs: payload.eventTs,
                            note: `Unknown person detected entering at ${cameraName}`,
                            noteKey: "unknown_entered",
                        };
                    } catch (e) {
                        console.warn(`[UI] failed to fetch unknown identity ${payload.person_id}`, e);
                    }
                }
                break;

            case "unknown_exited":
                console.log(`[Event] unknown_exited for track_id`, payload.track_id);
                if (payload.person_id) {
                    try {
                        const identity = await UnknownIdentityModel.findById(payload.person_id).lean();
                        const avatar = identity?.representativeImageKey ? `https://minio.mssplonline.in/${envConfig.minioEmployeeBucketName}/${identity.representativeImageKey}` : null;
                        uiEventPayload = {
                            id: payload.person_id,
                            name: null,
                            role: "Unknown",
                            department: null,
                            avatar,
                            cameraCode: camera_code,
                            cameraName,
                            eventTs: payload.eventTs,
                            note: `Unknown person detected exiting from ${cameraName}`,
                            noteKey: "unknown_exited",
                        };
                    } catch (e) {
                        console.warn(`[UI] failed to fetch unknown identity ${payload.person_id}`, e);
                    }
                }
                break;
        }

        if (uiEventPayload) {
            logger.info(`[Notification] ${payload.event} ready; broadcasting UI payload for camera ${cameraCode}`);
            wsServer.broadcast({
                type: WS_EVENTS.UI_EVENT_NOTIFICATION,
                event: payload.event,
                payload: uiEventPayload,
            });
        }

        // Broadcast the face/bbox event to WebSocket clients
        // const faceEventPayload = {
        //     type: WS_EVENTS.FACE_BBOX,
        //     payload: {
        //         event: payload.event,
        //         cameraCode,
        //         cameraName,
        //         trackId: track_id,
        //         personId: person_id ?? null,
        //         bbox: normalizedBBox ?? null,
        //         frameTs: frameTs,
        //         eventTs: eventTs,
        //         similarity: payload?.similarity ?? null,
        //         frameWidth: frame_width,
        //         frameHeight: frame_height,
        //     }
        // };

        // wsServer.broadcast(faceEventPayload);

    });
}