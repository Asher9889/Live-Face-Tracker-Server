import { TDepartment, TRole } from "../../domain/employee.constants";

export interface CreateEmployeeDTO {
  name: string;
  image: string;
  email: string;
  department: TDepartment;
  role: TRole;
}
