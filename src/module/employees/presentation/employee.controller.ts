import { NextFunction, Request, Response } from "express";
import { EmployeeService } from "../application/employee.service";
import { EmployeeRepository } from "../infrastructure/employee.repository";
import { ApiResponse } from "../../../utils";
import { StatusCodes } from "http-status-codes";
import { CreateEmployeeDTO } from "../application/dtos/CreateEmployeeDTO";
import { MinioService } from "../../shared/minio/minio.service";
import { envConfig } from "../../../config";

export default class EmployeeController {
    private employeeService: EmployeeService;

    constructor() {
        this.employeeService = new EmployeeService(new EmployeeRepository());
        this.createEmployee = this.createEmployee.bind(this);
    }
    
    async createEmployee(req: Request, res: Response, next: NextFunction) {
        try {
            console.log("Call inside createEmployee")
            const data: CreateEmployeeDTO = {
                name: req.body.name,
                email: req.body.email,
                department: req.body.department,
                role: req.body.role,
                faceImages: [], // we fill this after MinIO upload
            };
            const bucket = envConfig.minioEmployeeBucketName;
            const prefix = `employees/${data.name.toLowerCase().split(" ").join("-")}`;
            const uploadedKeys: string[] = []; 

            for(const file of req.files as Express.Multer.File[]){
                const key = MinioService.generateKey(prefix, file.originalname);
                await MinioService.upload(bucket, key, file);
                uploadedKeys.push(key);
            }
            data.faceImages = uploadedKeys;

            const employee = await this.employeeService.createEmployee(data);
            return ApiResponse.success(res, "Employee created successfully", employee, StatusCodes.CREATED )
        } catch (error) {
            console.log("error is:", error)
            return next(error);
        }
    }
}