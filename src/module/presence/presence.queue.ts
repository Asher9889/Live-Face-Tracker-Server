import { Queue } from "bullmq";
import { redisConfig } from "../../db/connectRedis";

const presenceQueue = new Queue("presence", {
    connection: redisConfig,
});

export default presenceQueue;