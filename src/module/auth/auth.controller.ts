import { NextFunction, Request, Response } from "express";
import { AuthService, authService } from "./auth.module";
import { ApiResponse } from "../../utils";
import { StatusCodes } from "http-status-codes";

class AuthController {
    authService: AuthService;
    constructor() {
        this.authService = authService;
    }
    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { username, password } = req.body;
            const { tokens, user } = await this.authService.login(username, password);
            res.cookie("accessToken", tokens.accessToken, { httpOnly: true, sameSite: "none", secure: true });
            res.cookie("refreshToken", tokens.refreshToken, { httpOnly: true, sameSite: "none", secure: true });
            return ApiResponse.success(res, "Login successful", { user });
        } catch (error) {
            return next(error);
        }
    }

    refresh = async (req:Request, res:Response, next:NextFunction) => {
        try {
            const { refreshToken } = req.cookies;
            if(!refreshToken){
                return ApiResponse.error(res, "Unauthorized", StatusCodes.UNAUTHORIZED);
            }
            const { tokens, user } = await this.authService.refresh(refreshToken);

            res.cookie("accessToken", tokens.accessToken, { httpOnly: true, sameSite: "none", secure: true });
            res.cookie("refreshToken", tokens.refreshToken, { httpOnly: true, sameSite: "none", secure: true });
            return ApiResponse.success(res, "Both tokens updated successfully");
        } catch (error) {
            return next(error);
        }
    }

    me = async (req: Request, res: Response, next: NextFunction) => {
        try {
        const cookies = req.cookies;
        const { accessToken } = cookies;
        if (!accessToken) {
            return ApiResponse.error(res, "Unauthorized", StatusCodes.UNAUTHORIZED);
        }
        const user = await this.authService.me(accessToken); 
        return ApiResponse.success(res, "User fetched successfully", user);
        } catch (error) {
            return next(error);
        }
    }

    logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.clearCookie("accessToken", { httpOnly: true, sameSite: "none", secure: true });
            res.clearCookie("refreshToken", { httpOnly: true, sameSite: "none", secure: true });
            return ApiResponse.success(res, "Logged out successfully");
        } catch (error) {
            return next(error);
        }
    }
}

export default AuthController;