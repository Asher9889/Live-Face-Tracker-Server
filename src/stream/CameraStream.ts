import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "events";

export class CameraStream extends EventEmitter {
  private ffmpeg?: ChildProcessWithoutNullStreams; //running ffmpeg process
  private readonly cameraId: string; //camera name like "entry_1"
  private readonly rtspUrl: string; //rtsp url
  private clientsCount = 0; //number of clients

  constructor(cameraId: string, rtspUrl: string) {
    super();
    this.cameraId = cameraId;
    this.rtspUrl = rtspUrl;
    this.setMaxListeners(6);
  }

  start() {
    if (this.ffmpeg) return;

    console.log(`🎥 Starting stream for camera: ${this.cameraId}`);

    this.ffmpeg = spawn("/opt/homebrew/bin/ffmpeg", [
      "-i", this.rtspUrl,
      "-f", "mpegts",
      "-codec:v", "mpeg1video",
      "-s", "640x360",
      "-b:v", "800k",
      "-r", "25",
      "-"
    ]);

    // this.ffmpeg = spawn("ffmpeg", [
    //   "-rtsp_transport", "tcp",
    //   // "-stimeout", "20000000",
    //   "-rw_timeout", "20000000",
    //   "-i", this.rtspUrl,
    //   "-an",
    //   "-f", "mpegts",
    //   "-codec:v", "mpeg1video",
    //   "-s", "640x360",
    //   "-b:v", "800k",
    //   "-r", "25",
    //   "-"
    // ]);


    this.ffmpeg.stdout.on("data", (chunk) => {
      this.emit("video", chunk);
    });

    this.ffmpeg.stderr.on("data", (data) => {
        // console.log("FFmpeg STDERR:", data.toString());
    });

    this.ffmpeg.on("close", () => {
      console.error(`❌ FFmpeg stopped for ${this.cameraId}. Restarting...`);
      // this.ffmpeg = null;
      setTimeout(() => this.start(), 2000);
    });
  }

  stop() {
    this.ffmpeg?.kill("SIGKILL");
    // this.ffmpeg = null;
    console.log(`🛑 Stopped stream for camera: ${this.cameraId}`);
  }

  addClient() {
    this.clientsCount++;
    if (this.clientsCount === 1) this.start();
  }

  removeClient() {
    this.clientsCount--;
    if (this.clientsCount <= 0) {
      this.clientsCount = 0;
      this.stop();
    }
  }
}
