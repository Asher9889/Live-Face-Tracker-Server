import AttendanceModel from "./attendance.model";
import * as luxon from 'luxon';
import { EntryType, ExitType } from "../../domain/types";
import PresenceModel from "../presence/presence.model";
import { DateTime } from "luxon";
import {
    AttendanceEmployeeCalendarQueryDTO,
    AttendanceEmployeeExportQueryDTO,
    AttendanceEmployeeSummaryQueryDTO,
    AttendanceEmployeeTimelineQueryDTO,
    AttendanceEventDTO,
    AttendanceEventsQueryDTO,
    AttendenceQueryDTO
} from "./attendance.types";
import { todayDate } from "../../utils";
import { ObjectId } from "mongodb";
import { PipelineStage } from "mongoose";
import { envConfig } from "../../config";
import { PresenceLogModel } from "../presence/logs/presence-log.model";
import CameraModel from "../cameras/infrastructure/camera.model";
import { ApiError } from "../../utils";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";

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
type AttendanceFlag = "LATE_ENTRY" | "EARLY_EXIT" | "MISSING_EXIT" | "OVERTIME";
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

    flags: AttendanceFlag[];

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

type TimelineEventType = "ENTRY" | "EXIT";
type AttendanceCalendarStatus = "PRESENT" | "ABSENT" | "PARTIAL" | "ANOMALY";
type ExportJobStatus = "QUEUED" | "COMPLETED";

type ExportJob = {
    jobId: string;
    status: ExportJobStatus;
    createdAt: number;
    fileName: string;
    contentBase64: string;
};


export default class AttendanceService {

    private exportJobs = new Map<string, ExportJob>();

    async getEmployeeTimelineByDate(employeeId: string, query: AttendanceEmployeeTimelineQueryDTO) {
        const { date, timezone } = query;
        const { dayStartMs, dayEndMs } = this.getDayBounds(date, timezone);

        const logs = await PresenceLogModel.find({
            employeeId,
            occurredAt: { $gte: dayStartMs, $lte: dayEndMs },
            eventType: { $in: ["ENTRY_DETECTED", "EXIT_DETECTED", "AUTO_EXIT_TIMEOUT", "SYSTEM_RECOVERY", "MANUAL_CORRECTION"] },
        }).sort({ occurredAt: 1 }).lean();

        const cameraMap = await this.getCameraMap(logs.map((log: any) => log.cameraCode).filter(Boolean));

        const events = logs.map((log: any, index: number) => {
            const camera = cameraMap.get(log.cameraCode ?? "");
            const type: TimelineEventType = log.eventType === "ENTRY_DETECTED" ? "ENTRY" : "EXIT";
            const timestamp = this.toIsoWithZone(log.occurredAt, timezone);

            return {
                eventId: log._id?.toString?.() ?? `evt_${index + 1}`,
                timestamp,
                type,
                cameraId: camera?.id ?? null,
                cameraCode: log.cameraCode ?? null,
                cameraName: camera?.name ?? null,
                confidence: typeof log.confidence === "number" ? log.confidence : null,
                status: "VERIFIED",
                source: this.mapLogSource(log.source),
                note: log.note ?? this.mapTimelineNote(log.eventType),
            };
        });

        const computed = this.computeTimelineSummary(events);

        return {
            employeeId,
            date,
            timezone,
            events,
            computed,
        };
    }

    async getEmployeeMonthlySummary(employeeId: string, query: AttendanceEmployeeSummaryQueryDTO) {
        const { month, timezone } = query;
        const { monthStartDate, monthEndDate } = this.getMonthBounds(month, timezone);
        const sessions = await this.getAttendanceSessionsInRange(employeeId, monthStartDate, monthEndDate);
        const groupedByDay = this.groupSessionsByDate(sessions);

        const presentDays = groupedByDay.size;
        const workingDays = this.countWorkingDays(monthStartDate, monthEndDate, timezone);

        let totalDurationMinutes = 0;
        let lateArrivals = 0;
        const locations = new Set<string>();

        for (const [_, day] of groupedByDay) {
            totalDurationMinutes += Math.round(day.totalDurationMs / 60000);
            if (day.firstEntryAt && this.isLateArrival(day.firstEntryAt, timezone)) {
                lateArrivals += 1;
            }
            day.sessions.forEach((session: any) => {
                if (session.entryCameraCode) locations.add(session.entryCameraCode);
                if (session.exitCameraCode) locations.add(session.exitCameraCode);
            });
        }

        const avgHoursPerDay = presentDays > 0
            ? Number((totalDurationMinutes / presentDays / 60).toFixed(1))
            : 0;

        return {
            employeeId,
            month,
            workingDays,
            presentDays,
            avgHoursPerDay,
            lateArrivals,
            locationsVisited: locations.size,
            totalDurationMinutes,
        };
    }

