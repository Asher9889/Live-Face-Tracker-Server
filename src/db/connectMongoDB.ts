import mongoose, { Connection } from "mongoose";
import { ApiError } from "../utils";
import { StatusCodes } from "http-status-codes";

// export const mongoUrl = `mongodb://${envConfig.mongoUser}:${envConfig.mongoPassword}@${envConfig.mongoHost}:${envConfig.mongoPort}/${envConfig.dbName}?authSource=${envConfig.mongoAuthSource}`;
export const mongoUrl = "mongodb://160.25.62.109:8109/faceTracker_dev_db";

async function connectMongoDB(): Promise<Connection | undefined> {
    try {
        
        await mongoose.connect(mongoUrl);
        const connection = mongoose.connection;
        console.log(`MongoDB connected to ${connection.name} database`);
        return connection;
    } catch (error) {
        throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to connect to MongoDb");
    }
}

// // For seeders
// export async function connectDB(uri: string) {
//   if (!uri) throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "MONGO_URI not defined");
//   await mongoose.connect(uri);
//   console.log("✅ Connected to MongoDB");
// }

// // For seeders
// export async function disconnectDB() {
//   await mongoose.disconnect();
//   console.log("🔌 Disconnected from MongoDB");
// }

mongoose.connection.on("connecting", () => {
    console.log("trying to connect");
});

mongoose.connection.on("connected", () => {
    console.log("Successfully connected");
});

mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
});

process.on("SIGINT", async () => {
    await mongoose.connection.close();
    process.exit(0);
});

export default connectMongoDB;