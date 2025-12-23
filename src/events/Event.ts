import { EventEmitter } from "events";
import EmbeddingPublisher from "./handlers/EmbeddingPublisher";
import redis from "../db/connectRedis";
import { CameraStreamHandler } from "./index";

const EventBus = new EventEmitter();
EventBus.setMaxListeners(20);

export function initEventHandlers() {
  const publisher = new EmbeddingPublisher(redis);
  publisher.initialize(); // <-- register event handlers here
  
  const cameraStreamHandler = new CameraStreamHandler();
  cameraStreamHandler.initialize();
}

export default EventBus;