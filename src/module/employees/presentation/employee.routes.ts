import express from "express";
import { validate, validateQuery } from "../../../middlewares";
import EmployeeController from "./employee.controller";
import createEmployeeSchema, { createEmployeeFromUnknownSchema } from "../validations/employee.schema";
import uploadFaces, { multerErrorHandler, multerSingleFaceErrorHandler, uploadFace } from "../middlewares/multer";
import employeeQuerySchema from "../middlewares/employeeQuerySchema";

const router = express.Router();    
const controller = new EmployeeController();

router.post("/", uploadFaces, multerErrorHandler, validate(createEmployeeSchema), controller.createEmployee);
router.get("/", validateQuery(employeeQuerySchema), controller.findAllEmployees);

// unknown to known
router.post("/promote", uploadFace, multerSingleFaceErrorHandler, validate(createEmployeeFromUnknownSchema), controller.createEmployeeFromUnknown)

router.get("/embeddings", controller.findAllEmbeddings);


export default router;