import express from "express";
import uploadFaces, { multerErrorHandler, multerSingleFaceErrorHandler, uploadFace, uploadUnknownFaces, uploadUnknownFacesErrorHandler } from "../employees/middlewares/multer";
import { unknownController } from "./unknown.module";
import { createUnknownIdentityDTO, createUnknownPersonEventSchema, mergeUnknownSchema, createUnknownSchema, updateUnknownSchema } from "./unknown.schema";
import { validate } from "../../middlewares/validate.middleware";
import { AllowedPoses } from "../employees/domain/employee.constants";

const router = express.Router();

router.post("/event", uploadFaces, multerErrorHandler, validate(createUnknownSchema), unknownController.createUnknownEvent);
// For saving unknown events (appeaence)
router.post("/events", uploadFace, multerSingleFaceErrorHandler, validate(createUnknownPersonEventSchema), unknownController.createUnknownPersonEvents);
// For Creating new person identity
router.post("/", uploadUnknownFaces.any(), uploadUnknownFacesErrorHandler,  validate(createUnknownSchema), unknownController.createUnknownIdentity);
// For Updating existing identity with new appearance
router.patch("/:unknownId", uploadUnknownFaces.any(), uploadUnknownFacesErrorHandler, validate(updateUnknownSchema), unknownController.updateUnknownIdentity);

router.get("/persons", unknownController.getUnknownPersons);

router.get("/embeddings", unknownController.findAllEmbeddings);

// merge unknown
router.post("/merge", validate(mergeUnknownSchema), unknownController.mergeUnknown)

export default router;