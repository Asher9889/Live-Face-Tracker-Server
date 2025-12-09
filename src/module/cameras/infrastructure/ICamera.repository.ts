import Camera from "../domain/camera.entity";

export default interface ICameraRepository {
    save(camera: Camera): Promise<Camera>;
}