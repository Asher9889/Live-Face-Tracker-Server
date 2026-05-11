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
import { ObjectId } from "mongodb";
import { TCreateEmployeeFromUnknownDTO } from "../validations/employee.schema";
import { UnknownIdentityModel } from "../../unknown/unknown-identity.model";
import EmployeeModel from "../infrastructure/employee.model";
import axios from "axios";
import mongoose from "mongoose";

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

    if (!embeddings.success) {
      throw new ApiError(StatusCodes.BAD_REQUEST, embeddings.message, [
        { field: "faces", message: "Failed to generate embeddings for the uploaded images" },
      ]);
    }

    dto.embeddings = embeddings.raw_embeddings;   // raw vectors array
    dto.meanEmbedding = embeddings.mean_embedding; // single embedding vector

    const uploadedKeys = await this.employeeMinioService.uploadEmployeeImages(
      dto.name,
      files
    );

    dto.faceImages = uploadedKeys;

    const employee = new Employee(dto);
    const saved = await this.repo.save(employee);
    EventBus.emit(EventNames.EMPLOYEE_CREATED, saved);

    return saved;
  }

  async findAllEmployees(query: { limit: number, cursor?: string }): Promise<{ data: any[], hasMore: boolean, cursor: string | null }> {
    const { limit, cursor } = query;

    const queryFilter: any = {};

    if (cursor) {
      queryFilter._id = { $lt: new ObjectId(cursor) };
    }

    const docs = await this.repo.findAll({
      filter: queryFilter,
      limit: limit + 1, // fetch extra for hasMore
      sort: { _id: -1 },
    });

    const hasMore = docs.length > limit;
    const data = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore ? data?.[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      cursor: nextCursor || null,
    };
  }

  async findAllEmbeddings() {
    return this.repo.findAllEmbeddings();
  }

  async getEmployeeProfileById(employeeId: string) {
    const employee = await this.repo.findById(employeeId);
    if (!employee) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Employee not found", [{ field: "employeeId", message: "Employee not found" }]);
    }

    return {
      id: employee.id,
      employeeCode: `EMP-${employee.id.slice(-4).toUpperCase()}`,
      name: employee.name,
      department: employee.department,
      role: employee.role,
      email: employee.email,
      avatar: employee.faceImages?.[0] ?? null,
      joinDate: null,
      status: "ACTIVE",
    };
  }

  async createEmployeeFromUnknown(dto: TCreateEmployeeFromUnknownDTO, file: Express.Multer.File | null = null) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const unknown = await UnknownIdentityModel.findById(dto.unknownId).session(session);

      if (!unknown) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Unknown identity not found", [{ field: "unknownId", message: "Unknown identity not found" }]);
      }
      if (unknown.status === "converted") {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Already converted");
      }

      // check is employee registered with same embeddings?
      const isMatch = await axios.post(envConfig.unknownMatchWithExistingApiUrl, {
        embedding: unknown?.representativeEmbedding,
        threshold: 0.40
      });

      if (isMatch.data.isDuplicate) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Employee with same embeddings already exists", isMatch.data);
      }
      let uploadedKeys;
      if (file) {
        uploadedKeys = await this.employeeMinioService.uploadEmployeeImages(dto.name, [file]);
      }

      const employee = await EmployeeModel.create({
        name: dto.name,
        email: dto.email,
        department: dto.department,
        role: dto.role,
        faceImages: uploadedKeys ?? [unknown.representativeImageKey],
        meanEmbedding: unknown.representativeEmbedding,
      });

      unknown.status = "converted";
      await unknown.save({ session });

      // await UnknownIdentityModel.findByIdAndUpdate(dto.unknownId, { status: "converted" }).session(session);

      const promoted = await axios.post(envConfig.unknownPromoteApiUrl, {
        unknownId: dto.unknownId,
        employeeId: employee._id.toString(),
        employeeName: dto.name,
        embedding: unknown?.representativeEmbedding
      });

      if (!promoted.data.success) {
        throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to promote unknown to employee due to AI Server error");
      }
      session.commitTransaction();
      return employee;
    } catch (error) {
      session.abortTransaction();
      throw error;
    }
  }
  async getEmployeeNotificationData(employeeId: string) {
    // $slice: 3 it means returns first 3 images from faceImages array. returns data type is array.
    const data = await EmployeeModel.findOne({ _id: employeeId }, { name: 1, role: 1, department: 1, faceImages: { $slice: 1 } }).lean();
    if (!data) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Employee not found", [{ field: "employeeId", message: "Employee not found" }]);
    }
    return {
      id: employeeId,
      name: data.name,
      role: data.role,
      department: data.department,
      avatar: (data.faceImages?.[0]) ? "https://minio.mssplonline.in/" + "facevision/" + data.faceImages[0] : null,
    }
  }

  async searchEmployees(name: string) {
    try {
      const results = await EmployeeModel.find({ name: { $regex: name, $options: "i" } }, { name: 1, department: 1, role: 1, _id: 1 }).lean();
      const employees = results.map(emp => ({
        id: emp._id.toString(),
        name: emp.name,
        department: emp.department,
        role: emp.role
      }));
      return employees;
    } catch (error) {
       throw error;
    }
  }
}
