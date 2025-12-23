import EventBus from "../Event";
import EventNames, { RedisEventNames } from "../EventNames";
import { redis } from "../../db";
import { wsServer } from "../../stream/initStream";
import WS_EVENTS from "../ws-events";

export default class CameraStreamHandler {
  
    initialize() { // live-face-tracker:camera-event:entry_1:status
      EventBus.on(EventNames.CAMERA_STREAM_STARTED, async (data: { cameraCode: string; streamStartTs: number }) => {

        console.log('I am in CameraStreamHandler.initialize')

        await redis.hset(RedisEventNames.CAMERA_STATE(data.cameraCode), {
          streamStartTs: data.streamStartTs,
        });

        wsServer.broadcast({
          type: WS_EVENTS.CAMERA_STREAM_STARTED,
          payload: {
            cameraCode: data.cameraCode,
            streamStartTs: data.streamStartTs,
            status: "online"
          },
        });   

        console.log(`[CameraStreamHandler] stream started ${data.cameraCode} @ ${data.streamStartTs}`);
      });    
       
    }

}