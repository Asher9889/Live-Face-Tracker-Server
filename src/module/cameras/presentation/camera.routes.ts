import express from "express";
import CameraController from "./camera.controller";
import CameraService from "../application/camera.service";
import CameraRepository from "../infrastructure/camera.repository";
import { validate } from "../../../middlewares";
import { cameraSchema } from "../infrastructure/camera.schema";
import cameraController from "../../../stream";
import cameraUrl from "../../../config/camera";
import { ApiError } from "../../../utils";
import { StatusCodes } from "http-status-codes";

const router = express.Router();

const controller = new CameraController(new CameraService(new CameraRepository));

router.post("/", validate(cameraSchema), controller.createCamera);
router.get("/", controller.getAllCameras);
router.get("/:cameraId/token", controller.getToken);
router.post("/:cameraId/start", async (req, res, next) => {

  try {
    const cameraId = req.params.cameraId;
    const rtspUrl = cameraUrl.entry_1;
  
    if (!rtspUrl) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Camera not found");
    }
  
    await cameraController.start(cameraId, rtspUrl);
  
    return res.json({ status: "started", cameraId });
  } catch (error) {
    next(error);
  }
});

/**
 * Stop camera streaming
 */
router.post("/:cameraId/stop", async (req, res) => {
  const { cameraId } = req.params;

  await cameraController.stop(cameraId);

  return res.json({ status: "stopped", cameraId });
});

export default router;
