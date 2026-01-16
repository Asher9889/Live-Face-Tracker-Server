import AttendanceModel from "./attendance.model";
import * as luxon from 'luxon';
import { EntryType, ExitType } from "../../domain/types";
import PresenceModel from "../presence/presence.model";
import { DateTime } from "luxon";
import { AttendanceEventDTO, AttendanceEventsQueryDTO, AttendenceQueryDTO } from "./attendance.types";
import { todayDate } from "../../utils";
import { ObjectId } from "mongodb";
import { PipelineStage } from "mongoose";
import { envConfig } from "../../config";

type StartSessionInput = {
    employeeId: String;
    entryAt: number;
    entrySource: EntryType;
    entryCameraCode: string;
    entryConfidence: number;
}

type CloseSessionInput = {
    employeeId: String;
    exitAt: number;
    exitSource: ExitType;
    exitCameraCode: string;
    exitConfidence: number
}

// internal, NOT exported to frontend
interface TodayAttendanceSessionAggResult {
    employee: {
        id: string;
        name: string;
        avatar?: string;
        department: string;
        role: string;
        email?: string;
    };

    date: string;

    firstEntry?: number;
    lastExit?: number;

    totalDurationMinutes?: number;
    breakDurationMinutes?: number;

    status: "COMPLETED" | "ONGOING";

    flags: string[];

    sessions: Array<{
        entryAt: number;
        exitAt?: number;
        entryConfidence?: number;
        exitConfidence?: number;
        entryCameraCode?: string;
        exitCameraCode?: string;
        entrySource: string;
        exitSource?: string;
        durationMs?: number;
    }>;
}


export default class AttendanceService {

    async getAttendanceEvents(filter: AttendanceEventsQueryDTO) {
        const { from, to, status, type, cursor, limit } = filter;

        const today = todayDate(); // "YYYY-MM-DD"
        // const today = "2026-01-15"; // "YYYY-MM-DD"
        const isTodayOnly = from === today && to === today;
        // const isTodayOnly = true
        // const isPastOnly = to < today;
        const isPastOnly = false;

        let records: any[] = [];

        if (isTodayOnly) {
            const aggregationPipeline = this.buildTodayPresencePipeline({ from: today, to: today, status, type, cursor, limit });
            const data = await PresenceModel.aggregate(aggregationPipeline);
            records = data;
        }

        if (isPastOnly) {



        }
        const hasMore = records.length > limit;

        const data = hasMore ? records.slice(0, limit) : records;
        const nextCursor = hasMore ? records[records.length - 1]?.lastChangedAt : null;
        // const nextCursor = data.length > 0 ? data[data.length - 1].lastChangedAt ?? data[data.length - 1].exitAt : null;

        return { attendanceEvents: data, nextCursor, hasMore };
    }

    async getEmployeeTodayAttendanceSession(employeeId: string) {
        const pipeline = this.getEmployeeTodayAttendanceSessionPipeline(employeeId);
        const raw = await AttendanceModel.aggregate<TodayAttendanceSessionAggResult>(pipeline);
        const session = raw[0];

        if (session?.status === "ONGOING") {
            const now = Date.now();
            const openSession = session.sessions.find((s) => !s.exitAt);
            if (!openSession) return;

            const liveMinutes = Number(((now - openSession.entryAt) / 60000).toFixed(1));
            session.totalDurationMinutes = (session.totalDurationMinutes ?? 0) + liveMinutes;
        }
        return session;
    }

