import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../../utils";
import { Employee } from "../domain/employee.entity";
import { IEmployeeRepository } from "../infrastructure/IEmployeeRepository";
import { CreateEmployeeDTO } from "./dtos/CreateEmployeeDTO";
import EmployeeEmbeddingService from "../infrastructure/employee.embedding.service";
import MinioService from "../../shared/minio/minio.service";
import { EmployeeMinioService } from "../infrastructure/employess.minio.service";
import { envConfig } from "../../../config";
import { EventBus, EventNames } from "../../../events";

export class EmployeeService {
  private embeddingService: EmployeeEmbeddingService;
  private employeeMinioService: EmployeeMinioService;

  constructor(private repo: IEmployeeRepository, private minioClient: any) {
    // Initialize embedding service
    this.embeddingService = new EmployeeEmbeddingService(envConfig.embeddingApiUrl);

    // Initialize employee-specific MinIO upload service
    this.employeeMinioService = new EmployeeMinioService(new MinioService(this.minioClient));
  }

  async createEmployee(dto: CreateEmployeeDTO, files: Express.Multer.File[]) {
    if (!files || files.length < 3) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "At least three face image is required", [
        { field: "faces", message: "Upload at least three image" },
      ]);
    }
    const exists = await this.repo.findByEmail(dto.email);
    if (exists) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Employee with email already exists",
        [{ field: "email", message: "Employee with email already exists" }]
      );
    }

    const embeddings = await this.embeddingService.generateEmbeddingsForEmployee(files);

    dto.embeddings = embeddings.raw_embeddings;   // raw vectors array
    dto.meanEmbedding = embeddings.mean_embedding; // single embedding vector

    const uploadedKeys = await this.employeeMinioService.uploadEmployeeImages(
      dto.name,
      files
    );

    dto.faceImages = uploadedKeys;

    const employee = new Employee(dto);
    console.log("Created employee", employee)
    
    const saved = this.repo.save(employee);
    console.log("Saved employee", employee)
    EventBus.emit(EventNames.EMPLOYEE_CREATED, saved);

    return saved;
  }

  async findAllEmbeddings() {
    return this.repo.findAllEmbeddings();
  }
}
