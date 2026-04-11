import multer from "multer";
import { envConfig } from "../../../config";
import { ApiError } from "../../../utils";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AllowedPoses } from "../domain/employee.constants";

const uploadFaces = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: envConfig.employeeImageMaxCount,
    fileSize: envConfig.employeeImageMaxSize * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true); // accept file
    } else {
      return cb(new Error("Invalid file type")); // reject file
    }
  },
}).array("face", envConfig.employeeImageMaxCount);

export const uploadFace = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: envConfig.employeeImageMaxCount,
    fileSize: envConfig.employeeImageMaxSize * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true); // accept file
    } else {
      return cb(new Error("Invalid file type")); // reject file
    }
  },
}).single("face");

export function multerErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        new ApiError(StatusCodes.BAD_REQUEST, "Unexpected file field", [
          { field: err.field, message: "Please send file under 'face' field name" }
        ])
      );
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        new ApiError(StatusCodes.BAD_REQUEST, "File too large", [
          { field: "face", message: `Max file size allowed is ${envConfig.employeeImageMaxSize}MB` }
        ])
      );
    }

    return next(
      new ApiError(StatusCodes.BAD_REQUEST, "File upload error", [
        { field: "face", message: err.message }
      ])
    );

    // File too large, too many files, etc.
    return next(
      new ApiError(StatusCodes.BAD_REQUEST, err.message, [
        { field: "faces", message: err.message }
      ])
    );
  }

  // Other errors (e.g. wrong mimetype)
  if (err instanceof ApiError && err.message === "Invalid file type") {
    return next(
      new ApiError(StatusCodes.BAD_REQUEST, err.message, [
        { field: "faces", message: "Only JPG/PNG allowed" }
      ])
    );
  }

  next(err);
}

export function multerSingleFaceErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {

    // Field mismatch – common error
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        new ApiError(StatusCodes.BAD_REQUEST, "Unexpected file field", [
          { field: err.field, message: "Please send files under 'face' field name" }
        ])
      );
    }
    // File too large, too many files, etc.
    return next(
      new ApiError(StatusCodes.BAD_REQUEST, err.message, [
        { field: "face", message: err.message }
      ])
    );
  }
  // Other errors (e.g. wrong mimetype)
  if (err instanceof ApiError && err.message === "Invalid file type") {
    return next(
      new ApiError(StatusCodes.BAD_REQUEST, err.message, [
        { field: "face", message: "Only JPG/PNG allowed" }
      ])
    );
  }

  next(err);
}

/**
 * Points to remember
 * 1. originalname = file name uploaded by user
 * 2. fieldname = key in form-data
 */
const uploadUnknownFaces = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: envConfig.unknownImageMaxCount,
    fileSize: envConfig.unknownImageMaxSize * 1024 * 1024, // convert MB to bytes 5 * 1025 = 5120KB * 1024 = 5242880 bytes
  },
  fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
      cb(new Error("Invalid file type")); // reject file
    }

    if(!file.fieldname.startsWith("face_")){
      cb(new Error(`Invalid file field: ${file.fieldname}.`));
    }
    let pose = file.fieldname.replace("face_", "");

    if(!AllowedPoses.includes(pose)){
      cb(new Error(`Invalid file field: ${file.fieldname}. Allowed fields are ${Array.from(AllowedPoses).join(", ")}`));
    }
    console.log("Accepted file", file.fieldname, file.originalname);
    cb(null, true);
  }
});

function uploadUnknownFacesErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        new ApiError(StatusCodes.BAD_REQUEST, "Unexpected file field", [
          { field: err.field, message: err.message }
        ])
      );
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        new ApiError(StatusCodes.BAD_REQUEST, "File too large", [
          { field: err.field, message: err.message }
        ])
      );
    }

    return next(
      new ApiError(StatusCodes.BAD_REQUEST, "File upload error", [
        { field: err.field, message: err.message }
      ])
    );
  }

  // Other errors (e.g. wrong mimetype)
  if (err instanceof ApiError && err.message === "Invalid file type") {
    return next(
      new ApiError(StatusCodes.BAD_REQUEST, err.message, [
        { field: "files", message: "Only JPG/PNG allowed" }
      ])
    );
  }

  next(err);
}

export { uploadUnknownFaces, uploadUnknownFacesErrorHandler };

export default uploadFaces;