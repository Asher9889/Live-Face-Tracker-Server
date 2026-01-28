import mongoose from "mongoose";
import { ObjectId } from "mongodb";

interface Unknown extends mongoose.Document {
    eventId: string,
    cameraCode: string,
    pid: number,
    reason: "unknown" | "known",
    tid: number,
    timestamp: number,        // camera timestamp (NOT createdAt)
    faceImages: {
        type: [String]
    },
    //   receivedAt: Date,         // server time
    //   idempotencyKey: string,   // unique
}

const unknownSchema = new mongoose.Schema<Unknown>({
    eventId: {
        type: String, // uuid
        required: true
    },
    cameraCode: {
        type: String
    },
    pid: {
        type: Number
    },
    reason: {
        type: String,
        enum: ["unknown"],
        default: "unknown"
    },
    tid: {
        type: Number
    },
    timestamp: {
        type: Number
    },
    faceImages: {
        type: [String]
    }
})

const Unknown = mongoose.model<Unknown>("Unknown", unknownSchema);

export default Unknown;