    async getEmployeeCalendarByMonth(employeeId: string, query: AttendanceEmployeeCalendarQueryDTO) {
        const { month, timezone } = query;
        const { monthStartDate, monthEndDate } = this.getMonthBounds(month, timezone);
        const sessions = await this.getAttendanceSessionsInRange(employeeId, monthStartDate, monthEndDate);
        const groupedByDay = this.groupSessionsByDate(sessions);

        const days: any[] = [];
        let cursor = DateTime.fromISO(monthStartDate, { zone: timezone }).startOf("day");
        const end = DateTime.fromISO(monthEndDate, { zone: timezone }).startOf("day");

        while (cursor <= end) {
            const date = cursor.toFormat("yyyy-MM-dd");
            const day = groupedByDay.get(date);

            if (!day) {
                days.push({
                    date,
                    status: "ABSENT",
                    firstEntryAt: null,
                    lastExitAt: null,
                    durationMinutes: 0,
                    hasAnomaly: false,
                });
            } else {
                const entriesCount = day.sessions.length;
                const exitsCount = day.sessions.filter((s: any) => s.exitAt).length;
                const flags: string[] = [];

                if (entriesCount > exitsCount) {
                    flags.push("MISSING_EXIT");
                }
                if (exitsCount > entriesCount) {
                    flags.push("EXTRA_EXIT");
                }

                const hasAnomaly = flags.length > 0;
                const status: AttendanceCalendarStatus = hasAnomaly
                    ? "ANOMALY"
                    : entriesCount > 0 && entriesCount === exitsCount
                        ? "PRESENT"
                        : "PARTIAL";

                days.push({
                    date,
                    status,
                    firstEntryAt: day.firstEntryAt ? this.toIsoWithZone(day.firstEntryAt, timezone) : null,
                    lastExitAt: day.lastExitAt ? this.toIsoWithZone(day.lastExitAt, timezone) : null,
                    durationMinutes: Math.round(day.totalDurationMs / 60000),
                    hasAnomaly,
                    ...(flags.length > 0 ? { flags } : {}),
                });
            }

            cursor = cursor.plus({ days: 1 });
        }

        return {
            employeeId,
            month,
            days,
        };
    }

