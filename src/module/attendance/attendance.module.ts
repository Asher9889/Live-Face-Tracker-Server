import AttendanceService from "./attendance.service";
import AttendanceController from "./attendance.controller";

const attendanceService = new AttendanceService();
const attendanceController = new AttendanceController();

export { attendanceService, attendanceController };