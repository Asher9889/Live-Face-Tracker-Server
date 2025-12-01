import WebSocket from "ws";
import { StreamManager } from "./StreamManager";

export class WSStreamServer {
  private wss: WebSocket.Server;

  constructor(server: any, streamManager: StreamManager) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const cameraId = url.searchParams.get("cameraId");

      if (!cameraId) return ws.close();

      const stream = streamManager.getStream(cameraId);
      if (!stream) return ws.close();

      stream.addClient();

      const videoListener = (chunk: Buffer) => ws.send(chunk);
      stream.on("video", videoListener);

      ws.on("close", () => {
        stream.removeClient();
        stream.off("video", videoListener);
      });
    });
  }
}




