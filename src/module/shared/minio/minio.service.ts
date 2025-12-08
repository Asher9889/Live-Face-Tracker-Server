import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export default class MinioService {
  constructor(protected client: S3Client) {}

  async upload(bucket: string, key: string, file: Express.Multer.File) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return key;
  }

  generateKey(prefix: string, originalName: string) {
    return `${prefix}/${Date.now()}_${originalName}`;
  }
}
