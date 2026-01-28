import { Request } from "express";
import { AttendanceEventsQueryDTO, AttendenceQueryDTO } from "../module/attendance/attendance.types";
import { EmployeeQueryDTO } from "../module/employees/application/dtos/CreateEmployeeDTO";


export interface CustomRequest<TQuery = unknown, TBody = unknown, TParams = unknown, TUser = unknown> extends Request {
  validatedQuery?: TQuery;
  validatedBody?: TBody;
  validatedParams?: TParams;
  user?: TUser;
}

