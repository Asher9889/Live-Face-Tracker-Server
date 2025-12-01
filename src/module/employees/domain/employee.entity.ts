import { TDepartment, TRole } from "./employee.constants";

export class Employee {
  name: string;
  email: string;
  image: string;
  department: TDepartment;
  role: TRole;

  constructor(props: {
    name: string;
    email: string;
    image: string;
    department: TDepartment;
    role: TRole;
  }) {
    this.name = props.name;
    this.email = props.email;
    this.image = props.image;
    this.department = props.department;
    this.role = props.role;

    this.validate();
  }

  private validate() {
    if (!this.email.includes("@")) {
      throw new Error("Invalid email");
    }
  }
}
