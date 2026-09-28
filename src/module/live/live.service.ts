import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../utils";
import { envConfig } from "../../config";
import { createViewerToken } from "../../stream/livekitToken";
import CameraService from "../cameras/application/camera.service";
import CameraRepository from "../cameras/infrastructure/camera.repository";
import { TGateType } from "../cameras/domain/camera.constant";

/** A camera that can be watched, i.e. a LiveKit room. */
export interface LiveRoom {
    code: string;
    name: string;
    gateType: TGateType;
    enabled: boolean;
    online: boolean;
}

/** Everything the browser needs to open one room. */
export interface ViewerCredentials {
    /** Signalling URL for livekit-client. */
    url: string;
    /** Short-lived, subscribe-only JWT. */
    token: string;
    /** Room name — always the camera code. */
    room: string;
    identity: string;
    expiresInSeconds: number;
}

export default class LiveService {
    private cameraService: CameraService;

    constructor(repo: CameraRepository) {
        this.cameraService = new CameraService(repo);
    }

    /**
     * Rooms the caller may watch. `code` is the room name, because that is what
     * the AI service publishes to — see the note on createViewerCredentials.
     */
    async listRooms(): Promise<LiveRoom[]> {
        const cameras = await this.cameraService.getAllCameras();

        return (cameras as any[]).map((c) => ({
            code: c.code,
            name: c.name,
            gateType: c.gateType,
            enabled: c.enabled ?? true,
            online: c.status?.online ?? false,
        }));
    }

    /**
     * Mint a view-only token for one camera.
     *
     * The room name MUST be the camera `code`, not the mongo `_id`: the AI
     * service publishes each feed to a room named after the camera code. The
     * legacy ffmpeg/ingress path used the mongo id, so the two schemes differ —
     * a token minted with the id will connect to an empty room.
     */
    async createViewerCredentials(code: string, identity: string): Promise<ViewerCredentials> {
        const camera = await this.cameraService.getCameraByCode(code);

        if (!camera.enabled) {
            throw new ApiError(StatusCodes.FORBIDDEN, `Camera ${code} is disabled`);
        }

        const token = await createViewerToken(camera.code, identity);

        return {
            url: envConfig.liveKitUrl,
            token,
            room: camera.code,
            identity,
            expiresInSeconds: envConfig.liveKitTokenTtlSeconds,
        };
    }
}
