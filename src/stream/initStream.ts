import { WSStreamServer } from "./WSStreamServer";
import http from "http";

let wsServer: WSStreamServer;
function initWSSStreaming(server: http.Server) {
  // const streamManager = new StreamManager();

  // Register all your cameras here
 // streamManager.addCamera("entry_1", "rtsp://admin:msspl1234@192.168.1.130:1024/cam/realmonitor?channel=1&subtype=1");

  // streamManager.addCamera("entry_2", "rtsp://admin:msspl1234@192.168.1.101:554/cam/ch0_0.264?channel=1&subtype=1");
 // streamManager.addCamera("entry_2", "rtsp://admin:msspl1234@192.168.1.130:554/ch0_0.264");
  // streamManager.addCamera("entry_2", "rtsp://admin:msspl1234@192.168.1.130:554/ch0_0.264");
  // streamManager.addCamera("entry_3", "rtsp://admin:msspl1234@122.162.237.4:1024/cam/realmonitor?channel=1&subtype=1");
//   streamManager.addCamera("entry_3", "http://158.58.130.148/mjpg/video.mjpg");
  // streamManager.addCamera("entry_3",  "rtsp://admin:msspl1234@122.162.237.4:1024/ch0_0.264");

  wsServer = new WSStreamServer(server);

  console.log("📡 Streaming system initialized");
}

export default initWSSStreaming;
export { wsServer };