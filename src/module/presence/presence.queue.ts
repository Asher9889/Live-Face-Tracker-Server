import { Queue } from "bullmq";

export const presenceQueueConnection = {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB),
    maxRetriesPerRequest: null,
};

const presenceQueue = new Queue("presence", {
    connection: presenceQueueConnection,
});

export default presenceQueue;