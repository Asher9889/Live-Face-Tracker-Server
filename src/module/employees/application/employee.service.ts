import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../../utils";
import { Employee } from "../domain/employee.entity";
import { IEmployeeRepository } from "../infrastructure/IEmployeeRepository";
import { CreateEmployeeDTO } from "./dtos/CreateEmployeeDTO";

export class EmployeeService {
  constructor(private repo: IEmployeeRepository) {}

  async createEmployee(data: CreateEmployeeDTO) {
    const exists = await this.repo.findByEmail(data.email);
    
    if (exists) throw new ApiError(StatusCodes.BAD_REQUEST, "Employee with email already exists", [{field: "email", message: "Employee with email already exists"}]);

    const employee = new Employee(data);
    return this.repo.save(employee);
  }
}