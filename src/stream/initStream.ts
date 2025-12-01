import { StreamManager } from "./StreamManager";
import { WSStreamServer } from "./WSStreamServer";

function initStreaming(server: any) {
  const streamManager = new StreamManager();

  // Register all your cameras here
//   streamManager.addCamera("entry_1", "rtsp://admin:msspl1234@122.162.237.4:554/ch0_0.264");
  // streamManager.addCamera("entry_2", "rtsp://admin:msspl1234@192.168.1.130:554/live/ch00_1");
  streamManager.addCamera("entry_2", "rtsp://admin:msspl1234@192.168.1.130:554/cam/realmonitor?channel=1&subtype=1");
//   streamManager.addCamera("entry_3", "http://158.58.130.148/mjpg/video.mjpg");
//   streamManager.addCamera("exit_1",  "rtsp://admin:123@192.168.1.12/stream1");

  new WSStreamServer(server, streamManager);

  console.log("📡 Streaming system initialized");
}

export default initStreaming;