import express from "express";
import uploadFaces, { multerErrorHandler, multerSingleFaceErrorHandler, uploadFace } from "../employees/middlewares/multer";
import { unknownController } from "./unknown.module";
import createUnknownSchema, { createUnknownIdentityDTO } from "./unknown.schema";
import { validate } from "../../middlewares/validate.middleware";

const router = express.Router();

router.post("/event", uploadFaces, multerErrorHandler, validate(createUnknownSchema), unknownController.createUnknownEvent);
router.post("/", uploadFace, multerSingleFaceErrorHandler, validate(createUnknownIdentityDTO), unknownController.createUnknownIdentity);
router.get("/persons", unknownController.getUnknownPersons);
// router.post("/", unknownController.createUnknown)

router.get("/embeddings", unknownController.findAllEmbeddings);
// router.post("/warmup", unknownController);
// router.post("/event", unknownController.createUnknownEvent);

export default router;