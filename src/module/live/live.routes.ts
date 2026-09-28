import express from "express";
import LiveController from "./live.controller";
import LiveService from "./live.service";
import CameraRepository from "../cameras/infrastructure/camera.repository";
import { isAuthenticated } from "../../middlewares";

const router = express.Router();

const controller = new LiveController(new LiveService(new CameraRepository));

/** Cameras that can be watched; `code` is the LiveKit room name. */
router.get("/cameras", isAuthenticated, controller.listRooms);

/**
 * Short-lived, subscribe-only credentials for one camera's room.
 * The AI service publishes each feed to a room named after the camera `code`.
 */
router.get("/cameras/:code/token", isAuthenticated, controller.getViewerToken);

export default router;

export { controller as liveController };
