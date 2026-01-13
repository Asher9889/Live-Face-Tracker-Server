import AttendanceModel from "./attendance.model";
import * as luxon from 'luxon';
import { EntryType, ExitType } from "../../domain/types";
import PresenceModel from "../presence/presence.model";
import { DateTime } from "luxon";

type StartSessionInput = {
    employeeId: String;
    entryAt: number;
    entrySource: EntryType;
}

type CloseSessionInput = {
    employeeId: String;
    exitAt: number;
    exitSource: ExitType;
}

export default class AttendanceService {

    async getAttendanceEvents(){
        const attendanceEvents = await PresenceModel.find().lean();
        return attendanceEvents;
    }

    async openSession(params: StartSessionInput) {
        const { employeeId, entryAt, entrySource } = params;
        const oneSession = await AttendanceModel.findOne({ employeeId, exitAt: { $exists: false } }).lean();
        if (oneSession) {
            // it means one session is already active
            return;
        }
        // create new session
        const newSession = new AttendanceModel({
            employeeId,
            entryAt,
            entrySource,
            date: this.toAttendenceDate(entryAt)
        });
        await newSession.save();
    }

    async endSession(params: CloseSessionInput) {
        let { employeeId, exitAt, exitSource } = params;
        const openSession = await AttendanceModel.findOne({ employeeId, exitAt: { $exists: false } });
        if (!openSession) {
            // it means none session is active
            return;
        }

        if (exitAt < openSession.entryAt) {
            exitAt = openSession.entryAt;
        }

        const durationMs = exitAt - openSession.entryAt;

        openSession.exitAt = exitAt;
        openSession.exitSource = exitSource;
        openSession.durationMs = durationMs;

        await openSession.save();
    }

    async getAttendanceForEmployee(params: { employeeId: string; fromDate: string; toDate: string;}) {
        const { employeeId, fromDate, toDate } = params;

        return AttendanceModel.find({
            employeeId,
            date: { $gte: fromDate, $lte: toDate },
        }).sort({ entryAt: 1 });
    }

    private toAttendenceDate(ts: number) {
        const date = luxon.DateTime.fromMillis(ts, { zone: "Asia/Kolkata" }).toFormat("yyyy-MM-dd");
        return date;
    }
}
