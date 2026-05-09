import Redis from "ioredis";
import { envConfig } from "../config";
import { logger } from "../utils";


const redisConfig = {
    host: envConfig.redisHost,
    port: envConfig.redisPort,
    password: envConfig.redisPassword,
    db: envConfig.redisDb,
    maxRetriesPerRequest: null,
};

const redis = new Redis(redisConfig);

export function connectRedis(){
    redis.on("connect", () => {
        logger.info( `Redis connected on port ${envConfig.redisPort}`);
    });
    redis.on("error", (err) => {
        logger.error({ error: err }, "Redis error");
    });
}

const redisSub = redis.duplicate(); // subscribe only
export default redis;  // commands + publish
export { redisSub, redisConfig };
