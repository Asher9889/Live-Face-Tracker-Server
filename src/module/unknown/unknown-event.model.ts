import { Schema, model, Types } from "mongoose";

export interface IUnknownEvent {
  eventId: string;
  cameraCode: string;
  trackerId?: string;
  reason?: string;

  timestamp: number;

  identityId?: Types.ObjectId;

  meanEmbedding: number[];
  imageKey: string;

  createdAt: Date;
}

const UnknownEventSchema = new Schema<IUnknownEvent>(
  {
    eventId: { type: String, required: true, unique: true },

    cameraCode: { type: String, required: true },
    trackerId: { type: String },

    reason: { type: String },

    timestamp: { type: Number, required: true },

    identityId: {
      type: Schema.Types.ObjectId,
      ref: "UnknownIdentity",
      index: true,
    },

    meanEmbedding: {
      type: [Number],
      required: true,
    },

    imageKey: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, versionKey: false,
  }
);

export const UnknownEventModel = model<IUnknownEvent>("UnknownEvent",UnknownEventSchema, "unknown_event");
