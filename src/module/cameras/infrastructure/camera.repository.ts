import Camera from "../domain/camera.entity";
import CameraModel from "./camera.model";
import ICameraRepository from "./ICamera.repository";

export default class CameraRepository implements ICameraRepository {
    async save(camera: Camera): Promise<Camera> {
        const doc = await CameraModel.create(camera.toJSON());
        return doc;
    }
    async findByCode(code: string): Promise<Camera | null> {
        const doc = await CameraModel.findOne({ code }, { _id: 1 }).lean();
        return doc;
    }
    async getAll(){
        const docs = await CameraModel.find().lean();
        return docs;
    }
}