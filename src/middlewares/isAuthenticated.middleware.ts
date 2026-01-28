import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError, ApiResponse } from "../utils";
import jwt, { JwtPayload } from "jsonwebtoken";
import { envConfig } from "../config";
import { AccessTokenPayload } from "../module/auth/auth.types";
import { Auth } from "../module/auth";
import { CustomRequest } from "../types/express";

async function isAuthenticated(req: CustomRequest, res: Response, next: NextFunction) {

    const cookies = req.cookies;
    const { accessToken } = cookies;
    if (!accessToken) {
        return ApiResponse.error(res, "Please provide valid access token", StatusCodes.UNAUTHORIZED);
    };
    try {
        const decodedToken = jwt.verify(accessToken, envConfig.accessSecret) as JwtPayload & AccessTokenPayload;
        const user = await Auth.findById(decodedToken.id).select("-password").lean();
        if(!user){
            throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found. Please login again.");
        }
        req.user = user;
        next();
    } catch (error) {
        return next(error);
    }
}

export default isAuthenticated;