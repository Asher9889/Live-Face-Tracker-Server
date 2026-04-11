import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { minioClient } from "./minio.client";

export default class MinioService {
  constructor(protected client: S3Client = minioClient) {}

  async upload(bucket: string, key: string, file: Express.Multer.File) {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
  
      return key;
    } catch (error) {
      console.error(`[MinioService] Error uploading file to bucket=${bucket}, key=${key}:`, error);
      throw error;
    }
  }

  generateKey(prefix: string, originalName: string) {
    return `${prefix}/${Date.now()}_${originalName}`;
  }
}
