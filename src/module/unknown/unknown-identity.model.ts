import mongoose from "mongoose";

export type IdentityStatus = "unknown" | "converted";

export interface IUnknownIdentity {
  representativeEmbedding: number[];

  poses: {
    left?: any;
    left_mid?: any;
    frontal?: any;
    right_mid?: any;
    right?: any;
  };

  representativeImageKey: string;
  representativePose: string;
  representativeQuality: number;

  eventCount: number;
  embeddingCount: number;

  firstSeen: number;
  lastSeen: number;

  status: IdentityStatus;
  cameraCode: string;

  createdAt: Date;
  updatedAt: Date;
}

const PoseSchema = new mongoose.Schema(
  {
    embedding: {
      type: [Number],
      required: true,
    },

    quality: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },

    faceSize: {
      w: { type: Number, required: true },
      h: { type: Number, required: true },
    },

    imageKey: {
      type: String, // MinIO key
      required: true,
    },

    ts: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const PosesSchema = new mongoose.Schema(
  {
    left: { type: PoseSchema, required: false },
    left_mid: { type: PoseSchema, required: false },
    frontal: { type: PoseSchema, required: false },
    right_mid: { type: PoseSchema, required: false },
    right: { type: PoseSchema, required: false },
  },
  { _id: false }
);

const UnknownIdentitySchema = new mongoose.Schema<IUnknownIdentity>(
  {
    // 🔥 Global centroid
    representativeEmbedding: {
      type: [Number],
      required: true,
      index: true,
    },

    // 🔥 Pose-aware nested object
    poses: {
      type: PosesSchema,
      required: true,
      validate: {
        validator: (v: any) => {
          return v && Object.values(v).some(Boolean);
        },
        message: "At least one pose is required",
    },
    },

    // 🔥 Best image (fast UI access)
    representativeImageKey: {
      type: String,
      required: true,
    },

    representativePose: {
      type: String,
      enum: ["left", "left_mid", "frontal", "right_mid", "right"],
      required: true,
    },

    representativeQuality: {
      type: Number,
      required: true,
    },

    // 🔥 Stats
    eventCount: {
      type: Number,
      default: 1,
    },

    embeddingCount: {
      type: Number,
      default: 1,
    },

    firstSeen: {
      type: Number,
      required: true,
    },

    lastSeen: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["unknown", "converted"],
      default: "unknown",
      index: true,
    },

    cameraCode: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const UnknownIdentityModel = mongoose.model<IUnknownIdentity>("UnknownIdentity", UnknownIdentitySchema,"unknown_identity");