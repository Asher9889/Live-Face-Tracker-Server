import express from "express";
import uploadFaces, { multerErrorHandler, multerSingleFaceErrorHandler, uploadFace } from "../employees/middlewares/multer";
import { unknownController } from "./unknown.module";
import createUnknownSchema, { createUnknownIdentityDTO, createUnknownPersonEventSchema } from "./unknown.schema";
import { validate } from "../../middlewares/validate.middleware";

const router = express.Router();

router.post("/event", uploadFaces, multerErrorHandler, validate(createUnknownSchema), unknownController.createUnknownEvent);
// For saving unknown events (appeaence)
router.post("/events", uploadFace, multerSingleFaceErrorHandler, validate(createUnknownPersonEventSchema), unknownController.createUnknownEvent);
// For Creating new person identity
router.post("/", uploadFace, multerSingleFaceErrorHandler, validate(createUnknownIdentityDTO), unknownController.createUnknownIdentity);
router.get("/persons", unknownController.getUnknownPersons);

router.get("/embeddings", unknownController.findAllEmbeddings);

export default router;