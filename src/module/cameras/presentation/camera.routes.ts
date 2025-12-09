import express from "express";
import CameraController from "./camera.controller";
import CameraService from "../application/camera.service";
import CameraRepository from "../infrastructure/camera.repository";

const router = express.Router();

const controller = new CameraController(new CameraService(new CameraRepository));

router.post("/", controller.createCamera);

export default router;
