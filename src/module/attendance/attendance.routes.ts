import express from "express";
import { attendanceController } from "./attendance.module";
import { validateQuery } from "../../middlewares";
import { attendanceEventsQuerySchema } from "./attendance.validation";

const router = express.Router();

router.get("/events", validateQuery(attendanceEventsQuerySchema), attendanceController.getAllAttendenceEvents)

export default router;
