import dotenv from "dotenv";
import { IEnv } from "../interfaces/env.interface";

dotenv.config();


const envConfig: IEnv = {
    port: Number(process.env.PORT),
    nodeEnv: process.env.NODE_ENV || "development",
    
    mongoUser: process.env.MONGO_USER || "",
    mongoPassword: process.env.MONGO_PASSWORD || "",
    mongoHost: process.env.MONGO_HOST || "localhost",
    mongoPort: process.env.MONGO_PORT || "27017",
    mongoAuthSource: process.env.MONGO_AUTHSOURCE || "admin",
    // Build URL dynamically if not provided directly
    dbName: process.env.MONGO_DBNAME || "",
    accessSecret: process.env.JWT_ACCESS_SECRET || "test",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "test",

    // Hostinger
    gmailWebMailHost: process.env.GMAIL_WEB_MAIL_HOST!!,
    gmailWebMailPort: Number(process.env.GMAIL_WEB_MAIL_PORT) || 465,
    gmailWebMailUser: process.env.GMAIL_WEB_MAIL_USER!!,
    gmailWebMailPass: process.env.GMAIL_WEB_MAIL_PASS!!,

    // Client Email
    clientEmail: process.env.CLIENT_EMAIL || "",

    //
    enquiryN8NWebhookUrl: process.env.N8N_ENQUIRY || "",

    // Multer Employee
    employeeImageMaxCount: Number(process.env.EMPLOYEE_IMAGE_MAX_COUNT),
    employeeImageMaxSize: Number(process.env.EMPLOYEE_IMAGE_MAX_SIZE),

    //minio
    minioEndpoint: process.env.MINIO_ENDPOINT!!,
    minioAccessKey: process.env.MINIO_ACCESS_KEY!!,
    minioSecretKey: process.env.MINIO_SECRET_KEY!!,
    minioEmployeeBucketName: process.env.MINIO_EMPLOYEE_BUCKET_NAME!!,

    // embedding
    embeddingApiUrl: process.env.EMBEDDING_API_URL!!,

    // Redis
    redisHost: process.env.REDIS_HOST!!,
    redisPort: Number(process.env.REDIS_PORT)!!,
    redisPassword: process.env.REDIS_PASSWORD!!,
    redisDb: Number(process.env.REDIS_DB)!!,

    // LiveKit
    liveKitIngressHost: process.env.LIVEKIT_INGRESS_HOST!!,
    liveKitApiSecret: process.env.LIVEKIT_API_SECRET!!,
    liveKitApiKey: process.env.LIVEKIT_API_KEY!!,
    

};

export default envConfig;