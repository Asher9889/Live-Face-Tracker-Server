import { Redis } from "ioredis";
import defaultRedis from "../../db/connectRedis";
import { presenceService } from "../../module/presence/presence.module";

type StreamEventName = "person_entered" | "person_exited" | "unknown_entered" | "unknown_exited";

type AttendanceStreamPayload = {
    event: StreamEventName;
    category: string;
    timestamp: number;
    payload?: string;
};

type AttendanceEventMessage = {
    event: StreamEventName;
    camera_code?: string;
    camera?: string;
    eventTs?: number;
    frameTs?: number;
    frame_width?: number;
    frame_height?: number;
    person_id?: string;
    similarity?: number;
    bbox?: [number, number, number, number];
    unknownId?: string;
};

type StreamEntry = [string, string[]];
type StreamResponse = [string, StreamEntry[]][];

const STREAM_KEY = "attendance_stream";
const GROUP_NAME = "attendance-node";
const CONSUMER_NAME = `consumer-${process.pid}`;
const BLOCK_MS = 5000;


async function ensureConsumerGroup(redis: Redis) {
    try {
        await redis.xgroup("CREATE", STREAM_KEY, GROUP_NAME, "0", "MKSTREAM");
    } catch (error: any) {
        if (!String(error?.message ?? "").includes("BUSYGROUP")) {
            throw error;
        }
    }
}

function normalizeMessage(fields: unknown): AttendanceStreamPayload | null {
    if (!Array.isArray(fields)) return null;

    const message: Record<string, string> = {};

    for (let index = 0; index < fields.length; index += 2) {
        const rawKey = fields[index];
        const rawValue = fields[index + 1];

        const key =
            typeof rawKey === "string"
                ? rawKey
                : rawKey instanceof Buffer
                ? rawKey.toString()
                : undefined;

        const value =
            typeof rawValue === "string"
                ? rawValue
                : rawValue instanceof Buffer
                ? rawValue.toString()
                : undefined;

        if (key && value) {
            message[key] = value;
        }
    }

    const event = message.event as StreamEventName | undefined;
    if (!event) {
        return null;
    }

    return {
        event,
        category: message.category ?? "",
        timestamp: message.timestamp ? Number(message.timestamp) : 0,
        payload: message.payload ?? "",
    };
}

function toAttendanceEvent(message: AttendanceStreamPayload): AttendanceEventMessage | null {
    if (!message.payload) {
        return null;
    }

    try {
        return JSON.parse(message.payload) as AttendanceEventMessage;
    } catch {
        return null;
    }
}

export default async function initAttendanceStreamConsumer() {
    const redis = defaultRedis.duplicate();

    redis.on("error", (error) => {
        console.error("[STREAM] Redis error", error);
    });

    await ensureConsumerGroup(redis);

    console.log(`[STREAM] attendance consumer started as ${CONSUMER_NAME}`);

    const consume = async () => {
        while (true) {
            const response = await redis.xreadgroup(
                "GROUP",
                GROUP_NAME,
                CONSUMER_NAME,
                "COUNT",
                10,
                "BLOCK",
                BLOCK_MS,
                "STREAMS",
                STREAM_KEY,
                ">"
            ) as StreamResponse;

            if (!response) {
                continue;
            }

            for (const [, entries] of response) {
                for (const [messageId, fields] of entries) {
                    const streamMessage = normalizeMessage(fields);
                    const businessEvent = streamMessage ? toAttendanceEvent(streamMessage) : null;

                    if (!streamMessage || !businessEvent) {
                        await redis.xack(STREAM_KEY, GROUP_NAME, messageId);
                        continue;
                    }

                    const cameraCode = businessEvent.camera_code ?? businessEvent.camera ?? "";
                    const eventTs = businessEvent.eventTs ?? streamMessage.timestamp ?? Date.now();
                    const confidence = Number(businessEvent.similarity ?? 0);

                    try {
                        switch (businessEvent.event) {
                            case "person_entered":
                                console.log("[STREAM] person_entered event for person", businessEvent.person_id);
                                if (businessEvent.person_id && cameraCode) {
                                    await presenceService.onPersonEntered({
                                        employeeId: businessEvent.person_id,
                                        cameraCode,
                                        gateRole: cameraCode.startsWith("entry") ? "ENTRY" : "EXIT",
                                        eventTs,
                                        confidence,
                                    });
                                }
                                break;

                            case "person_exited":
                                console.log("[STREAM] person_exited event for person", businessEvent.person_id);
                                if (businessEvent.person_id && cameraCode) {
                                    await presenceService.onPersonExited({
                                        employeeId: businessEvent.person_id,
                                        cameraCode,
                                        gateRole: cameraCode.startsWith("entry") ? "ENTRY" : "EXIT",
                                        eventTs,
                                        confidence,
                                    });
                                }
                                break;

                            case "unknown_exited":
                            case "unknown_entered":
                                console.log(`[STREAM] ${businessEvent.event} event for unknown person`, businessEvent.unknownId);
                                if (cameraCode) {
                                    const unknownId = businessEvent.unknownId ?? businessEvent.person_id;
                                    if (!unknownId) {
                                        break;
                                    }

                                    await presenceService.onUnknownEntered({
                                        cameraCode,
                                        eventType: businessEvent.event === "unknown_entered" ? "entered" : "exited",
                                        gateRole: cameraCode.startsWith("entry") ? "ENTRY" : "EXIT",
                                        unknownId,
                                        bbox: businessEvent.bbox ?? [0, 0, 0, 0],
                                        eventTs,
                                        frameTs: businessEvent.frameTs ?? eventTs,
                                        frameWidth: businessEvent.frame_width ?? 0,
                                        frameHeight: businessEvent.frame_height ?? 0,
                                        confidence,
                                    });
                                }
                                break;
                        }

                        await redis.xack(STREAM_KEY, GROUP_NAME, messageId);
                    } catch (error) {
                        console.error("[STREAM] attendance event failed", { messageId, businessEvent, error });
                        await new Promise(res => setTimeout(res, 1000));
                    }
                }
            }
        }
    };

    void consume().catch((error) => {
        console.error("[STREAM] consumer crashed", error);
    });

    return redis;
}