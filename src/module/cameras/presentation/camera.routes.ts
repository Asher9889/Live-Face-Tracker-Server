import express from "express";
import CameraController from "./camera.controller";
import CameraService from "../application/camera.service";
import CameraRepository from "../infrastructure/camera.repository";
import { validate } from "../../../middlewares";
import { cameraSchema } from "../infrastructure/camera.schema";

const router = express.Router();

const controller = new CameraController(new CameraService(new CameraRepository));

router.post("/", validate(cameraSchema), controller.createCamera);
router.get("/", controller.getAllCameras)

export default router;
