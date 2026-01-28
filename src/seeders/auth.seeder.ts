import fs from "fs";
import path from "path";
import { Auth } from "../module/auth";
import mongoose from "mongoose";
import { envConfig } from "../config";

async function seedAuth(){
    try {
        const dbURL = envConfig.mongoDBUrl + "/" + envConfig.dbName
        await mongoose.connect(dbURL);
        const filePath = path.join(__dirname, "auth.json");
        const authJson = fs.readFileSync(filePath, {encoding: "utf-8"});
        const users = JSON.parse(authJson);
        console.log(users);
        for(const user of users){
            const { username, password, role } = user;
            const isUserExists = await Auth.findOne({ username });
            if(isUserExists){
                console.log(`User ${username} already exists`);
                continue;
            }
            const auth = new Auth({ username, password, role });
            await auth.save();
            console.log(`User ${username} seeded successfully`);
        }
        await mongoose.connection.close();
    } catch (error) {
        console.log(error);
    }
}

seedAuth();

export default seedAuth;