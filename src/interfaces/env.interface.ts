interface IEnv {
    port: number;
    nodeEnv: string;
    mongoUser: string;
    mongoPassword: string;
    mongoHost: string;
    mongoPort: string;
    mongoAuthSource: string;
    mongoDBUrl?: string;
    dbName: string;
    accessSecret: string;
    refreshSecret: string;
    gmailWebMailHost: string;
    gmailWebMailPort:number;
    gmailWebMailUser:string;
    gmailWebMailPass: string
    clientEmail: string;
    enquiryN8NWebhookUrl: string;

    employeeImageMaxCount: number;
    employeeImageMaxSize: number;

    // minio
    minioEndpoint: string;
    minioAccessKey: string;
    minioSecretKey: string;
    minioEmployeeBucketName: string;

    //
    embeddingApiUrl: string;

    // redis
    redisHost: string;
    redisPort: number;
    redisPassword: string;
    redisDb: number;

    // LiveKit
    liveKitIngressHost: string;
    liveKitApiSecret: string;
    liveKitApiKey: string;

    // Camera Status track
    watchdogInterval: number;
    offlineThreshold: number;
    
    // Duration parsing
    exitTimeoutAfterExitGate: number;
    exitTimeoutAfterEntryGate: number;
    
    // FFmpeg
    ffmpegPath: string;
    
    // Office time
    officeStartTime: number;
    officeEndTime: number;
}


export { type IEnv }
