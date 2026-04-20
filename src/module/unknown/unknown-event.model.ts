import { Schema, model, Types } from "mongoose";

export interface IUnknownEvent {
  cameraCode: string;
  gateRole: string;

  eventType: "entered" | "exited";
  identityId?: Types.ObjectId;

  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };

  frameTs: number;
  eventTs: number;

  frameWidth: number;
  frameHeight: number;

  confidence?: number;

  createdAt: Date;
}

const UnknownEventSchema = new Schema<IUnknownEvent>(
  {
    cameraCode: { type: String, required: true, index: true },
    gateRole: { type: String, required: true },

    eventType: { 
      type: String, 
      enum: ["entered", "exited"], 
      required: true 
    },

    identityId: {
      type: Schema.Types.ObjectId,
      ref: "UnknownIdentity",
      index: true,
    },

    bbox: {
      x1: Number,
      y1: Number,
      x2: Number,
      y2: Number,
    },

    frameTs: { type: Number, required: true },
    eventTs: { type: Number, required: true },

    frameWidth: Number,
    frameHeight: Number,

    confidence: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

export const UnknownEventModel = model<IUnknownEvent>(
  "UnknownEvent",
  UnknownEventSchema,
  "unknown_event"
);