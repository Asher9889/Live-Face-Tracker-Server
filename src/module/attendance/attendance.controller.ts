import { Request, Response } from "express";
import { CustomRequest } from "../../types/express";
import { attendanceService } from "./attendance.module";
import { ApiError, ApiResponse } from "../../utils";
import { StatusCodes } from "http-status-codes";
import { AttendanceEventsQueryDTO } from "./attendance.types";


export default class AttendanceController {


    getAllAttendenceEvents = async (req: CustomRequest<AttendanceEventsQueryDTO>, res: Response): Promise<Response> => {
        try {
            const query = req.validatedQuery;
            if (!query) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);
            const data = await attendanceService.getAttendanceEvents(query);
            return ApiResponse.success(res, "Today's presence fetched successfully", data, StatusCodes.OK)
        } catch (error) {
            throw error;
        }
    }

    getEmployeeTodayAttendanceSession = async (req: CustomRequest, res: Response): Promise<Response> => {
        try {
            const { employeeId } = req.params;
            if (!employeeId) throw new ApiError(StatusCodes.BAD_REQUEST, "Employee ID is required", [{ field: "employeeId", message: "Employee ID is required" }]);
            const data = await attendanceService.getEmployeeTodayAttendanceSession(employeeId);
            return ApiResponse.success(res, "Employee's today attendance fetched successfully", data, StatusCodes.OK)
        } catch (error) {
            throw error;
        }
    }
}