import express from "express";
import cors from "cors";
import { connectMongoDB, connectRedis } from "./db";
import { envConfig } from "./config";
import { globalErrorHandler, routeNotExistsHandler } from "./utils";
import apiRouter from "./routes";
import http from "http";
import { initWSSStreaming, initCameraStatusSubscriber } from "./stream";

connectMongoDB();
connectRedis();

const app = express();
const server = http.createServer(app);

initWSSStreaming(server);
initCameraStatusSubscriber();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/api", apiRouter)

app.use(routeNotExistsHandler);
app.use(globalErrorHandler);

server.listen(envConfig.port, () => {
    console.log(`Server is running on port ${envConfig.port}`);
});
