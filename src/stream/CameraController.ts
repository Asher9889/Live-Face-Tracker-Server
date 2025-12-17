import { spawn, ChildProcess } from "child_process";
import { createCameraIngress } from "./ingress.service";
import type { IngressInfo } from "livekit-server-sdk";

type CameraProcess = {
  ffmpeg: ChildProcess;
  ingressId: string;
};

export class CameraController {
  private processes = new Map<string, CameraProcess>();

  async start(cameraId: string, rtspUrl: string): Promise<IngressInfo> {
    if (this.processes.has(cameraId)) {
      throw new Error("Camera already running");
    }

    // 1️⃣ Create ingress (THIS creates the LiveKit participant)
    const ingress = await createCameraIngress(cameraId);

    const streamKey = ingress.streamKey;
    console.log("Stream key is", streamKey)
    const rtmpUrl = `rtmp://livekit.mssplonline.in/live/${streamKey}`;
    console.log("RTMP url is", rtmpUrl)
    if (!streamKey || !rtmpUrl) {
      throw new Error("RTMP ingress URL not returned");
    }

    // 2️⃣ Start FFmpeg (RTSP → RTMP)
    const ffmpeg = spawn("ffmpeg", [
      "-rtsp_transport", "tcp",
      "-i", rtspUrl,
      "-an",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-f", "flv",
      "-rtmp_live", "live",
      rtmpUrl,
    ]);

    ffmpeg.stderr.on("data", d =>
      console.log(`[${cameraId}]`, d.toString())
    );

    ffmpeg.on("exit", () => {
      this.processes.delete(cameraId);
    });

    this.processes.set(cameraId, {
      ffmpeg,
      ingressId: ingress.ingressId,
    });

    return ingress;
  }

  stop(cameraId: string) {
    const proc = this.processes.get(cameraId);
    if (!proc) return;

    proc.ffmpeg.kill("SIGKILL");
    this.processes.delete(cameraId);
  }
}
