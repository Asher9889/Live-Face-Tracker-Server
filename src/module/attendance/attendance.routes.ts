import express from "express";
import { attendanceController } from "./attendance.module";
import { validate, validateQuery } from "../../middlewares";
import {
	attendanceDateQuerySchema,
	attendanceCalendarQuerySchema,
	attendanceEmployeeExportQuerySchema,
	attendanceEmployeeSummaryQuerySchema,
	attendanceEmployeeTimelineQuerySchema,
	reportsSummaryQuerySchema,
	reportsRowsQuerySchema,
	reportsExportBodySchema,
	attendanceEventsQuerySchema,
	attendanceRangeQuerySchema,
	attendanceCurrentStateQuerySchema,
	attendanceEmployeeSessionQuerySchema,
} from "./attendance.validation";

const router = express.Router();

router.get("/today/:employeeId", validateQuery(attendanceEmployeeSessionQuerySchema), attendanceController.getEmployeeTodayAttendanceSession);
router.get("/employees/:employeeId/session", validateQuery(attendanceEmployeeSessionQuerySchema), attendanceController.getEmployeeTodayAttendanceSession);
router.get("/current-state", validateQuery(attendanceCurrentStateQuerySchema), attendanceController.getCurrentState);
router.get("/date", validateQuery(attendanceDateQuerySchema), attendanceController.getAttendanceByDate);
router.get("/range", validateQuery(attendanceRangeQuerySchema), attendanceController.getAttendanceByRange);
router.get("/events", validateQuery(attendanceEventsQuerySchema), attendanceController.getAllAttendenceEvents);
router.get("/employees/:employeeId/timeline", validateQuery(attendanceEmployeeTimelineQuerySchema), attendanceController.getEmployeeTimelineByDate);
router.get("/reports/employees/:employeeId/timeline", validateQuery(attendanceEmployeeTimelineQuerySchema), attendanceController.getReportsEmployeeTimeline);
router.get("/employees/:employeeId/summary", validateQuery(attendanceEmployeeSummaryQuerySchema), attendanceController.getEmployeeMonthlySummary);
router.get("/reports/summary", validateQuery(reportsSummaryQuerySchema), attendanceController.getReportsSummary);
router.get("/reports/rows", validateQuery(reportsRowsQuerySchema), attendanceController.getReportsRows);
router.get("/employees/:employeeId/calendar", validateQuery(attendanceCalendarQuerySchema), attendanceController.getEmployeeCalendarByMonth);
router.get("/employees/:employeeId/export", validateQuery(attendanceEmployeeExportQuerySchema), attendanceController.exportEmployeeHistory);
router.get("/export-jobs/:jobId", attendanceController.getAttendanceExportJob);
router.post("/reports/export", validate(reportsExportBodySchema), (attendanceController as any).exportAttendanceReport);

export default router;
