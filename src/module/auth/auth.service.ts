import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../utils";
import Auth from "./auth.model";
import jwt, { JwtPayload } from "jsonwebtoken";
import { envConfig } from "../../config";
import { AccessTokenPayload, ITokens, RefreshTokenPayload } from "./auth.types";

class AuthService {
    login = async (username: string, password: string) => {
        try {
            const user = await Auth.findOne({ username }).select("+password")
            if(!user){
                throw new ApiError(StatusCodes.BAD_REQUEST, "No Account found. Please register first or user correct credentials.");
            }

            const isPasswordValid = await user.comparePassword(password);
            if(!isPasswordValid){
                throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid password or username");
            }

            const tokens = user.generateTokens({ id: user._id.toJSON(), role: user.role });

            const userObj = user.toObject();
            const { _id, password: _, ...rest } = userObj;

            const safeUser = { id: _id.toString(), ...rest };
            
            return { tokens, user: safeUser };

        } catch (error) {
            throw error;
        }
    }

    refresh = async (refresToken: string): Promise<{tokens: ITokens, user: Record<string, any>}> => {
        try {
            const decodedToken = jwt.verify(refresToken, envConfig.refreshSecret) as JwtPayload & RefreshTokenPayload;
            const user = await Auth.findById(decodedToken.id);
            if(!user){
                throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found. Please login again.");
            }
            const tokens = user.generateTokens({id: user._id.toString(), role: user.role});

            const userObj = user.toObject();
            const { _id, password, ...rest } = userObj;
            const safeUser = { id: _id.toString(), ...rest };

            return { tokens, user: safeUser };
        } catch (error) {
            throw error;
        }
    }

    me = async (accessToken: string) => {
        try {
            const decodedToken = jwt.verify(accessToken, envConfig.accessSecret) as JwtPayload & AccessTokenPayload;
            const user = await Auth.findById(decodedToken.id).lean();
            if(!user){
                throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found. Please login again.");
            }
            const {password, _id, ...rest} = user;
            const safeUser = { id: _id.toString(), ...rest };
            return { user: safeUser };
        } catch (error:any) {
            if(error.name === "TokenExpiredError"){
                throw new ApiError(StatusCodes.UNAUTHORIZED, "Token expired. Please login again.");
            }
            if(error.name === "JsonWebTokenError"){
                throw new ApiError(StatusCodes.UNAUTHORIZED, "Token Invalid. Please login again.");
            }
            throw error;
        }
    }
}

export default AuthService;