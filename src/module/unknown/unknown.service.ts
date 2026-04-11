import { CreateUnknownEventDTO, CreateUnknownIdentityDTO, CreateUnknownPersonEventDTO, CreateUnknownPersonEventServiceDTO, CreateUnknownSchemaDTO, GetUnknownPersonsDTO, MergeUnknownDTO, PoseData, PoseKey, PoseMap, UnknownEmbeddingDTO, updateUnknownSchemaDTO } from "./unknown.types";
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

  createUnknownIdentity = async (identityData: CreateUnknownSchemaDTO, files: Record<string, Express.Multer.File>): Promise<{ unknownId: string; }> => {
    const { camera_code, timestamp, embedding_count, centroid_embedding, poses, builder_stats } = identityData;
    const poseEntries: any = {};

    let bestPose: string | null = null;
    let bestQuality = -1;
    let bestImageKey = "";

    for (const [poseName, poseData] of Object.entries(poses)) {
      const file = files[poseName];

      if (!file) {
        console.warn(`[WARN] Missing file for pose=${poseName}`);
        continue;
      }

      const imageKey = await this.uploadUnknownPersonImage(uuidv4(), file);

      poseEntries[poseName] = {
        embedding: poseData.embedding.map(Number),
        quality: poseData.quality,
        faceSize: poseData.face_size,
        imageKey,
        ts: poseData.ts
      };

      if (poseData.quality > bestQuality) {
        bestQuality = poseData.quality;
        bestPose = poseName;
        bestImageKey = imageKey;
      }
    }

    if (!bestPose) {
      throw new Error("No valid poses with images found");
    }
    const newIdentity = await UnknownIdentityModel.create({
      representativeEmbedding: centroid_embedding.map(Number),

      poses: poseEntries,

      representativeImageKey: bestImageKey,
      representativePose: bestPose,
      representativeQuality: bestQuality,

      eventCount: 1,
      embeddingCount: Number(embedding_count),

      firstSeen: Number(timestamp),
      lastSeen: Number(timestamp),

      status: "unknown",
      cameraCode: camera_code
    });

    return { unknownId: newIdentity._id.toString() };
  };

  // updateUnknownIdentity = async (unknownId: string, identityData: updateUnknownSchemaDTO, files: Record<string, Express.Multer.File>): Promise<{ unknownId: string; }> => {


  //   const identity = await UnknownIdentityModel.findById(unknownId);
  //   if (!identity) {
  //     throw new ApiError(StatusCodes.NOT_FOUND, "Unknown identity not found");
  //   }

  //   // const existingPoses = identity.poses ?? {};
  //   const existingPoses: PoseMap = {};

  //   const poses = identity.poses as PoseMap; // safe narrowing

  //   for (const key of Object.keys(poses) as PoseKey[]) {
  //     const p = poses[key];

  //     if (p?.embedding && typeof p.quality === "number") {
  //       existingPoses[key] = {
  //         embedding: p.embedding,
  //         quality: p.quality,
  //         faceSize: p.faceSize,
  //         imageKey: p.imageKey,
  //         ts: p.ts
  //       };
  //     }
  //   }

  //   const incomingPoses = identityData.poses;
  //   const eventId = identity.representativeImageKey.split("/")[2];

  //   if (!eventId) {
  //     throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid existing identity data, missing eventId.");
  //   }
  //   let updated = false;
  //   for (let poseName of Object.keys(incomingPoses)) {
  //     const incoming = incomingPoses[poseName];
  //     const existing = existingPoses[poseName as keyof typeof existingPoses];

  //     if (!incoming || !incoming.embedding || !incoming.quality) {
  //       throw new ApiError(StatusCodes.BAD_REQUEST, `[WARN] Invalid incoming pose data for pose=${poseName}, missing embedding or quality.`);
  //     }
  //     const file = files[poseName];

  //     if (!file) {
  //       throw new ApiError(StatusCodes.BAD_REQUEST, `Missing image for pose: ${poseName}`);
  //     }

  //     if (!existing) {
  //       // ✅ NEW POSE
  //       const imageKey = await this.uploadUnknownPersonImage(eventId, file, poseName);

  //       existingPoses[poseName as keyof typeof existingPoses] = {
  //         embedding: incoming.embedding,
  //         quality: incoming.quality,
  //         faceSize: incoming.faceSize, // ✅ add this
  //         imageKey,
  //         ts: incoming.ts
  //       };

  //       updated = true;
  //       continue;
  //     }

  //     // ------------------------------------------------
  //     // ✅ REPLACE IF BETTER QUALITY
  //     // ------------------------------------------------
  //     if (incoming.quality > existing.quality) {

  //       const imageKey = await this.uploadUnknownPersonImage(eventId, file, poseName);

  //       existingPoses[poseName as keyof typeof existingPoses] = {
  //         embedding: incoming.embedding,
  //         quality: incoming.quality,
  //         faceSize: incoming.faceSize, // ✅ add this
  //         imageKey,
  //         ts: incoming.ts
  //       };

  //       updated = true;
  //     }
  //   }

  //   // ------------------------------------------------
  //   // 🔥 RECOMPUTE CENTROID
  //   // ------------------------------------------------
  //   if (updated) {

  //     const centroid = this.computeWeightedCentroid(existingPoses as Record<string, { embedding: number[]; quality: number }>);

  //     identity.poses = existingPoses;
  //     identity.representativeEmbedding = centroid;
  //     identity.lastSeen = Date.now();

  //     // 🔥 update representative pose (best quality)
  //     const frontal = existingPoses["frontal"];

  //     // ------------------------------------------------
  //     // 🔥 RULE: prefer frontal always
  //     // ------------------------------------------------
  //     if (frontal) {
  //       identity.representativePose = "frontal";
  //       identity.representativeQuality = frontal.quality;
  //       identity.representativeImageKey = frontal.imageKey;
  //     } else {
  //       // fallback → highest quality
  //       let bestPose = "";
  //       let bestQuality = -1;
  //       let bestImageKey = "";

  //       for (const p of Object.keys(existingPoses)) {
  //         const pose = existingPoses[p as keyof typeof existingPoses];

  //         if (pose && pose.quality > bestQuality) {
  //           bestQuality = pose.quality;
  //           bestPose = p;
  //           bestImageKey = pose.imageKey;
  //         }
  //       }

  //       identity.representativePose = bestPose;
  //       identity.representativeQuality = bestQuality;
  //       identity.representativeImageKey = bestImageKey;
  //     }
  //     identity.embeddingCount = Object.keys(existingPoses).length;

  //     await identity.save();
  //   }

  //   return { unknownId: identity._id.toString() };
  // }

  updateUnknownIdentity = async (
    unknownId: string,
    identityData: updateUnknownSchemaDTO,
    files: Record<string, Express.Multer.File>
  ): Promise<{ unknownId: string }> => {

    // ✅ STEP 1: GET PLAIN OBJECT
    const identity = await UnknownIdentityModel.findById(unknownId).lean();

    if (!identity) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Unknown identity not found");
    }

    // ✅ STEP 2: CLONE POSES (PURE JS)
    const existingPoses: PoseMap = { ...(identity.poses ?? {}) };

    let incomingPoses = identityData.poses;

    // 🔥 HANDLE STRING CASE (multipart)
    if (typeof incomingPoses === "string") {
      incomingPoses = JSON.parse(incomingPoses);
    }

    const eventId = identity.representativeImageKey.split("/")[2];
    if (!eventId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid existing identity data, missing eventId.");
    }

    let updated = false;

    // ------------------------------------------------
    // ✅ STEP 3: MERGE LOGIC (PURE JS)
    // ------------------------------------------------
    for (const poseName of Object.keys(incomingPoses) as PoseKey[]) {
      const incoming = incomingPoses[poseName];
      const existing = existingPoses[poseName];

      if (!incoming || !incoming.embedding || typeof incoming.quality !== "number") {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `[WARN] Invalid incoming pose data for pose=${poseName}`
        );
      }

      const file = files[poseName];
      if (!file) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Missing image for pose: ${poseName}`);
      }

      // ✅ NEW POSE
      if (!existing) {
        const imageKey = await this.uploadUnknownPersonImage(eventId, file, poseName);

        existingPoses[poseName] = {
          embedding: Array.from(incoming.embedding), // 🔥 normalize
          quality: incoming.quality,
          faceSize: incoming.faceSize,
          imageKey,
          ts: incoming.ts
        };

        updated = true;
        continue;
      }

      // ✅ REPLACE IF BETTER QUALITY
      if (incoming.quality > existing.quality) {
        const imageKey = await this.uploadUnknownPersonImage(eventId, file, poseName);

        existingPoses[poseName] = {
          embedding: Array.from(incoming.embedding),
          quality: incoming.quality,
          faceSize: incoming.faceSize,
          imageKey,
          ts: incoming.ts
        };

        updated = true;
      }
    }

    if (!updated) {
      return { unknownId };
    }

    // ------------------------------------------------
    // 🔥 STEP 4: CENTROID (PURE JS)
    // ------------------------------------------------
    const validPoses = Object.fromEntries(
      Object.entries(existingPoses).filter(
        ([_, p]) =>
          p &&
          p.embedding &&
          typeof p.quality === "number" &&
          p.embedding.length > 0
      )
    ) as Record<string, PoseData>;

    if (Object.keys(validPoses).length === 0) {
      throw new Error("No valid poses for centroid");
    }

    const centroid = this.computeWeightedCentroid(validPoses);

    // ------------------------------------------------
    // 🔥 STEP 5: REPRESENTATIVE POSE
    // ------------------------------------------------
    let representativePose: PoseKey | "" = "";
    let representativeQuality = -1;
    let representativeImageKey = "";

    if (existingPoses["frontal"]) {
      const frontal = existingPoses["frontal"];
      representativePose = "frontal";
      representativeQuality = frontal.quality;
      representativeImageKey = frontal.imageKey!;
    } else {
      for (const key of Object.keys(existingPoses) as PoseKey[]) {
        const pose = existingPoses[key];
        if (pose && pose.quality > representativeQuality) {
          representativeQuality = pose.quality;
          representativePose = key;
          representativeImageKey = pose.imageKey!;
        }
      }
    }

    // ------------------------------------------------
    // 🔥 STEP 6: SINGLE DB WRITE (ATOMIC)
    // ------------------------------------------------
    await UnknownIdentityModel.findByIdAndUpdate(
      unknownId,
      {
        $set: {
          poses: existingPoses,
          representativeEmbedding: centroid,
          representativePose,
          representativeQuality,
          representativeImageKey,
          embeddingCount: Object.keys(existingPoses).length,
          lastSeen: Date.now()
        }
      },
      { new: false } // no need to return doc
    );

    return { unknownId };
  };

  createUnknownPersonEvent = async (eventData: CreateUnknownPersonEventServiceDTO, face: Express.Multer.File) => {
    const eventId = uuidv4();
    const { timestamp, cameraCode, unknownId, meanEmbedding } = eventData;
    const imageKey = await this.uploadUnknownPersonImage(eventId, face);

    const savedUnknown = await UnknownIdentityModel.findById(unknownId);
    if (!savedUnknown) throw new ApiError(StatusCodes.NOT_FOUND, "Unknown identity not found");

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

  private uploadUnknownPersonImage = async (eventId: string, file: Express.Multer.File, poseName?: string) => {
    console.log(`Uploading image for eventId=${eventId}, pose=${poseName || "N/A"}, originalname=${file.originalname}, size=${file.size} bytes`);
    const bucket = envConfig.minioEmployeeBucketName;
    const prefix = poseName ? `unknown_persons/events/${eventId}/${poseName}` : `unknown_persons/events/${eventId}`;

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

  computeWeightedCentroid(poses: Record<string, { embedding: number[]; quality: number; }>): number[] {
    const poseList = Object.values(poses);
    if (!poseList) {
      throw new Error("No poses available for centroid");
    }

    if (poseList.length === 0) {
      throw new Error("No poses available for centroid");
    }

    const firstPose = poseList[0];
    if (!firstPose) {
      throw new Error("No valid poses available");
    }

    // const dim = firstPose.poses.embedding.length;


    const sum = new Array(512).fill(0);
    let totalWeight = 0;

    for (const pose of poseList) {
      const emb = pose.embedding;
      const w = pose.quality;

      totalWeight += w;

      for (let i = 0; i < 512; i++) {
        sum[i] += emb[i]! * w;
      }
    }

    // avoid divide by zero
    if (totalWeight === 0) {
      throw new Error("Invalid total weight");
    }

    // mean
    const centroid = sum.map(v => v / totalWeight);

    // 🔥 CRITICAL: normalize
    const norm = Math.sqrt(centroid.reduce((acc, v) => acc + v * v, 0));

    return centroid.map(v => v / norm);
  }

}

export default UnknownService;
