import { TDepartment, TRole } from "./employee.constants";

export class Employee {
  name: string;
  email: string;
  department: TDepartment;
  role: TRole;
  faceImages: string[];
  embeddings: number[][];
  meanEmbedding: number[];

  constructor(props: {
    name: string;
    email: string;
    faceImages: string[];
    department: TDepartment;
    role: TRole;
    embeddings: number[][];
    meanEmbedding: number[];
  }) {
    this.name = props.name;
    this.email = props.email;
    this.faceImages = props.faceImages;
    this.department = props.department;
    this.role = props.role;
    this.embeddings = props.embeddings;
    this.meanEmbedding = props.meanEmbedding;
    this.validate();
  }

  private validate() {
    if (!this.email.includes("@")) {
      throw new Error("Invalid email");
    }
  }
}
