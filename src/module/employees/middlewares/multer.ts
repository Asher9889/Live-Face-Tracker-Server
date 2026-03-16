import multer from "multer";
import { envConfig } from "../../../config";
import { ApiError } from "../../../utils";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

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
      cb(new Error("Invalid file type")); // reject file
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
      cb(new Error("Invalid file type")); // reject file
    }
  },
}).single("face");

export function multerErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {

    // Field mismatch – common error
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        new ApiError(StatusCodes.BAD_REQUEST, "Unexpected file field", [
          { field: err.field, message: "Please send files under 'faces' field name" }
        ])
      );
    }

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


export default uploadFaces;