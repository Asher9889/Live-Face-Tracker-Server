import { NextFunction, Request, Response } from "express";
import { AuthService, authService } from "./auth.module";
import { ApiResponse } from "../../utils";

const cookieOptions = {
    httpOnly: true,
    path: "/",
}
class AuthController {
    authService: AuthService;
    constructor() {
        this.authService = authService;
    }
    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { username, password } = req.body;
            const { tokens, user } = await this.authService.login(username, password);
            res.cookie("accessToken", tokens.accessToken, { httpOnly: true });
            res.cookie("refreshToken", tokens.refreshToken, { httpOnly: true });
            return ApiResponse.success(res, "Login successful", { user });
        } catch (error) {
            return next(error);
        }
    }

    refresh = async (req:Request, res:Response, next:NextFunction) => {
        try {
            const { refreshToken } = req.cookies;
            // const { tokens, user } = await this.authService.refresh(refreshToken);
            // return ApiResponse.success(res, "Refresh successful", {tokens, user});
        } catch (error) {
            return next(error);
        }
    }
}

export default AuthController;