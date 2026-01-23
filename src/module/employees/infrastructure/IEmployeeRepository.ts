import { EmployeeEmbeddingDTO, EmployeeListDTO } from "../application/dtos/CreateEmployeeDTO";
import { Employee } from "../domain/employee.entity";

export interface IEmployeeRepository {
  save(employee: Employee): Promise<Employee>;
  findByEmail(email: string): Promise<Employee | null>;
  findAllEmbeddings(): Promise<EmployeeEmbeddingDTO[]>;
  findAll({filter, limit, sort}: {filter?: Record<string, any>; limit: number; sort?: Record<string, 1 | -1>;}): Promise<EmployeeListDTO[]>;
//   generateEmbeddings(files: Express.Multer.File[]): Promise<string[]>;
//   findById(id: string): Promise<Employee | null>;
//   update(id: string, data: Partial<Employee>): Promise<Employee | null>;
//   delete(id: string): Promise<void>;
}
