import MinioService from "../../shared/minio/minio.service";
import { envConfig } from "../../../config";

export class EmployeeMinioService {
  constructor(private minio: MinioService) {}

  async uploadEmployeeImages(employeeName: string, files: Express.Multer.File[]) {
    const bucket = envConfig.minioEmployeeBucketName;
    const prefix = `employees/${employeeName.toLowerCase().replace(/\s+/g, "-")}`;

    const uploadedKeys: string[] = [];

    for (const file of files) {
      const key = this.minio.generateKey(prefix, file.originalname);
      await this.minio.upload(bucket, key, file);
      uploadedKeys.push(key);
    }

    return uploadedKeys; // <── NOT modifying dto here
  }
}
