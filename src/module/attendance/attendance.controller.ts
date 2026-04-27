import { Request, Response } from "express";
import { CustomRequest } from "../../types/express";
import { attendanceService } from "./attendance.module";
import { ApiError, ApiResponse } from "../../utils";
import { StatusCodes } from "http-status-codes";
import {
    AttendanceDateQueryDTO,
    AttendanceEmployeeCalendarQueryDTO,
    AttendanceEmployeeExportQueryDTO,
    AttendanceEmployeeSummaryQueryDTO,
    AttendanceEmployeeTimelineQueryDTO,
    AttendanceRangeQueryDTO,
    AttendanceEventsQueryDTO,
    AttendanceCurrentStateQueryDTO,
    AttendanceEmployeeSessionQueryDTO,
} from "./attendance.types";


export default class AttendanceController {


    getAllAttendenceEvents = async (req: CustomRequest<AttendanceEventsQueryDTO>, res: Response): Promise<Response> => {
        try {
            const query = req.validatedQuery;
            if (!query) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);
            const data = await attendanceService.getAttendanceEvents(query);
            return ApiResponse.success(res, "Attendance records retrieved successfully", data, StatusCodes.OK)
        } catch (error) {
            throw error;
        }
    }

    getAttendanceByDate = async (req: CustomRequest<AttendanceDateQueryDTO>, res: Response): Promise<Response> => {
        try {
            const query = req.validatedQuery;
            if (!query) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);
            const data = await attendanceService.getAttendanceEventsByDate(query);
            return ApiResponse.success(res, "Attendance records retrieved successfully", data, StatusCodes.OK);
        } catch (error) {
            throw error;
        }
    }

    getAttendanceByRange = async (req: CustomRequest<AttendanceRangeQueryDTO>, res: Response): Promise<Response> => {
        try {
            const query = req.validatedQuery;
            if (!query) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);
            const data = await attendanceService.getAttendanceEventsByRange(query);
            return ApiResponse.success(res, "Attendance records retrieved successfully", data, StatusCodes.OK);
        } catch (error) {
            throw error;
        }
    }

    getEmployeeTodayAttendanceSession = async (req: CustomRequest<AttendanceEmployeeSessionQueryDTO>, res: Response): Promise<Response> => {
        try {
            const { employeeId } = req.params;
            if (!employeeId) throw new ApiError(StatusCodes.BAD_REQUEST, "Employee ID is required", [{ field: "employeeId", message: "Employee ID is required" }]);
            const data = await attendanceService.getEmployeeTodayAttendanceSession(employeeId, req.validatedQuery);
            return ApiResponse.success(res, "Employee's today attendance fetched successfully", data, StatusCodes.OK)
        } catch (error) {
            throw error;
        }
    }

    getCurrentState = async (req: CustomRequest<AttendanceCurrentStateQueryDTO>, res: Response): Promise<Response> => {
        try {
            const query = req.validatedQuery;
            // allow empty query and default date to today in service
            const data = await (attendanceService as any).getCurrentState(query ?? {} as any);
            return ApiResponse.success(res, "Current present employees fetched successfully", data, StatusCodes.OK);
        } catch (error) {
            throw error;
        }
    }

    getEmployeeTimelineByDate = async (req: CustomRequest<AttendanceEmployeeTimelineQueryDTO>, res: Response): Promise<Response> => {
        const { employeeId } = req.params;
        if (!employeeId) throw new ApiError(StatusCodes.BAD_REQUEST, "Employee ID is required", [{ field: "employeeId", message: "Employee ID is required" }]);
        if (!req.validatedQuery) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);

        const data = await attendanceService.getEmployeeTimelineByDate(employeeId, req.validatedQuery);
        return ApiResponse.success(res, "Employee timeline fetched successfully", data, StatusCodes.OK);
    }

    getEmployeeMonthlySummary = async (req: CustomRequest<AttendanceEmployeeSummaryQueryDTO>, res: Response): Promise<Response> => {
        const { employeeId } = req.params;
        if (!employeeId) throw new ApiError(StatusCodes.BAD_REQUEST, "Employee ID is required", [{ field: "employeeId", message: "Employee ID is required" }]);
        if (!req.validatedQuery) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);

        const data = await attendanceService.getEmployeeMonthlySummary(employeeId, req.validatedQuery);
        return ApiResponse.success(res, "Employee monthly summary fetched successfully", data, StatusCodes.OK);
    }

    getEmployeeCalendarByMonth = async (req: CustomRequest<AttendanceEmployeeCalendarQueryDTO>, res: Response): Promise<Response> => {
        const { employeeId } = req.params;
        if (!employeeId) throw new ApiError(StatusCodes.BAD_REQUEST, "Employee ID is required", [{ field: "employeeId", message: "Employee ID is required" }]);
        if (!req.validatedQuery) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);

        const data = await attendanceService.getEmployeeCalendarByMonth(employeeId, req.validatedQuery);
        return ApiResponse.success(res, "Employee monthly calendar fetched successfully", data, StatusCodes.OK);
    }

    exportEmployeeHistory = async (req: CustomRequest<AttendanceEmployeeExportQueryDTO>, res: Response): Promise<Response | void> => {
        const { employeeId } = req.params;
        if (!employeeId) throw new ApiError(StatusCodes.BAD_REQUEST, "Employee ID is required", [{ field: "employeeId", message: "Employee ID is required" }]);
        if (!req.validatedQuery) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);

        const result = await attendanceService.exportEmployeeHistory(employeeId, req.validatedQuery);
        if (result.type === "file") {
            res.setHeader("Content-Type", result.mimeType ?? "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=\"${result.fileName}\"`);
            return res.status(StatusCodes.OK).send(result.content);
        }

        return ApiResponse.success(res, "Employee attendance export queued", result.data, StatusCodes.ACCEPTED);
    }

    getAttendanceExportJob = async (req: CustomRequest, res: Response): Promise<Response> => {
        const { jobId } = req.params;
        if (!jobId) throw new ApiError(StatusCodes.BAD_REQUEST, "Job ID is required", [{ field: "jobId", message: "Job ID is required" }]);

        const data = await attendanceService.getAttendanceExportJob(jobId);
        return ApiResponse.success(res, "Attendance export job fetched successfully", data, StatusCodes.OK);
    }
}