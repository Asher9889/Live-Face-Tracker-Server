import mongoose from "mongoose";

export type IdentityStatus = "unknown" | "converted";

export interface IUnknownIdentity {
  representativeEmbedding: number[];
  representativeImageKey: string;

  eventCount: number;

  firstSeen: number;
  lastSeen: number;

  status: IdentityStatus;

  createdAt: Date;
  updatedAt: Date;
}

const UnknownIdentitySchema = new mongoose.Schema<IUnknownIdentity>(
  {
    representativeEmbedding: {
      type: [Number],
      required: true,
    },

    representativeImageKey: {
      type: String,
      required: true,
    },

    eventCount: {
      type: Number,
      default: 1,
    },

    firstSeen: { type: Number, required: true },
    lastSeen: { type: Number, required: true },

    status: {
      type: String,
      enum: ["unknown", "converted"],
      default: "unknown",
      index: true,
    },
  },
  {
    timestamps: true, versionKey: false
  }
);

export const UnknownIdentityModel = mongoose.model<IUnknownIdentity>("UnknownIdentity", UnknownIdentitySchema, "unknown_identity");
