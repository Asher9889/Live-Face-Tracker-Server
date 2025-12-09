import { Schema, model, type Document } from "mongoose";
import { GATE_TYPE } from "../domain/camera.constant";
import Camera  from "../domain/camera.entity";

const CameraSchema = new Schema<Camera & Document>(
  {
    name: { type: String, required: true },

    code: { type: String, required: true, unique: true },

    gateType: {
      type: String,
      enum: Object.values(GATE_TYPE),
      required: true,
    },

    location: { type: String, required: true },

    rtspUrl: { type: String, required: true },

    // ----------------- Embedded Subdocuments -----------------

    credentials: {
      type: {
        username: { type: String },
        password: { type: String },
      },
      required: false,
    },

    streamConfig: {
      type: {
        aiFps: { type: Number, default: 25 },
        displayFps: { type: Number, default: 25 },
      },
    },

    roi: {
      type: {
        enabled: { type: Boolean, default: false },
        polygons: {
          type: [[Number]], // number[][]
          default: [],
        },
      },
    },

    status: {
      type: {
        online: { type: Boolean, default: false },
        lastCheckedAt: { type: Date },
        lastFrameAt: { type: Date },
      },
      default: {},
    },

    wsStreamId: { type: String },

    enabled: { type: Boolean, default: true },
  },
  {
    timestamps: true, versionKey: false
  }
);

// ---------------- Indexes ----------------

CameraSchema.index({ code: 1 }, { unique: true });
CameraSchema.index({ gateType: 1 });
CameraSchema.index({ enabled: 1 });
CameraSchema.index({ "status.online": 1 });

const CameraModel = model<Camera & Document>("Camera", CameraSchema);

export default CameraModel;
