import express from "express";
import { validate } from "../../../middlewares";
import EmployeeController from "./employee.controller";
import createEmployeeSchema from "../validations/employee.schema";
import uploadFaces, { multerErrorHandler } from "../middlewares/multer";

const router = express.Router();    
const controller = new EmployeeController();

router.post("/", uploadFaces, multerErrorHandler, validate(createEmployeeSchema), controller.createEmployee);
router.get("/", controller.findAllEmployees);

router.get("/embeddings", controller.findAllEmbeddings);


export default router;