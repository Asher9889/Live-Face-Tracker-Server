import { NextFunction, Request, Response } from "express";
import { EmployeeService } from "../application/employee.service";
import { ApiResponse } from "../../../utils";
import { StatusCodes } from "http-status-codes";
import { CreateEmployeeDTO } from "../application/dtos/CreateEmployeeDTO";
import { employeeService } from "../../shared/minio/minio.client";

export default class EmployeeController {
    private employeeService: EmployeeService;

    constructor() {
        this.employeeService = employeeService;
        this.createEmployee = this.createEmployee.bind(this);
        this.findAllEmbeddings = this.findAllEmbeddings.bind(this);
    }
    
    async createEmployee(req: Request, res: Response, next: NextFunction) {
        try {
            const dto: CreateEmployeeDTO = {
                name: req.body.name,
                email: req.body.email,
                department: req.body.department,
                role: req.body.role,
                faceImages: [],
                meanEmbedding: [],
                embeddings: []
            };

            const employee = await this.employeeService.createEmployee(dto, req.files as Express.Multer.File[]);
            return ApiResponse.success(res, "Employee created successfully", employee, StatusCodes.CREATED )
        } catch (error) {
            console.log("error is:", error)
            return next(error);
        }
    }

    async findAllEmbeddings(req: Request, res: Response, next: NextFunction) {
        try {
            const embeddings = await this.employeeService.findAllEmbeddings();
            return ApiResponse.success(res, "Embeddings fetched successfully", embeddings, StatusCodes.OK)
        } catch (error) {
            console.log("error is:", error)
            return next(error);
        }
    }
}