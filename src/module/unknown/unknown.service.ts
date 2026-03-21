import { CreateUnknownEventDTO, CreateUnknownIdentityDTO, CreateUnknownPersonEventDTO, CreateUnknownPersonEventServiceDTO, GetUnknownPersonsDTO, MergeUnknownDTO, UnknownEmbeddingDTO } from "./unknown.types";
import { v4 as uuidv4 } from "uuid";
import { envConfig } from "../../config";
import { EmbeddingBase } from "../shared/embedding/embedding.base";
import MinioService from "../shared/minio/minio.service";
import { UnknownIdentityModel } from "./unknown-identity.model";
import { UnknownEventModel } from "./unknown-event.model";
import { ApiError } from "../../utils";
import { StatusCodes } from "http-status-codes";
import IdentityCacheService from "./identity-cache.service";

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
  public cacheService: IdentityCacheService;

  constructor() {
    this.minioService = new MinioService();
    this.embeddingService = new UnknownEmbeddingService(envConfig.embeddingApiUrl);
    this.cacheService = new IdentityCacheService(UnknownIdentityModel);
  }

  async init() {
    await this.cacheService.warmup();
  }

  getUnknownPersons = async (): Promise<GetUnknownPersonsDTO[]> => {
    const unknownPersons = await UnknownIdentityModel.find({}, { representativeEmbedding: 0, createdAt: 0, updatedAt: 0 }).lean();
    const persons = unknownPersons.map((p) => {
      const { representativeImageKey, _id, ...rest } = p;

      return {
        ...rest,
        id: _id.toString(),
        avatar: this.generateMinioUrl(envConfig.minioEmployeeBucketName, representativeImageKey),
      }
    })
    return persons;
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
    const match = this.findClosestIdentity(meanEmbedding);

    let identityDoc: any = null;

    if (match?.id) {
      identityDoc = await UnknownIdentityModel.findById(match.id);
    }

    if (!identityDoc) {
      // create new identity
      identityDoc = await UnknownIdentityModel.create({
        representativeEmbedding: meanEmbedding,
        representativeImageKey: imageKey,
        eventCount: 1,
        firstSeen: Number(timestamp),
        lastSeen: Number(timestamp),
        status: "unknown",
      });

      this.cacheService.add(identityDoc);
    } else {
      // update identity stats only
      identityDoc.eventCount += 1;
      identityDoc.lastSeen = Number(timestamp);
      await identityDoc.save();
    }

    // Create event record (immutable)
    await UnknownEventModel.create({
      eventId,
      cameraCode: camera_code,
      // trackerId: pid || tid,
      reason,
      timestamp: Number(timestamp),
      identityId: identityDoc._id,
      meanEmbedding,
      imageKey,
    });

    return { eventId, identityId: identityDoc._id };

  }

  createUnknownIdentity = async ( identityData: CreateUnknownIdentityDTO, face: Express.Multer.File): Promise<{ unknownId: string; imageKey: string }> => {
    const { cameraCode, timestamp, embeddingCount } = identityData;
    console.log("Creating unknown identity with data:", identityData);
    const representativeEmbedding = JSON.parse(identityData.representativeEmbedding);

    const embeddingArray = representativeEmbedding.map(Number);

    const imageKey = await this.uploadUnknownPersonImage(uuidv4(), face);

    const newIdentity = await UnknownIdentityModel.create({
      representativeEmbedding: embeddingArray,
      representativeImageKey: imageKey,
      eventCount: 1,
      firstSeen: Number(timestamp),
      lastSeen: Number(timestamp),
      status: "unknown",
      cameraCode,
      embeddingCount: Number(embeddingCount)
    });

    return { unknownId: newIdentity._id.toString(), imageKey };
  };

  createUnknownPersonEvent = async (eventData: CreateUnknownPersonEventServiceDTO, face: Express.Multer.File) => {
    const eventId = uuidv4();
    const { timestamp, cameraCode, unknownId, meanEmbedding } = eventData;
    const imageKey = await this.uploadUnknownPersonImage(eventId, face);

    const savedUnknown = await UnknownIdentityModel.findById(unknownId);
    if(!savedUnknown) throw new ApiError(StatusCodes.NOT_FOUND, "Unknown identity not found");

    savedUnknown.eventCount += 1;
    savedUnknown.lastSeen = timestamp;
    await savedUnknown.save();

    await UnknownEventModel.create({
      eventId,
      cameraCode,
      identityId: unknownId,
      timestamp: timestamp,
      imageKey,
      meanEmbedding
    });

    return { eventId, unknownId };

  }

  findAllEmbeddings = async (): Promise<UnknownEmbeddingDTO[]> => {
    try {
      const docs = await UnknownIdentityModel.find({ status: "unknown" }, { representativeEmbedding: 1, representativeImageKey: 1, embeddingCount: 1, _id: 1 }).lean();
      const data = docs.map(({ _id, ...rest }) => {
        return {
          id: _id.toString(),
          ...rest,
        }
      })
      return data;
    } catch (error) {
      throw error;
    }
  }

  // mergeUnknown = async ({ sourceIds }: MergeUnknownDTO) => {
  //   const identities = await UnknownIdentityModel.find({ _id: { $in: sourceIds }}).lean();
  //   const primaryIdentity = identities.reduce((prev, curr) => {
  //     if (curr.embeddingCount > prev.embeddingCount) return curr;
  //     if (curr.embeddingCount === prev.embeddingCount) {
  //       return curr.lastSeen > prev.lastSeen ? curr : prev;
  //     }
  //     return prev;
  //   })
  //   const embeddings = identities.map(i => i.representativeEmbedding);
  //   const counts = identities.map(i => i.embeddingCount);

  //   const response = await axios.post(`${env.FASTAPI_URL}/merge`,{ embeddings, counts });

  //   const { mergedEmbedding, totalCount } = response.data;

  //   await UnknownIdentityModel.findByIdAndUpdate(primaryIdentity._id, {
  //     meanEmbedding: mergedEmbedding,
  //     embeddingCount: totalCount,
  //     lastSeen: Math.max(...identities.map(i => i.lastSeen))
  //   });

  //   const otherIds = sourceIds.filter(id => id !== primaryIdentity._id.toString());

  //   await UnknownEventModel.updateMany(
  //     { identityId: { $in: otherIds } },
  //     { $set: { identityId: primaryIdentity._id } }
  //   );

  //   await UnknownIdentityModel.deleteMany({
  //     _id: { $in: otherIds }
  //   });

  //   console.log({ primaryIdentity, embeddings, counts });
  // }

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

  findClosestIdentity(queryEmbedding: number[]): { id: string; score: number } | null {

    const cache = this.cacheService.getAll();
    if (!cache.length) return null;

    const query = new Float32Array(queryEmbedding);

    let bestScore = -1;
    let bestMatch: any = null;

    for (let k = 0; k < cache.length; k++) {

      const item = cache[k];
      if (!item) continue;

      const dbEmb = item.emb;

      if (dbEmb.length !== query.length) continue;

      let dot = 0;

      const DIM = query.length;
      const limit = DIM - (DIM % 4);

      for (let i = 0; i < limit; i += 4) {

        const q0 = query[i]!;
        const d0 = dbEmb[i]!;

        const q1 = query[i + 1]!;
        const d1 = dbEmb[i + 1]!;

        const q2 = query[i + 2]!;
        const d2 = dbEmb[i + 2]!;

        const q3 = query[i + 3]!;
        const d3 = dbEmb[i + 3]!;

        dot += q0 * d0;
        dot += q1 * d1;
        dot += q2 * d2;
        dot += q3 * d3;
      }

      for (let i = limit; i < DIM; i++) {
        dot += query[i]! * dbEmb[i]!;
      }

      if (dot > bestScore) {
        bestScore = dot;
        bestMatch = item;
      }
    }

    const THRESHOLD = 0.45;

    if (bestMatch && bestScore > THRESHOLD) {
      return {
        id: bestMatch.id,
        score: bestScore,
      };
    }

    return null;
    // return bestScore > THRESHOLD ? bestMatch : null;
  }

  generateMinioUrl(bucketName: string, representativeImageKey: string) {
    return `https://minio.mssplonline.in/${bucketName}/${representativeImageKey}`;
  }
}

export default UnknownService;
