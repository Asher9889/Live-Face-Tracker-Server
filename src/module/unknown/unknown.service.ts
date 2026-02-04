import { CreateUnknownEventDTO } from "./unknown.types";
import { v4 as uuidv4 } from "uuid";
import { envConfig } from "../../config";
import { EmbeddingBase } from "../shared/embedding/embedding.base";
import MinioService from "../shared/minio/minio.service";
import { UnknownIdentityModel } from "./unknown-identity.model";
import { UnknownEventModel } from "./unknown-event.model";
import { ApiError } from "../../utils";
import { StatusCodes } from "http-status-codes";

class UnknownEmbeddingService extends EmbeddingBase {
  constructor(apiUrl: string) {
    super(apiUrl);
  }
  generateEmbeddingsForUnknown = async (files: Express.Multer.File[]) => {
    return await this.requestEmbedding(files);
  }
}

class UnknownService {

  private minioService: MinioService;
  private embeddingService: UnknownEmbeddingService;

  constructor() {
    this.minioService = new MinioService();
    this.embeddingService = new UnknownEmbeddingService(envConfig.embeddingApiUrl);
  }


  createUnknownEvent = async (eventData: CreateUnknownEventDTO, faces: Express.Multer.File[]): Promise<{ eventId: string, identityId: string }> => {
    /**
     * Save faces to storage.
     * Save convert images to embeddings.
     * Save data to unknown collection.
     */
    const eventId = uuidv4();
    const { camera_code, pid, reason, tid, timestamp } = eventData;

    // Generate embeddings
    const embeddingRes = await this.embeddingService.generateEmbeddingsForUnknown(faces);

    if (!embeddingRes.success || !embeddingRes.mean_embedding) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Embedding generation failed");
    }

    const meanEmbedding = embeddingRes.mean_embedding;
    const bestFace = this.pickBestFace(faces);


    const imageKey = await this.uploadUnknownPersonImage(eventId, bestFace);

    // Try to match existing identity
    let identity = await this.findClosestIdentity(meanEmbedding);

    if (!identity) {
      // create new identity
      identity = await UnknownIdentityModel.create({
        representativeEmbedding: meanEmbedding,
        representativeImageKey: imageKey,
        eventCount: 1,
        firstSeen: Number(timestamp),
        lastSeen: Number(timestamp),
        status: "unknown",
      });
    } else {
      // update identity stats only
      identity.eventCount += 1;
      identity.lastSeen = Number(timestamp);
      await identity.save();
    }

    // Create event record (immutable)
    await UnknownEventModel.create({
      eventId,
      cameraCode: camera_code,
      trackerId: pid || tid,
      reason,
      timestamp: Number(timestamp),
      identityId: identity._id,
      meanEmbedding,
      imageKey,
    });

    return { eventId, identityId: identity._id };

  }

  private uploadUnknownPersonImage = async (eventId: string, file: Express.Multer.File) => {

    const bucket = envConfig.minioEmployeeBucketName;
    const prefix = `unknown_persons/events/${eventId}`;

    const key = this.minioService.generateKey(prefix, file.originalname);

    await this.minioService.upload(bucket, key, file);

    return key;
  };

  private pickBestFace(files: Express.Multer.File[]) {
    return files.reduce((prev, curr) =>
      curr.size > prev.size ? curr : prev
    );
  }

  private cosineSimilarity(a: number[], b: number[]) {

    if (!a || !b || a.length !== b.length) {
      throw new Error("Embedding vectors invalid");
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {

      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;

      dot += ai * bi;
      magA += ai * ai;
      magB += bi * bi;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }


  private async findClosestIdentity(embedding: number[]) {

    const identities = await UnknownIdentityModel.find().limit(100);

    let bestMatch: any = null;
    let bestScore = -1;

    for (const id of identities) {
      const score = this.cosineSimilarity(embedding, id.representativeEmbedding);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = id;
      }
    }

    const THRESHOLD = 0.5;

    return bestScore > THRESHOLD ? bestMatch : null;
  }
}

export default UnknownService;

/**
 * [PRESENCE] Recovery done. Active users: 11
eventData {
  camera_code: 'exit_1',
  pid: 'unknown_27',
  reason: 'unknown',
  tid: '27',
  timestamp: '1770125501'
}
faces [
  {
    fieldname: 'face',
    originalname: 'face_0.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff db 00 43 00 02 01 01 01 01 01 02 01 01 01 02 02 02 02 02 04 03 02 02 02 02 05 04 04 03 ... 3904 more bytes>,
    size: 3954
  },
  {
    fieldname: 'face',
    originalname: 'face_1.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff db 00 43 00 02 01 01 01 01 01 02 01 01 01 02 02 02 02 02 04 03 02 02 02 02 05 04 04 03 ... 4379 more bytes>,
    size: 4429
  },
  {
    fieldname: 'face',
    originalname: 'face_2.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff db 00 43 00 02 01 01 01 01 01 02 01 01 01 02 02 02 02 02 04 03 02 02 02 02 05 04 04 03 ... 5363 more bytes>,
    size: 5413
  },
  {
    fieldname: 'face',
    originalname: 'face_3.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff db 00 43 00 02 01 01 01 01 01 02 01 01 01 02 02 02 02 02 04 03 02 02 02 02 05 04 04 03 ... 3904 more bytes>,
    size: 3954
  },
  {
    fieldname: 'face',
    originalname: 'face_4.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff db 00 43 00 02 01 01 01 01 01 02 01 01 01 02 02 02 02 02 04 03 02 02 02 02 05 04 04 03 ... 4379 more bytes>,
    size: 4429
  },
  {
    fieldname: 'face',
    originalname: 'face_5.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff db 00 43 00 02 01 01 01 01 01 02 01 01 01 02 02 02 02 02 04 03 02 02 02 02 05 04 04 03 ... 5148 more bytes>,
    size: 5198
  },
  {
    fieldname: 'face',
    originalname: 'face_6.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff db 00 43 00 02 01 01 01 01 01 02 01 01 01 02 02 02 02 02 04 03 02 02 02 02 05 04 04 03 ... 5307 more bytes>,
    size: 5357
  },
  {
    fieldname: 'face',
    originalname: 'face_7.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff db 00 43 00 02 01 01 01 01 01 02 01 01 01 02 02 02 02 02 04 03 02 02 02 02 05 04 04 03 ... 5363 more bytes>,
    size: 5413
  }
]

 */