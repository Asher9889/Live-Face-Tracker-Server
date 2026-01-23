import z from "zod";


const employeeQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    cursor: z.string().optional(),
})

export default employeeQuerySchema