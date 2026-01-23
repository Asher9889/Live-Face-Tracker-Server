import EmployeeModel from "./employee.model";
import { Employee } from "../domain/employee.entity";
import { IEmployeeRepository } from "./IEmployeeRepository";
import { EmployeeEmbeddingDTO, EmployeeListDTO } from "../application/dtos/CreateEmployeeDTO";
import { envConfig } from "../../../config";
import { ObjectId } from "mongodb";
export class EmployeeRepository implements IEmployeeRepository {
  async save(employee: Employee): Promise<Employee> {
    const doc = await EmployeeModel.create(employee);
    return this.map(doc);
  }

  async findByEmail(email: string) {
    const doc = await EmployeeModel.findOne({ email });
    return doc ? this.map(doc) : null;
  }

  async findAllEmbeddings() {
    const docs = await EmployeeModel.find({},{ name:1, meanEmbedding:1, embeddings: 1, id: 1, _id: 0 }).lean()
    return docs;
  }
 
  async findAll({filter, limit, sort}: {filter: any; limit: number; sort: Record<string, 1 | -1>;}): Promise<EmployeeListDTO[]> {
    
    const docs = await EmployeeModel.find(filter).limit(limit).sort(sort).lean();
    
    return docs.map(doc => ({
      id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      department: doc.department,
      role: doc.role,
      avatar: envConfig.minioEndpoint + '/' + envConfig.minioEmployeeBucketName + '/' + doc.faceImages[0]
    }));
  }
 
  private map(doc: any):Employee {
    return new Employee({
      id: doc.id!,
      name: doc.name,
      email: doc.email,
      department: doc.department,
      role: doc.role,
      faceImages: doc.faceImages,
      embeddings: doc.embeddings,
      meanEmbedding: doc.meanEmbedding,
    });
  }
}
