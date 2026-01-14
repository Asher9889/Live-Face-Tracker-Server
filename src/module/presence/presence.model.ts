import mongoose, { Document } from "mongoose";
import { PRESENCE_STATE, PresenceState, GateRole, GATE_ROLE } from "./presence.types";

interface IPresenceSchemaData extends Document {
  employeeId: string;
  state: PresenceState; // Current session state

  // Boundary timestamps
  lastSeenAt: number;       // last time ANY gate saw the person
  lastChangedAt: number;    // last time state changed (IN <-> OUT)

  date: string;
  confidence: number;

  // Boundary context
  lastGate: GateRole;       // ENTRY or EXIT
  lastCameraCode: string;   // which camera last saw the person
}


const presenceSchema = new mongoose.Schema<IPresenceSchemaData>({
  employeeId: { type: String, required: true },
  state: { type: String, enum: Object.values(PRESENCE_STATE) , required: true },

  lastSeenAt: { type: Number, required: true},
  lastChangedAt: { type: Number, required: true},

  date: {type: String, required: true, index: true},
  confidence: {type: Number, required: true},

  lastGate: { type: String, enum: Object.values(GATE_ROLE), required: true },
  lastCameraCode: { type: String, required: true, index: true },
}, { versionKey: false , timestamps: true });

presenceSchema.index({ date: 1, lastChangedAt: -1 });
presenceSchema.index({ employeeId: 1 });


const PresenceModel = mongoose.model("employees_presence", presenceSchema, "employees_presence");

export default PresenceModel;
