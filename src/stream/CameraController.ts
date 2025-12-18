import { spawn, ChildProcess } from "child_process";
import { createCameraIngress } from "./ingress.service";
import type { IngressInfo } from "livekit-server-sdk";
import redis from "../db/connectRedis";
import { ApiError } from "../utils";
import { StatusCodes } from "http-status-codes";
import { envConfig } from "../config";
import { RedisEventNames } from "../events/EventNames";

type CameraProcess = {
  ffmpeg: ChildProcess;
  ingressId: string;
  lastFrameAt: number;
  status: string;
};

export class CameraController {
  private processes = new Map<string, CameraProcess>();

  async start(cameraId: string, rtspUrl: string): Promise<IngressInfo> {
    if (this.processes.has(cameraId)) {
      throw new ApiError(StatusCodes.CONFLICT, "Camera already running");
    }

    //Create ingress (THIS creates the LiveKit participant)
    const ingress = await createCameraIngress(cameraId);

    const streamKey = ingress.streamKey;
    console.log("Stream key is", streamKey)
    const rtmpUrl = `rtmp://livekit.mssplonline.in/live/${streamKey}`;
    console.log("RTMP url is", rtmpUrl)
    if (!streamKey || !rtmpUrl) {
      throw new Error("RTMP ingress URL not returned");
    }

    //Start FFmpeg (RTSP → RTMP)
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

    // Initialize in-memory state
    this.processes.set(cameraId, {
      ffmpeg,
      ingressId: ingress.ingressId,
      lastFrameAt: 0,
      status: "offline",
    });

    ffmpeg.stderr.on("data", async (buffer) => {
      const log = buffer.toString();

      if (!log.includes("frame=")) {
        return;
      }

      const proc = this.processes.get(cameraId);
      if (!proc) return;

      proc.lastFrameAt = Date.now();

      if (proc.status !== "online") {
        proc.status = "online";
        await redis.hset(RedisEventNames.CAMERA_STATE(cameraId), {
          status: "online",
          lastFrameAt: proc.lastFrameAt,
          ingressId: proc.ingressId,
        });

        await redis.publish(
          RedisEventNames.CAMERA_STATE_CHANGED,
          JSON.stringify({
            cameraId,
            status: "online",
            lastFrameAt: proc.lastFrameAt,
          })
        );
      }
    });


    // continous watching wheather camera is online or offline
    const watchdog = setInterval(async () => {
      const proc = this.processes.get(cameraId);
      if (!proc) {
        clearInterval(watchdog);
        return;
      }

      if (Date.now() - proc.lastFrameAt > envConfig.offlineThreshold) {
        return await redis.hset(RedisEventNames.CAMERA_STATE(cameraId), {
          status: "offline",
          lastFrameAt: proc.lastFrameAt,
        });
      }

      await redis.hset(RedisEventNames.CAMERA_STATE(cameraId), {
        lastFrameAt: proc.lastFrameAt,
      })
    }, envConfig.watchdogInterval);


    // when exit this event fire when at the end ffmpeg process is finished
    ffmpeg.on("exit", async () => {
      const proc = this.processes.get(cameraId);
      if (!proc) return;
      clearInterval(watchdog);
      if (proc.status !== "offline") {
        await redis.hset(RedisEventNames.CAMERA_STATE(cameraId), {
          status: "offline",
          stoppedAt: Date.now(),
        });
      }
      this.processes.delete(cameraId);
    });

    return ingress;
  }

  async stop(cameraId: string) {
    const proc = this.processes.get(cameraId);
    if (!proc) return;

    proc.ffmpeg.kill("SIGTERM");
    setTimeout(() => {
      if (!proc.ffmpeg.killed) {
        proc.ffmpeg.kill("SIGKILL");
      }
    }, 3000);
    await redis.hset(RedisEventNames.CAMERA_STATE(cameraId), {
      status: "offline",
      stoppedAt: Date.now(),
    });
  }
}
