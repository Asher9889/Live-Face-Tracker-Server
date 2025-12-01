import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils";
import { StatusCodes } from "http-status-codes";
import { ZodObject } from "zod";

export const validate = (schema: ZodObject) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        console.log("result is:", result)
        const errors = result.error.issues.map((error) => ({ field: error.path[0], message: error.message }))
        throw new ApiError(StatusCodes.BAD_REQUEST, "Please provide valid data", errors);
    }
    next();
};