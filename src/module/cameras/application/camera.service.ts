import Camera from "../domain/camera.entity";
import CameraRepository from "../infrastructure/camera.repository";
import { CreateCameraDTO } from "./dtos/CreateCameraDTO";

export default class CameraService {
    private repo: CameraRepository;
    constructor(repo: CameraRepository){
        this.repo = repo;
    }

    async createCamera(cameraDTO: CreateCameraDTO){
        const camera = new Camera(cameraDTO);
        return this.repo.save(camera);
    }
    
}