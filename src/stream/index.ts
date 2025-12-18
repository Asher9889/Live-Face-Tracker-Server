import { CameraController } from "./CameraController";
import initWSSStreaming from "./initStream";
import initCameraStatusSubscriber from "./initCameraStatusSubscriber";

const cameraController = new CameraController();

export default cameraController;
export { initWSSStreaming, initCameraStatusSubscriber };
