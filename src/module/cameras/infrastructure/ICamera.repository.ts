import { CameraStatusDTO } from "../application/dtos/CreateCameraDTO";
import Camera from "../domain/camera.entity";

export default interface ICameraRepository {
    save(camera: Camera): Promise<Camera>;
    getAll(): Promise<Camera[]>;
    getAllStatus(): Promise<CameraStatusDTO[]>;
    update(id: string, data: Partial<Camera>): Promise<any>;
}