import mongoose, { Document } from "mongoose";

export const ENTRY_TYPE = {
  IN: "IN",
  OUT: "OUT",
} as const;

interface IPresenceSchemaData extends Document {
    employeeId: string;
    cameraCode: string;
    state: typeof ENTRY_TYPE[keyof typeof ENTRY_TYPE];
    lastChangedAt: number;
}


const PresenceSchema = new mongoose.Schema<IPresenceSchemaData>({
  employeeId: { type: String, required: true },
  cameraCode: { type: String, required: true },
  state: { type: String, enum: Object.values(ENTRY_TYPE) , required: true },
  lastChangedAt: { type: Number, required: true },
}, { versionKey: false , timestamps: true });

const EmployeePresence = mongoose.model("employee_presence", PresenceSchema);

export default EmployeePresence;
