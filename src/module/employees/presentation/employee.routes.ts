import express from "express";
import { validate } from "../../../middlewares";
import EmployeeController from "./employee.controller";
import createEmployeeSchema from "../validations/employee.schema";

const router = express.Router();    
const controller = new EmployeeController();

router.post("/", validate(createEmployeeSchema), controller.createEmployee);

router.get("/", (req, res) => {
    res.send("Hello World!");
})

router.put("/", (req, res) => {
    res.send("Hello World!");
})

router.delete("/", (req, res) => {
    res.send("Hello World!");
})

export default router;