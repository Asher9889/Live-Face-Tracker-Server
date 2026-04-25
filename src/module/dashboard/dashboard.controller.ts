import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError, ApiResponse } from "../../utils";
import DashboardService from "./dashboard.service";
import { CustomRequest } from "../../types/express";
import { DashboardAttendanceSummaryQueryDTO } from "./dashboard.types";

export default class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    getAttendanceSummary = async (req: CustomRequest<DashboardAttendanceSummaryQueryDTO>, res: Response, next: NextFunction) => {
        try {
            if (!req.validatedQuery) {
                throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{ field: "query", message: "Query params are required" }]);
            }

            const data = await this.dashboardService.getAttendanceSummary(req.validatedQuery);
            return ApiResponse.success(res, "Attendance summary fetched successfully", data, StatusCodes.OK);
        } catch (error) {
            return next(error);
        }
    };
}