import express from "express";
import { connectMongoDB, connectRedis } from "./db";
import { envConfig } from "./config";
import { globalErrorHandler, routeNotExistsHandler } from "./utils";
import apiRouter from "./routes";
import http from "http";
import initStreaming from "./stream/initStream";
import { initEventHandlers } from "./events/Event";

const app = express();
const server = http.createServer(app);


connectMongoDB();
connectRedis();
initEventHandlers();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initStreaming(server);
app.use("/api", apiRouter)

app.use(routeNotExistsHandler);
app.use(globalErrorHandler);

server.listen(envConfig.port, () => {
    console.log(`Server is running on port ${envConfig.port}`);
});
