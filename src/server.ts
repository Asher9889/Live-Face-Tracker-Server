import express from "express";
import cors from "cors";
import { connectMongoDB, connectRedis } from "./db";
import { envConfig } from "./config";
import { globalErrorHandler, routeNotExistsHandler } from "./utils";
import apiRouter from "./routes";
import http from "http";
import { initWSSStreaming, initCameraStatusSubscriber } from "./stream";
import initCameraBBoxSubscriber from "./stream/initCameraBBoxSubscriber";
import { initEventHandlers } from "./events/Event";
import loadCameraConfigsToRedis from "./module/cameras/infrastructure/camera.cache";
import { presenceController } from "./module/presence/presence.module";
import cookieParser from "cookie-parser";

connectMongoDB();
connectRedis();
loadCameraConfigsToRedis()
presenceController.recoverFromDBOnStartup();

const app = express();
const server = http.createServer(app);

const allowedOrigins = ["http://localhost:5173"]
app.use(cors({
    origin: function (origin, callback) {
        console.log("origins", origin)
        if(!origin){
            return callback(new Error("An origin is required"));
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, origin); // echo the origin
        }
        callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));

initEventHandlers(); // for internal event_emitter 
initWSSStreaming(server);
initCameraStatusSubscriber();
initCameraBBoxSubscriber();

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiRouter)

app.use(routeNotExistsHandler);
app.use(globalErrorHandler);

server.listen(envConfig.port, () => {
    console.log(`Server is running on port ${envConfig.port}`);
});
