import mongoose, { Document } from "mongoose";
import { PRESENCE_STATE, PresenceState, GateRole, GATE_ROLE } from "./presence.types";

interface IPresenceSchemaData extends Document {
  employeeId: string;
  state: PresenceState; // Current session state

  // Boundary timestamps
  lastSeenAt: number;       // last time ANY gate saw the person
  lastChangedAt: number;    // last time state changed (IN <-> OUT)

  // Boundary context
  lastGate: GateRole;       // ENTRY or EXIT
  lastCameraCode: string;   // which camera last saw the person
}


const PresenceSchema = new mongoose.Schema<IPresenceSchemaData>({
  employeeId: { type: String, required: true },
  state: { type: String, enum: Object.values(PRESENCE_STATE) , required: true },

  lastSeenAt: { type: Number, required: true, index: true },
  lastChangedAt: { type: Number, required: true, index: true },

  lastGate: { type: String, enum: Object.values(GATE_ROLE), required: true },
  lastCameraCode: { type: String, required: true, index: true },
}, { versionKey: false , timestamps: true });

const PresenceModel = mongoose.model("employees_presence", PresenceSchema, "employees_presence");

export default PresenceModel;
