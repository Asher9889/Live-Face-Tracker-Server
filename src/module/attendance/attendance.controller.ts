import { Request, Response } from "express";
import { CustomRequest } from "../../types/express";
import { attendanceService } from "./attendance.module";
import { ApiError } from "../../utils";
import { StatusCodes } from "http-status-codes";


export default class AttendanceController {


    getAllAttendenceEvents = async (req:CustomRequest, res:Response) => {
        try {
            const query = req.validatedQuery;
            if(!query) throw new ApiError(StatusCodes.BAD_REQUEST, "Query params are required", [{field: "query", message: "Query params are required"}]);
            await attendanceService.getAttendanceEvents(query);
            
        } catch (error) {

        }
    }

}