    async openSession(params: StartSessionInput) {
        const { employeeId, entryAt, entrySource, entryConfidence, entryCameraCode } = params;
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
            entryConfidence,
            entryCameraCode,
        });
        await newSession.save();
    }

    async endSession(params: CloseSessionInput) {
        let { employeeId, exitAt, exitSource, exitCameraCode } = params;
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
        openSession.exitCameraCode = exitCameraCode;
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
                date: from,
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

    private buildPastPipeline(filter: AttendanceEventsQueryDTO) {
        const { status, type, cursor, limit, from, to } = filter;
        const pipeline: any[] = [];

        pipeline.push({
            $match: {
                date: { $gte: from, $lte: to }
            }
        });

        if (type.length === 1) {
            if (type[0] === "EXIT") {
                pipeline.push({
                    $match: { exitAt: { $exists: true } }
                });
            }
            // ENTRY = default, no extra filter
        }

        if (cursor) {
            pipeline.push({
                $match: { exitAt: { $lt: cursor } }
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

            pipeline.push({
                $lookup: {
                    from: "employees",
                    localField: "employeeId",
                    foreignField: "id",
                    as: "employee"
                }
            });

            pipeline.push({
                $unwind: {
                    path: "$employee",
                    preserveNullAndEmptyArrays: true
                }
            });

            pipeline.push({
                $project: {
                    _id: 0,
                    id: { $toString: "$_id" },

                    employeeId: 1,
                    employeeName: { $ifNull: ["$employee.name", "Unknown Person"] },
                    employeeAvatar: { $arrayElemAt: ["$employee.faceImages", 0] },

                    timestamp: { $toDate: "$exitAt" },
                    type: "EXIT",
                    gate: "$exitCameraCode",

                    status: {
                        $cond: [
                            { $ifNull: ["$employeeId", false] },
                            "VERIFIED",
                            "UNKNOWN"
                        ]
                    },

                    confidence: { $ifNull: ["$exitConfidence", 0] },
                    source: "$exitSource",

                    isLate: false,
                    isEarlyExit: false,
                }
            });


        }

        return pipeline;
    }

    private getEmployeeTodayAttendanceSessionPipeline(employeeId: string): PipelineStage[] {
        const pipeline: PipelineStage[] = [];

        pipeline.push({
            $match: {
                date: todayDate(),
                employeeId: new ObjectId(employeeId),
            },
        });

        pipeline.push({
            $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employee",
            },
        });

        pipeline.push({
            $unwind: {
                path: "$employee",
                preserveNullAndEmptyArrays: false,
            },
        });

        pipeline.push({
            $sort: {
                entryAt: 1,
            },
        });

        pipeline.push({
            $group: {
                _id: "$employeeId",
                employee: {
                    $first: {
                        id: "$employee._id",
                        name: "$employee.name",
                        avatar: { $arrayElemAt: ["$employee.faceImages", 0] },
                        department: "$employee.department",
                        role: "$employee.role",
                    },
                },
                date: { $first: "$date" },
                firstEntry: { $first: "$entryAt" },
                lastExit: { $last: "$exitAt" },
                totalDurationMs: { $sum: "$durationMs" },
                sessions: {
                    $push: {
                        entryAt: "$entryAt",
                        exitAt: "$exitAt",
                        entryConfidence: "$entryConfidence",
                        exitConfidence: "$exitConfidence",
                        entryCameraCode: "$entryCameraCode",
                        exitCameraCode: "$exitCameraCode",
                        entrySource: "$entrySource",
                        exitSource: "$exitSource",
                        durationMs: "$durationMs",
                    },
                },
            },
        });

        pipeline.push({
            $project: {
                _id: 0,
                employee: 1,
                date: 1,
                firstEntry: 1,
                lastExit: 1,

                totalDurationMinutes: {
                    $divide: ["$totalDurationMs", 60000],
                },

                breakDurationMinutes: {
                    $divide: [
                        {
                            $subtract: [
                                { $subtract: ["$lastExit", "$firstEntry"] },
                                "$totalDurationMs",
                            ],
                        },
                        60000,
                    ],
                },

                status: {
                    $cond: [
                        { $gt: ["$lastExit", null] },
                        "COMPLETED",
                        "ONGOING",
                    ],
                },


                flags: {
                    $setUnion: [
                        {
                            $cond: [
                                { $gt: ["$firstEntry", envConfig.officeStartTime] },
                                ["LATE_ENTRY"],
                                [],
                            ],
                        },
                    ],
                },
                sessions: 1,
            },
        });

        return pipeline;
    }




}


