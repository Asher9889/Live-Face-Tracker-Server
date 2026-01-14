import { Request } from "express";
import { AttendanceEventsQueryDTO, AttendenceQueryDTO } from "../module/attendance/attendance.types";

export interface CustomRequest extends Request {
  validatedQuery?: AttendanceEventsQueryDTO;
  validatedBody?: unknown;
  validatedParams?: unknown;
}
