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
    async getAllCamerasStatus(){
        return await this.repo.getAllStatus();
    }

    async updateCamera(cameraId: string, payload: Partial<CreateCameraDTO>){
        // pick allowed fields
        const allowed: any = {};
        const fields = [
            'name','role','gateType','location','rtspUrl','credentials','streamConfig','enabled','roi','wsStreamId','status'
        ];
        for(const f of fields) {
            if (Object.prototype.hasOwnProperty.call(payload, f)) allowed[f] = (payload as any)[f];
        }
        return await this.repo.update(cameraId, allowed as any);
    }
}