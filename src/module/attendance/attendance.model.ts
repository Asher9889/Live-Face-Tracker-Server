import mongoose, { Document, ObjectId } from "mongoose";
import { ENTRY_TYPE, EntryType, EXIT_TYPE, ExitType } from "../../domain/types";

interface AttendanceModel extends Document {
    employeeId: ObjectId | string;
    entryAt: number;        // timestamp (ms)
    exitAt: number;
    durationMs: number;
    entrySource: EntryType;
    exitSource: ExitType;
    date: string;
}

const attendanceSchema = new mongoose.Schema<AttendanceModel>({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId || String,
        required: true,
        index: true
    },
    entryAt: {
        type: Number,
        required: true,
        index: true,
    },
    exitAt: {
        type: Number,
         required: false,
    },
    durationMs: {
        type: Number,
         required: false,
    },
    entrySource: {
        type: String,
        enum: ENTRY_TYPE,
        required: true,
    },
    exitSource: {
        type: String,
        enum: EXIT_TYPE,
        required: false,
    },
    date: {
        type: String, // YYYY-MM-DD (Most imp) // Strings are compared lexicographically (left → right).
        required: true,
        index: true,
    },
}, { timestamps: true, versionKey: false })

const AttendanceModel = mongoose.model<AttendanceModel>('Attendance', attendanceSchema);

export default AttendanceModel;