import { EventEmitter } from "events";
import EmbeddingPublisher from "./handlers/EmbeddingPublisher";
import redis from "../db/connectRedis";

const EventBus = new EventEmitter();

export function initEventHandlers() {
  const publisher = new EmbeddingPublisher(redis);
  publisher.initialize(); // <-- register event handlers here
}

export default EventBus;