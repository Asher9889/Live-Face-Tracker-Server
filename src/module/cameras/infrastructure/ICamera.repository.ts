import { CameraStatusDTO } from "../application/dtos/CreateCameraDTO";
import Camera from "../domain/camera.entity";
import { TGateType } from "../domain/camera.constant";

export default interface ICameraRepository {
    save(camera: Camera): Promise<Camera>;
    getAll(): Promise<Camera[]>;
    getAllStatus(): Promise<CameraStatusDTO[]>;
    update(id: string, data: Partial<Camera>): Promise<any>;
    findByCode(code: string): Promise<{ id: string; code: string; name: string; gateType: TGateType; enabled: boolean; online: boolean }>;
}