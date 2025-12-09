import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../../utils";
import Camera from "../domain/camera.entity";
import CameraRepository from "../infrastructure/camera.repository";
import { CreateCameraDTO } from "./dtos/CreateCameraDTO";

export default class CameraService {
    private repo: CameraRepository;
    constructor(repo: CameraRepository){
        this.repo = repo;
    }

    async createCamera(cameraDTO: CreateCameraDTO){
        const exists = await this.repo.findByCode(cameraDTO.code);
        if(exists){
            throw new ApiError(StatusCodes.BAD_REQUEST, "Camera with code already exists", [{ field: "code", message: "Camera with code already exists" }]);
        }
        const camera = new Camera(cameraDTO);
        return this.repo.save(camera);
    }
    async getAllCameras(){
        return await this.repo.getAll();
    }
}