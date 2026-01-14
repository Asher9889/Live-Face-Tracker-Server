import AttendanceModel from "./attendance.model";
import * as luxon from 'luxon';
import { EntryType, ExitType } from "../../domain/types";
import PresenceModel from "../presence/presence.model";
import { DateTime } from "luxon";
import { AttendanceEventsQueryDTO, AttendenceQueryDTO } from "./attendance.types";
import { todayDate } from "../../utils";
import { pipeline } from "stream";

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

        // const today = todayDate(); // "YYYY-MM-DD"
        const today = "2026-01-14"; // "YYYY-MM-DD"
        const isTodayOnly = from === today && to === today;
        const isPastOnly = to < today;

        let records: any[] = [];

        if (isTodayOnly) {
            console.log("request reached")
            const aggregationPipeline = this.buildTodayPresencePipeline({ from, to, status, type, cursor, limit });
            const data = await PresenceModel.aggregate(aggregationPipeline);
            console.log("data is", data)
            records = data;
        }

        if(isPastOnly) {
            // TODO: fetch from attendance model
            
        }

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

    private buildTodayPresencePipeline(filter: AttendanceEventsQueryDTO) {
        const { status, type, cursor, limit, from } = filter;
        const pipeline: any[] = [];

        pipeline.push({
            $match: {
                date: todayDate(),
            }
        });

        if (cursor) {
            pipeline.push({
                $match: {
                    lastChangedAt: { $lt: cursor }
                }
            });
        }

        if (type.length > 0) {
            pipeline.push({
                $match: {
                    lastGate: { $in: type }
                }
            });
        }

        if (status.length === 1) {
            if (status[0] === "VERIFIED") {
                pipeline.push({
                    $match: {
                        employeeId: { $exists: true, $ne: null }
                    }
                });
            }
            if (status[0] === "UNKNOWN") {
                pipeline.push({
                    $match: {
                        $or: [{ employeeId: { $exists: false } }, { employeeId: null }]
                    }
                });
            }
        }

        pipeline.push({
            $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "id",
                as: "employee"
            }
        })

        pipeline.push({
            $unwind: {
                path: "$employee",
                preserveNullAndEmptyArrays: true
            }
        })

        pipeline.push({
            $project: {
                _id: 0,
                id: { $toString: "$_id" },
                employeeId: 1,
                employeeName: { $ifNull: ["$employee.name", "Unknown Person"] },
                employeeAvatar: { $arrayElemAt: ["$employee.faceImages", 0] },
                lastGate: 1,
                lastCameraCode: 1,
                lastChangedAt: 1,
                lastSeenAt: 1,
                date: 1,
                status: {
                    $cond: [{ $ifNull: ["$employeeId", false] }, "VERIFIED", "UNKNOWN"]
                },
                confidence: { $ifNull: ["$confidence", 0] },
                source: "FACE_AI"
            }
        });

        pipeline.push({
            $addFields: {
                isLate: false,
                isEarlyExit: false
            }
        });

        pipeline.push(
            { $sort: { lastChangedAt: -1 } },
            { $limit: limit + 1 }
        );
        return pipeline;
    }

}