    async exportEmployeeHistory(employeeId: string, query: AttendanceEmployeeExportQueryDTO) {
        const { from, to, timezone, async: runAsync } = query;
        const { csv, fileName } = await this.generateEmployeeHistoryCsv(employeeId, from, to, timezone);

        if (!runAsync) {
            return {
                type: "file" as const,
                fileName,
                content: csv,
            };
        }

        const jobId = `exp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
        this.exportJobs.set(jobId, {
            jobId,
            status: "QUEUED",
            createdAt: Date.now(),
            fileName,
            contentBase64: Buffer.from(csv, "utf-8").toString("base64"),
        });

        return {
            type: "job" as const,
            data: {
                jobId,
                status: "QUEUED",
            },
        };
    }

    async getAttendanceExportJob(jobId: string) {
        const job = this.exportJobs.get(jobId);
        if (!job) {
            throw new ApiError(StatusCodes.NOT_FOUND, "Export job not found", [{ field: "jobId", message: "Export job not found" }]);
        }

        if (job.status === "QUEUED") {
            job.status = "COMPLETED";
            this.exportJobs.set(jobId, job);
        }

        return {
            jobId: job.jobId,
            status: job.status,
            downloadUrl: `data:text/csv;base64,${job.contentBase64}`,
            fileName: job.fileName,
        };
    }

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
        const raw = await AttendanceModel.aggregate(pipeline);
        // firstEntry, lastExit , totalDurationMinutes , breakDurationMinutes ,status, flags
        const data = raw[0];
        const sessions = raw[0].sessions;

        data.firstEntry = sessions[0]?.entryAt;
        data.lastExit = sessions[sessions.length - 1].exitAt ?? null;

        const now = Date.now();

        /**
         * if exitAt and duration present takes totalDurationMs else += now - last.entryAt
        */
        let totalDurationMs = 0;
        for (const s of sessions) {
            if (s.exitAt && s.durationMs) {
                totalDurationMs += s.durationMs;
            } else {
                // open session (live)
                totalDurationMs += now - s.entryAt;
            }
        }
        data.totalDurationMinutes = Number((totalDurationMs / 60000).toFixed(1));

        /**
         * Break: next.entryAt - previous.exitAt
         */
        let breakMs = 0;
        for (let i = 0; i < sessions.length - 1; i++) {
            const current = sessions[i];
            const next = sessions[i + 1];

            if (!current.exitAt) continue;

            const gap = next.entryAt - current.exitAt;
            if (gap > 0) breakMs += gap;
        }

        data.breakDurationMinutes = Number((breakMs / 60000).toFixed(1));
        /**
         * 
         */

        const hasAnySession = sessions.length > 0;
        const hasOpenSession = sessions.some((s: any) => !s.exitAt);
        const allClosed = sessions.every((s: any) => s.exitAt);
        const isToday = data.date === todayDate();

        if (!hasAnySession) {
            data.status = "ABSENT";
        }
        else if (hasOpenSession) {
            data.status = isToday ? "ONGOING" : "INCOMPLETE"; // safety net
        }
        else if (allClosed) {
            data.status = "COMPLETED";
        }
        else {
            data.status = "INCOMPLETE"; // safety net
        }

        let flags: AttendanceFlag[] = [];
        // Flags
        if (data.firstEntry && data.firstEntry > envConfig.officeStartTime) {
            flags.push("LATE_ENTRY");
        }

        data.flags = flags;
        return data;
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
                        email: "$employee.email"
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
                sessions: 1,
            },
        });

        return pipeline;
    }

    private getEmployeeIdQuery(employeeId: string): any {
        if (ObjectId.isValid(employeeId)) {
            return {
                $or: [
                    { employeeId },
                    { employeeId: new ObjectId(employeeId) }
                ],
            };
        }

        return { employeeId };
    }

    private getDayBounds(date: string, timezone: string) {
        const dt = DateTime.fromISO(date, { zone: timezone }).startOf("day");
        return {
            dayStartMs: dt.toMillis(),
            dayEndMs: dt.endOf("day").toMillis(),
        };
    }

    private getMonthBounds(month: string, timezone: string) {
        const start = DateTime.fromFormat(month, "yyyy-MM", { zone: timezone }).startOf("month");
        const end = start.endOf("month");
        return {
            monthStartDate: start.toFormat("yyyy-MM-dd"),
            monthEndDate: end.toFormat("yyyy-MM-dd"),
        };
    }

    private toIsoWithZone(ts: number, timezone: string) {
        return DateTime.fromMillis(ts, { zone: timezone }).toISO({ suppressMilliseconds: true }) ?? "";
    }

    private mapLogSource(source: "face_recognition" | "manual" | "system" | undefined) {
        if (source === "manual") return "MANUAL";
        if (source === "system") return "SYSTEM";
        return "FACE_AI";
    }

    private mapTimelineNote(eventType: string) {
        if (eventType === "ENTRY_DETECTED") return "Face Verified";
        if (eventType === "EXIT_DETECTED") return "Exit Verified";
        if (eventType === "AUTO_EXIT_TIMEOUT") return "Auto Exit Timeout";
        if (eventType === "SYSTEM_RECOVERY") return "System Recovery";
        if (eventType === "MANUAL_CORRECTION") return "Manual Correction";
        return "";
    }

    private computeTimelineSummary(events: Array<{ timestamp: string; type: TimelineEventType }>) {
        const entries = events.filter((event) => event.type === "ENTRY");
        const exits = events.filter((event) => event.type === "EXIT");

        const entryTimestamps: number[] = [];
        let totalDurationMs = 0;
        let breakDurationMs = 0;
        let previousExitTs: number | null = null;

        for (const event of events) {
            const ts = DateTime.fromISO(event.timestamp).toMillis();
            if (event.type === "ENTRY") {
                if (previousExitTs !== null && ts > previousExitTs) {
                    breakDurationMs += ts - previousExitTs;
                }
                previousExitTs = null;
                entryTimestamps.push(ts);
            } else if (event.type === "EXIT") {
                const openEntry = entryTimestamps.shift();
                if (typeof openEntry === "number" && ts > openEntry) {
                    totalDurationMs += ts - openEntry;
                }
                previousExitTs = ts;
            }
        }

        const flags: string[] = [];
        let sessionStatus: "ABSENT" | "ONGOING" | "COMPLETED" | "INCOMPLETE" = "ABSENT";
        if (events.length === 0) {
            sessionStatus = "ABSENT";
        } else if (entries.length > exits.length) {
            sessionStatus = "ONGOING";
            flags.push("MISSING_EXIT");
        } else if (entries.length === exits.length) {
            sessionStatus = "COMPLETED";
        } else {
            sessionStatus = "INCOMPLETE";
            flags.push("EXTRA_EXIT");
        }

        return {
            firstEntryAt: entries[0]?.timestamp ?? null,
            lastExitAt: exits.length > 0 ? exits.at(-1)?.timestamp ?? null : null,
            entriesCount: entries.length,
            exitsCount: exits.length,
            totalDurationMinutes: Math.round(totalDurationMs / 60000),
            breakDurationMinutes: Math.round(breakDurationMs / 60000),
            sessionStatus,
            flags,
        };
    }

    private async getCameraMap(cameraCodes: string[]) {
        const uniqueCodes = [...new Set(cameraCodes)];
        if (uniqueCodes.length === 0) {
            return new Map<string, { id: string; name: string; code: string }>();
        }

        const cameras = await CameraModel.find(
            { code: { $in: uniqueCodes } },
            { _id: 1, code: 1, name: 1 }
        ).lean();

        const cameraMap = new Map<string, { id: string; name: string; code: string }>();
        cameras.forEach((camera: any) => {
            cameraMap.set(camera.code, {
                id: camera._id?.toString?.() ?? "",
                name: camera.name,
                code: camera.code,
            });
        });
        return cameraMap;
    }

    private async getAttendanceSessionsInRange(employeeId: string, fromDate: string, toDate: string) {
        return AttendanceModel.find({
            ...this.getEmployeeIdQuery(employeeId),
            date: { $gte: fromDate, $lte: toDate },
        } as any).sort({ entryAt: 1 }).lean();
    }

    private groupSessionsByDate(sessions: any[]) {
        const groupedByDay = new Map<string, {
            date: string;
            firstEntryAt: number | null;
            lastExitAt: number | null;
            totalDurationMs: number;
            sessions: any[];
        }>();

        for (const session of sessions) {
            const day = groupedByDay.get(session.date) ?? {
                date: session.date,
                firstEntryAt: null,
                lastExitAt: null,
                totalDurationMs: 0,
                sessions: [] as any[],
            };

            if (!day.firstEntryAt || session.entryAt < day.firstEntryAt) {
                day.firstEntryAt = session.entryAt;
            }
            if (session.exitAt && (!day.lastExitAt || session.exitAt > day.lastExitAt)) {
                day.lastExitAt = session.exitAt;
            }

            day.totalDurationMs += Number(session.durationMs ?? 0);
            day.sessions.push(session);

            groupedByDay.set(session.date, day);
        }

        return groupedByDay;
    }

    private countWorkingDays(monthStartDate: string, monthEndDate: string, timezone: string) {
        let count = 0;
        let cursor = DateTime.fromISO(monthStartDate, { zone: timezone }).startOf("day");
        const end = DateTime.fromISO(monthEndDate, { zone: timezone }).startOf("day");

        while (cursor <= end) {
            if (cursor.weekday <= 5) count += 1;
            cursor = cursor.plus({ days: 1 });
        }

        return count;
    }

    private isLateArrival(timestamp: number, timezone: string) {
        const dt = DateTime.fromMillis(timestamp, { zone: timezone });
        const msFromMidnight = ((dt.hour * 60) + dt.minute) * 60 * 1000;
        return msFromMidnight > envConfig.officeStartTime;
    }

    private async generateEmployeeHistoryCsv(employeeId: string, fromDate: string, toDate: string, timezone: string) {
        const { dayStartMs } = this.getDayBounds(fromDate, timezone);
        const { dayEndMs } = this.getDayBounds(toDate, timezone);

        const logs = await PresenceLogModel.find({
            employeeId,
            occurredAt: { $gte: dayStartMs, $lte: dayEndMs },
            eventType: { $in: ["ENTRY_DETECTED", "EXIT_DETECTED", "AUTO_EXIT_TIMEOUT", "SYSTEM_RECOVERY", "MANUAL_CORRECTION"] },
        }).sort({ occurredAt: 1 }).lean();

        const cameraMap = await this.getCameraMap(logs.map((log: any) => log.cameraCode).filter(Boolean));

        const rows = logs.map((log: any, index: number) => {
            const camera = cameraMap.get(log.cameraCode ?? "");
            const type: TimelineEventType = log.eventType === "ENTRY_DETECTED" ? "ENTRY" : "EXIT";
            return {
                eventId: log._id?.toString?.() ?? `evt_${index + 1}`,
                timestamp: this.toIsoWithZone(log.occurredAt, timezone) ?? "",
                type,
                cameraId: camera?.id ?? "",
                cameraCode: log.cameraCode ?? "",
                cameraName: camera?.name ?? "",
                confidence: typeof log.confidence === "number" ? log.confidence : "",
                status: "VERIFIED",
                source: this.mapLogSource(log.source),
                note: log.note ?? this.mapTimelineNote(log.eventType),
            };
        });

        const headers = ["eventId", "timestamp", "type", "cameraId", "cameraCode", "cameraName", "confidence", "status", "source", "note"];
        const lines = [headers.join(",")];

        rows.forEach((row) => {
            const values = headers.map((header) => this.csvEscape((row as any)[header] ?? ""));
            lines.push(values.join(","));
        });

        const csv = lines.join("\n");
        const fileName = `attendance_${employeeId}_${fromDate}_to_${toDate}.csv`;

        return { csv, fileName };
    }

    private csvEscape(value: string | number) {
        const text = String(value);
        if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }




}


