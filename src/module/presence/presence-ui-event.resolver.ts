import { FaceBBoxPayload } from "../../stream/initCameraBBoxSubscriber";
import { logger } from "../../utils";
import { cameraService } from "../cameras";
import { employeeService } from "../shared/minio/minio.client";
import PresenceModel from "./presence.model";
import { GateRole } from "./presence.types";

type onPersonEnteredParams = {
    id: string;
    name: string;
    gateRole: GateRole;
    eventTs: number;
    confidence: number;
}

type event = "person_entered" | "person_exited" | "unknown_entered" | "unknown_exited";



async function onPersonEntered(event: event, payload: FaceBBoxPayload) {

    let { person_id, camera_code, eventTs } = payload;

    if (!person_id) {
        logger.info(`person_id is missing in payload for camera ${camera_code} and event ${event}`);
        return;
    }

    logger.info(`Received ${event} event for person_id ${person_id} at camera ${camera_code}`);

    const employeeInfo = await employeeService.getEmployeeNotificationData(person_id);

    if (!employeeInfo) {
        logger.warn(`No employee data found for person_id ${person_id}`);
        return;
    }

    const { name, role, department, avatar } = employeeInfo;


    const { name: cameraName, gateType } = await cameraService.getCameraByCode(camera_code);
    const gateRole = gateType === "ENTRY" ? "entry gate" : "exit gate";

    // const currentPresenceStatus = await PresenceModel.findOne({ personId: person_id }).lean();
    // let note = "";

    // if (currentPresenceStatus && currentPresenceStatus.state === "IN") {
    //     logger.info(`Person ${person_id} is already marked as present. Skipping presence update.`);
    //     note = `${name} was detected at ${cameraName}`;
    //     return;
    // }

    // else if (event === "person_exited") {
    //     if (currentPresenceStatus && currentPresenceStatus.state === "OUT") {
    //         logger.info(`Person ${person_id} is already marked as not present. Skipping presence update.`);
    //         note = `${name} was detected exiting at ${cameraName} but was already marked as not present.`;
    //         return;
    //     }
    // }

    return {
        name,
        role,
        department,
        avatar,
        cameraName,
        gateRole,
        eventTs,
        note: `${name} was detected at ${cameraName} (${gateRole})`
    }







}

export { onPersonEntered};