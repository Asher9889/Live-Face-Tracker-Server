import mongoose, { Document, Schema } from "mongoose";
import { EXIT_TYPE, ExitType } from "../../../domain/types";


export interface IPresenceLog extends Document {
  employeeId: string;

  eventType: ExitType;

  fromState?: "IN" | "OUT";
  toState?: "IN" | "OUT";

  cameraCode?: string;

  occurredAt: number;

  source: "face_recognition" | "manual" | "system";

  confidence?: number;

  note?: string;
}

const PresenceLogSchema = new Schema<IPresenceLog>(
  {
    employeeId: { type: String, required: true, index: true },

    eventType: {
      type: String,
      enum: EXIT_TYPE,
      required: true,
    },

    fromState: { type: String, enum: ["IN", "OUT"] },
    toState: { type: String, enum: ["IN", "OUT"] },

    cameraCode: { type: String },

    occurredAt: { type: Number, required: true, index: true },

    source: {
      type: String,
      enum: ["face_recognition", "manual", "system"],
      default: "face_recognition",
    },

    confidence: { type: Number, min: 0, max: 1 },

    note: { type: String },
  },
  { versionKey: false, timestamps: true }
);

PresenceLogSchema.index({ employeeId: 1, occurredAt: 1 });

export const PresenceLogModel = mongoose.model("employees_presence_logs", PresenceLogSchema, "employees_presence_logs");
