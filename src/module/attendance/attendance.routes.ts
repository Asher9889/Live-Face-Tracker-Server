import express from "express";
import { attendanceController } from "./attendance.module";
import { validateQuery } from "../../middlewares";
import {
	attendanceDateQuerySchema,
	attendanceCalendarQuerySchema,
	attendanceEmployeeExportQuerySchema,
	attendanceEmployeeSummaryQuerySchema,
	attendanceEmployeeTimelineQuerySchema,
	attendanceEventsQuerySchema,
	attendanceRangeQuerySchema,
	attendanceCurrentStateQuerySchema,
	attendanceEmployeeSessionQuerySchema,
} from "./attendance.validation";

const router = express.Router();

router.get("/today/:employeeId", validateQuery(attendanceEmployeeSessionQuerySchema), attendanceController.getEmployeeTodayAttendanceSession);
router.get("/employees/:employeeId/session", validateQuery(attendanceEmployeeSessionQuerySchema), attendanceController.getEmployeeTodayAttendanceSession);
router.get("/current-state", validateQuery(attendanceCurrentStateQuerySchema), (attendanceController as any).getCurrentState);
router.get("/date", validateQuery(attendanceDateQuerySchema), attendanceController.getAttendanceByDate);
router.get("/range", validateQuery(attendanceRangeQuerySchema), attendanceController.getAttendanceByRange);
router.get("/events", validateQuery(attendanceEventsQuerySchema), attendanceController.getAllAttendenceEvents);
router.get("/employees/:employeeId/timeline", validateQuery(attendanceEmployeeTimelineQuerySchema), attendanceController.getEmployeeTimelineByDate);
router.get("/employees/:employeeId/summary", validateQuery(attendanceEmployeeSummaryQuerySchema), attendanceController.getEmployeeMonthlySummary);
router.get("/employees/:employeeId/calendar", validateQuery(attendanceCalendarQuerySchema), attendanceController.getEmployeeCalendarByMonth);
router.get("/employees/:employeeId/export", validateQuery(attendanceEmployeeExportQuerySchema), attendanceController.exportEmployeeHistory);
router.get("/export-jobs/:jobId", attendanceController.getAttendanceExportJob);

export default router;
