import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../utils";
import Auth from "./auth.model";

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
}

export default AuthService;