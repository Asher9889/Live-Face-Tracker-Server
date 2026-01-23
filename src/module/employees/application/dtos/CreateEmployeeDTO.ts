import { TDepartment, TRole } from "../../domain/employee.constants";

export interface CreateEmployeeDTO {
  name: string;
  email: string;
  department: TDepartment;
  role: TRole;
  faceImages: string[];   // MinIO keys
  meanEmbedding: number[];
  embeddings: number[][];
}

export interface EmployeeEmbeddingDTO {
  name: string;
  embeddings: number[][];
  meanEmbedding: number[];
}


export interface EmployeeListDTO {
  id: string;
  name: string;
  email: string;
  department: TDepartment;
  role: TRole;
}

export type EmployeeQueryDTO = {
  limit: number;
  cursor?: string;
}