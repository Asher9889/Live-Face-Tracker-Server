import { TDepartment, TRole } from "../../domain/employee.constants";

export interface CreateEmployeeDTO {
  name: string;
  email: string;
  department: TDepartment;
  role: TRole;
  faceImages: string[];   // MinIO keys
}
