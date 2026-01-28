import express from "express";
import uploadFaces, { multerErrorHandler } from "../employees/middlewares/multer";
import { unknownController } from "./unknown.module";
import createUnknownSchema from "./unknown.schema";
import { validate } from "../../middlewares/validate.middleware";

const router = express.Router();

router.post("/", uploadFaces, multerErrorHandler, validate(createUnknownSchema), unknownController.createUnknownEvent);

export default router;