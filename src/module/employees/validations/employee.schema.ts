import zod from "zod";
import { Departments, Roles } from "../domain/employee.constants";

const createEmployeeSchema = zod.object({
    name: zod.string().min(3).max(50),
    email: zod.email(),
    department: zod.enum(Object.values(Departments)),
    role: zod.enum(Object.values(Roles)),
});

export const createEmployeeFromUnknownSchema = zod.object({
    name: zod.string().min(2, "Name is required"),
    email: zod.email("Invalid email"),
    department: zod.string().min(1, "Department is required"),
    role: zod.string().min(1, "Role is required"),
    source: zod.literal("unknown"),
    unknownId: zod.string().min(1, "Unknown ID is required"),
})

export default createEmployeeSchema;
export type TCreateEmployeeSchema = zod.infer<typeof createEmployeeSchema>;
export type TCreateEmployeeFromUnknownDTO = zod.infer<typeof createEmployeeFromUnknownSchema>;
