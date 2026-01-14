import AttendanceModel from "./attendance.model";
import * as luxon from 'luxon';
import { EntryType, ExitType } from "../../domain/types";
import PresenceModel from "../presence/presence.model";
import { DateTime } from "luxon";
import { AttendanceEventsQueryDTO, AttendenceQueryDTO } from "./attendance.types";
import { todayDate } from "../../utils";
import { stat } from "fs";

type StartSessionInput = {
    employeeId: String;
    entryAt: number;
    entrySource: EntryType;
    entryConfidence: number;
}

type CloseSessionInput = {
    employeeId: String;
    exitAt: number;
    exitSource: ExitType;
    exitConfidence: number
}

export default class AttendanceService {

    async getAttendanceEvents(filter: AttendanceEventsQueryDTO) {
        const { from, to, status, type, cursor, limit } = filter;

        const today = todayDate(); // "YYYY-MM-DD"
        const isTodayOnly = from === today && to === today;
        const includesToday = to >= today;
        const includesPast = from < today;

        let records: any[] = [];

        if (isTodayOnly) {
            const filter = this.buildTodayQueryFilter({ from, to, status, type, cursor, limit }); 
            const data = await PresenceModel.find(filter).sort({lastChangedAt : -1}).limit(limit + 1).lean();
            records = data;
        }

        const buildPresenceFilter = () => {
            const q: Record<string, any> = {
                date: today,
            };

            if (type.length === 1) {
                q.lastGate = { $in: type };
            }

            if (status.length === 1) {
                if (status[0] === "VERIFIED") {
                    q.employeeId = { $exists: true, $ne: null };
                } else {
                    q.$or = [{ employeeId: { $exists: false } }, { employeeId: null }];
                }
            }

            if (cursor) {
                q.lastChangedAt = { $lt: cursor };
            }

            return q;
        };

        const buildAttendanceFilter = () => {
            const q: Record<string, any> = {
                date: { $gte: from, $lte: to },
            };

            if (type.length === 1) {
                q.exitSource = { $in: type };
            }

            if (status.length === 1) {
                q.employeeId =
                    status[0] === "VERIFIED"
                        ? { $exists: true }
                        : { $exists: false };
            }

            if (cursor) {
                q.exitAt = { $lt: cursor };
            }

            return q;
        };

        // let queryFilter: Record<string, any> = {
        //     date: { $gte: from, $lte: to },
        //     lastGate: { $in: type },
        // }

        // if (status.length === 1) {
        //     if (status[0] === "VERIFIED") {
        //         queryFilter.employeeId = { $exists: true, $ne: null };
        //     }
        //     if (status[0] === "UNKNOWN") {
        //         queryFilter.$or = [{ employeeId: { $exists: false } }, { employeeId: null }];
        //     }
        // }

        // if (cursor) {
        //     queryFilter.lastChangedAt = { $lt: cursor };
        // }

        // if (from === todayDate()) {
        //     records = await PresenceModel.find(queryFilter).sort({ lastChangedAt: -1 }).limit(limit + 1).lean();
        // }

        // // 1️⃣ TODAY → Presence
        // if (isTodayOnly || includesToday) {
        //     const presenceRecords = await PresenceModel.find(buildPresenceFilter()).sort({ lastChangedAt: -1 })
        //         .limit(limit + 1).lean();

        //     records.push(...presenceRecords);
        // }

        // // 2️⃣ PAST → Attendance
        // if (includesPast) {
        //     const attendanceRecords = await AttendanceModel.find(buildAttendanceFilter())
        //         .sort({ exitAt: -1 })
        //         .limit(limit + 1)
        //         .lean();

        //     records.push(...attendanceRecords);
        // }

        // records.sort((a, b) => {
        //     const ta = a.lastChangedAt ?? a.exitAt;
        //     const tb = b.lastChangedAt ?? b.exitAt;
        //     return tb - ta;
        // });

        const hasMore = records.length > limit;

        const data = hasMore ? records.slice(0, limit) : records;
        const nextCursor = hasMore ? records[records.length - 1]?.lastChangedAt : null;
        // const nextCursor = data.length > 0 ? data[data.length - 1].lastChangedAt ?? data[data.length - 1].exitAt : null;

        return { attendanceEvents: data, nextCursor, hasMore };
    }

    async openSession(params: StartSessionInput) {
        const { employeeId, entryAt, entrySource, entryConfidence } = params;
        const oneSession = await AttendanceModel.findOne({ employeeId, exitAt: { $exists: false } }).lean();
        if (oneSession) {
            // it means one session is already active
            // in there there might some bug exists
            return;
        }
        // create new session
        const newSession = new AttendanceModel({
            employeeId,
            entryAt,
            entrySource,
            date: this.toAttendenceDate(entryAt),
            entryConfidence
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

    async getAttendanceForEmployee(params: { employeeId: string; fromDate: string; toDate: string; }) {
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

    private buildTodayQueryFilter(filter: AttendanceEventsQueryDTO) {
        const { status, cursor, limit, type } = filter;

        let queryFilter: Record<string, any> = {
            date: todayDate(),
        }
        if (type?.length > 0) {
            queryFilter.lastGate = { $in: type };
        }

        if (status.length === 1) {
            if (status[0] === "VERIFIED") {
                queryFilter.employeeId = { $exists: true, $ne: null };
            }
            if (status[0] === "UNKNOWN") {
                queryFilter.$or = [{ employeeId: { $exists: false } }, { employeeId: null }];
            }
        }

        if (cursor) {
            queryFilter.lastChangedAt = { $lt: cursor };
        }

        return queryFilter;
    }
}
