import { PutObjectCommand } from "@aws-sdk/client-s3";
import minioClient from "./minio.client";

export class MinioService {
  static async upload(bucket: string, key: string, file: Express.Multer.File) {
    await minioClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return key;
  }

  static generateKey(prefix: string, originalName: string) {
    return `${prefix}/${Date.now()}_${originalName}`;
  }
}
