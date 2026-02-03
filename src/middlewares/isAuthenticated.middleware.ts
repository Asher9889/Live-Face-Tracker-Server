import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError, ApiResponse } from "../utils";
import jwt, { JwtPayload } from "jsonwebtoken";
import { envConfig } from "../config";
import { AccessTokenPayload, ServiceTokenPayload } from "../module/auth/auth.types";
import { Auth } from "../module/auth";
import { CustomRequest } from "../types/express";

// async function isAuthenticated(req: CustomRequest, res: Response, next: NextFunction) {
//     const cookies = req.cookies;
//     const { accessToken } = cookies;
//     if (!accessToken) {
//         return ApiResponse.error(res, "Please provide valid access token", StatusCodes.UNAUTHORIZED);
//     };
//     try {
//         const decodedToken = jwt.verify(accessToken, envConfig.accessSecret) as JwtPayload & AccessTokenPayload;
//         const user = await Auth.findById(decodedToken.id).select("-password").lean();
//         if(!user){
//             throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found. Please login again.");
//         }
//         req.user = user;
//         next();
//     } catch (error) {
//         return next(error);
//     }
// }

async function isAuthenticated(
  req: CustomRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let token: string | undefined;

    /* ---------------- Get token ---------------- */

    // Cookie token (React browser)
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    // Authorization header (Python service)
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return ApiResponse.error(
        res,
        "Please provide valid access token",
        StatusCodes.UNAUTHORIZED
      );
    }

    /* ====================================================
       1️⃣ Try USER TOKEN
    ==================================================== */

    try {
      const decodedUser = jwt.verify(
        token,
        envConfig.accessSecret
      ) as JwtPayload & AccessTokenPayload;

      const user = await Auth.findById(decodedUser.id)
        .select("-password")
        .lean();

      if (!user) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "User not found. Please login again."
        );
      }

      req.user = user;
      return next();
    } catch (_) {
      // ignore and try service token
    }

    /* ====================================================
       2️⃣ Try SERVICE TOKEN
    ==================================================== */

    try {
      const decodedService = jwt.verify(token, envConfig.serviceSecret) as JwtPayload & ServiceTokenPayload;

      if (decodedService.type === "service") {
        // req.service = decodedService.service;
        return next();
      }

      throw new Error("Invalid service token");
    } catch {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid token");
    }

  } catch (error) {
    return next(error);
  }
}


export default isAuthenticated;