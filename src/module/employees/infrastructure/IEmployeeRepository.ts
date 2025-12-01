import { Employee } from "../domain/employee.entity";

export interface IEmployeeRepository {
  save(employee: Employee): Promise<Employee>;
  findByEmail(email: string): Promise<Employee | null>;
//   findAll(): Promise<Employee[]>;
//   findById(id: string): Promise<Employee | null>;
//   update(id: string, data: Partial<Employee>): Promise<Employee | null>;
//   delete(id: string): Promise<void>;
}
