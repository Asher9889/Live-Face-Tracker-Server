import { NextFunction, Request, Response } from "express";
import { EmployeeService } from "../application/employee.service";
import { EmployeeRepository } from "../infrastructure/employee.repository";
import { ApiResponse } from "../../../utils";
import { StatusCodes } from "http-status-codes";

export default class EmployeeController {
    private employeeService: EmployeeService;

    constructor() {
        this.employeeService = new EmployeeService(new EmployeeRepository());
        this.createEmployee = this.createEmployee.bind(this);
    }
    
    async createEmployee(req: Request, res: Response, next: NextFunction) {
        try {
            const employee = await this.employeeService.createEmployee(req.body);
            return ApiResponse.success(res, "Employee created successfully", employee, StatusCodes.CREATED )
        } catch (error) {
            console.log("error is:", error)
            return next(error);
        }
    }
}