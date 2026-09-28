import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import LiveService from "./live.service";
import { ApiResponse, ApiError } from "../../utils";
import { CustomRequest } from "../../types/express";

/** Identity a viewer joins with. Falls back to a random one for service tokens. */
function resolveIdentity(req: CustomRequest): string {
    const user = req.user as { id?: string } | undefined;
    return user?.id ? `user_${user.id}` : `viewer_${Math.random().toString(36).slice(2, 10)}`;
}

export default class LiveController {
    private liveService: LiveService;

    constructor(liveService: LiveService) {
        this.liveService = liveService;
        this.listRooms = this.listRooms.bind(this);
        this.getViewerToken = this.getViewerToken.bind(this);
    }

    /** Cameras available to watch. Room name === camera code. */
    async listRooms(req: Request, res: Response, next: NextFunction) {
        try {
            const rooms = await this.liveService.listRooms();
            return ApiResponse.success(res, "Live rooms fetched successfully", rooms, StatusCodes.OK, rooms.length);
        } catch (error) {
            return next(error);
        }
    }

    /** View-only credentials for one camera's room. */
    async getViewerToken(req: CustomRequest, res: Response, next: NextFunction) {
        try {
            const code = req.params.code as string;
            if (!code) {
                throw new ApiError(StatusCodes.BAD_REQUEST, "Camera code is required");
            }

            const credentials = await this.liveService.createViewerCredentials(code, resolveIdentity(req));

            return ApiResponse.success(res, "Token generated successfully", credentials, StatusCodes.OK);
        } catch (error) {
            return next(error);
        }
    }
}
