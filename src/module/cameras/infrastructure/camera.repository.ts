import Camera from "../domain/camera.entity";
import CameraModel from "./camera.model";
import ICameraRepository from "./ICamera.repository";

export default class CameraRepository implements ICameraRepository {
    async save(camera: Camera): Promise<Camera> {
        const doc = await CameraModel.create(camera);
        return doc;
    }
}