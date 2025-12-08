import zod from "zod";
import { Departments, Roles } from "../domain/employee.constants";

const createEmployeeSchema = zod.object({
    name: zod.string().min(3).max(50),
    email: zod.email(),
    department: zod.enum(Object.values(Departments)),
    role: zod.enum(Object.values(Roles)),
});

export default createEmployeeSchema;
export type TCreateEmployeeSchema = zod.infer<typeof createEmployeeSchema>;
