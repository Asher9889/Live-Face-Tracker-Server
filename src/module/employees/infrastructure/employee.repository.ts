import EmployeeModel from "./employee.model";
import { Employee } from "../domain/employee.entity";
import { IEmployeeRepository } from "./IEmployeeRepository";

export class EmployeeRepository implements IEmployeeRepository {

  async save(employee: Employee): Promise<Employee> {
    console.log("employee is:", employee)
    const doc = await EmployeeModel.create(employee);
    return this.map(doc);
  }

  async findByEmail(email: string) {
    const doc = await EmployeeModel.findOne({ email });
    return doc ? this.map(doc) : null;
  }

//   async findAll() {
//     const docs = await EmployeeModel.find();
//     return docs.map(d => this.map(d));
//   }

//   async findById(id: string) {
//     const doc = await EmployeeModel.findById(id);
//     return doc ? this.map(doc) : null;
//   }

//   async update(id: string, data: Partial<EmployeeModel>) {
//     const doc = await EmployeeModel.findByIdAndUpdate(id, data, { new: true });
//     return doc ? this.map(doc) : null;
//   }

//   async delete(id: string) {
//     await EmployeeModel.findByIdAndDelete(id);
//   }

  private map(doc: any):Employee {
    return new Employee({
      name: doc.name,
      email: doc.email,
      image: doc.image,
      department: doc.department,
      role: doc.role,
    });
  }
}
