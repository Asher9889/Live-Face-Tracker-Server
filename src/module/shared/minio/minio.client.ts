import { S3Client } from "@aws-sdk/client-s3";
import { envConfig } from "../../../config";

const minioClient = new S3Client({
  region: "us-east-1",
  endpoint: envConfig.minioEndpoint,        // e.g. "http://160.25.62.109:9000"
  forcePathStyle: true,
  credentials: {
    accessKeyId: envConfig.minioAccessKey,
    secretAccessKey: envConfig.minioSecretKey,
  },
});

export default minioClient;