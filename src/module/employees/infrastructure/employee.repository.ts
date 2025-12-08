import EmployeeModel from "./employee.model";
import { Employee } from "../domain/employee.entity";
import { IEmployeeRepository } from "./IEmployeeRepository";

export class EmployeeRepository implements IEmployeeRepository {

  async save(employee: Employee): Promise<Employee> {
    const doc = await EmployeeModel.create(employee);
    return this.map(doc);
  }

  async findByEmail(email: string) {
    const doc = await EmployeeModel.findOne({ email });
    return doc ? this.map(doc) : null;
  }

  private map(doc: any):Employee {
    return new Employee({
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
