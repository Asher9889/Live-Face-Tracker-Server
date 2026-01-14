import { Schema, model, type Document } from "mongoose";
import { GATE_TYPE } from "../domain/camera.constant";
import Camera  from "../domain/camera.entity";

const CameraSchema = new Schema<Camera & Document>(
  {
    name: { type: String, required: true },

    code: { type: String, required: true},

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
      _id: false,
    },

    streamConfig: {
      type: {
        aiFps: { type: Number, default: 25 },
        displayFps: { type: Number, default: 25 },
      },
      _id: false,
    },

    roi: {
      type: {
        enabled: { type: Boolean, default: false },
        polygons: {
          type: [[Number]], // number[][]
          default: [],
        },
      },
      _id: false,
    },

    status: {
      type: {
        online: { type: Boolean, default: false },
        lastCheckedAt: { type: Date },
        lastFrameAt: { type: Date },
      },
      _id: false,
      default: {},
    },

    wsStreamId: { type: String },

    enabled: { type: Boolean, default: true },
  },
  {
    timestamps: true, versionKey: false
  }
);

CameraSchema.pre("save", function () {
    if (!this.id) {
        this.id = this._id.toString();
    }
});

// ---------------- Indexes ----------------

CameraSchema.index({ code: 1 }, { unique: true });
CameraSchema.index({ gateType: 1 });
CameraSchema.index({ enabled: 1 });
CameraSchema.index({ "status.online": 1 });

const CameraModel = model<Camera & Document>("Camera", CameraSchema);

export default CameraModel;
