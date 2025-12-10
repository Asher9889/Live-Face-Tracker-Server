import Redis from "ioredis";
import { envConfig } from "../config";

const redis = new Redis({
    host: envConfig.redisHost,
    port: envConfig.redisPort,
    password: envConfig.redisPassword,
    db: envConfig.redisDb,
});

export function connectRedis(){
    redis.on("connect", () => {
        console.log("Redis connected on port", envConfig.redisPort);
    });
    redis.on("error", (err) => {
        console.log("Redis error:", err);
    });
}
export default redis;
