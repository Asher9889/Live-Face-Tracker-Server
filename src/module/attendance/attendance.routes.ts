import express from "express";
import { attendanceService, attendanceController } from "./attendance.module";

const router = express.Router();

router.get("/events", attendanceController.getAllAttendenceEvents)

export default router;
