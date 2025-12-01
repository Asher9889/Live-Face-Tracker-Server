import { CameraStream } from "./CameraStream";

export class StreamManager {
  private streams = new Map<string, CameraStream>();

  addCamera(cameraId: string, rtspUrl: string) {
    const stream = new CameraStream(cameraId, rtspUrl);
    this.streams.set(cameraId, stream);
  }

  getStream(cameraId: string): CameraStream | undefined {
    return this.streams.get(cameraId);
  }
}
