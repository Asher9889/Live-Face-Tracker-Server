import mongoose from "mongoose";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { envConfig } from "../../config";


interface IAuth extends mongoose.Document{
    username: string;
    password: string;
    role: string;
    comparePassword(password: string): Promise<boolean>;
    generateTokens(data: {id: string, role: string}): {accessToken: string, refreshToken: string};
}

const authSchema = new mongoose.Schema<IAuth>({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        enum: ["admin", "user"],
        default: "user"
    }
}, {versionKey: false, timestamps: true});

authSchema.pre("save", async function(){
   if(this.isModified("password")) {
    this.password = await argon2.hash(this.password);
   }
});

authSchema.methods.generateTokens = function(data: {id: string, role: string}){
    const accessToken = jwt.sign(data, envConfig.accessSecret, { expiresIn: envConfig.accessTokenMaxAge });
    const refreshToken = jwt.sign(data, envConfig.refreshSecret, { expiresIn: envConfig.refreshTokenMaxAge });
    return { accessToken, refreshToken };
}

authSchema.methods.comparePassword = async function(password: string){
    return await argon2.verify(this.password, password);
}

const Auth = mongoose.model<IAuth>("Auth", authSchema);

export default Auth;