import { Request } from "express";
import { AttendenceQueryDTO } from "../module/attendance/attendance.types";

export interface CustomRequest extends Request {
  validatedQuery?: AttendenceQueryDTO;
  validatedBody?: unknown;
  validatedParams?: unknown;
}
