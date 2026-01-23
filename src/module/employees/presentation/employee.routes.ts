import express from "express";
import { validate, validateQuery } from "../../../middlewares";
import EmployeeController from "./employee.controller";
import createEmployeeSchema from "../validations/employee.schema";
import uploadFaces, { multerErrorHandler } from "../middlewares/multer";
import employeeQuerySchema from "../middlewares/employeeQuerySchema";

const router = express.Router();    
const controller = new EmployeeController();

router.post("/", uploadFaces, multerErrorHandler, validate(createEmployeeSchema), controller.createEmployee);
router.get("/", validateQuery(employeeQuerySchema), controller.findAllEmployees);

router.get("/embeddings", controller.findAllEmbeddings);


export default router;