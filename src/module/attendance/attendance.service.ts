import AttendanceModel from "./attendance.model";
import * as luxon from 'luxon';
import { EntryType, ExitType } from "../../domain/types";
import PresenceModel from "../presence/presence.model";
import { DateTime } from "luxon";
import {
    AttendanceDateQueryDTO,
    AttendanceRangeQueryDTO,
    AttendanceEmployeeCalendarQueryDTO,
    AttendanceEmployeeExportQueryDTO,
    AttendanceEmployeeSummaryQueryDTO,
    AttendanceEmployeeTimelineQueryDTO,
    AttendanceEmployeeSessionQueryDTO,
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
import EmployeeModel from "../employees/infrastructure/employee.model";
import { UnknownEventModel } from "../unknown/unknown-event.model";
import ExcelJS from "exceljs";

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
    mimeType: string;
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
        const { from, to, timezone, async: runAsync, format } = query;
        const { rows, headers, fileName } = await this.generateEmployeeHistoryRows(employeeId, from, to, timezone);

        const isXlsx = format === "xlsx";
        const mimeType = isXlsx
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv";
        const outputFileName = isXlsx ? fileName.replace(/\.csv$/, ".xlsx") : fileName;
        const content = isXlsx
            ? await this.buildEmployeeHistoryXlsx(headers, rows)
            : this.buildEmployeeHistoryCsv(headers, rows);

        if (!runAsync) {
            return {
                type: "file" as const,
                fileName: outputFileName,
                mimeType,
                content,
            };
        }

        const jobId = `exp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
        this.exportJobs.set(jobId, {
            jobId,
            status: "QUEUED",
            createdAt: Date.now(),
            fileName: outputFileName,
            mimeType,
            contentBase64: Buffer.from(content).toString("base64"),
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
            downloadUrl: `data:${job.mimeType};base64,${job.contentBase64}`,
            fileName: job.fileName,
        };
    }

    async getAttendanceEvents(filter: AttendanceEventsQueryDTO) {
        const to = DateTime.now().setZone(filter.timezone).toFormat("yyyy-MM-dd");
        const from = DateTime.fromISO(to, { zone: filter.timezone }).minus({ days: 3 }).toFormat("yyyy-MM-dd");
        const result = await this.buildAttendanceEventPage({
            dateFrom: from,
            dateTo: to,
            limit: filter.limit,
            offset: filter.offset,
            timezone: filter.timezone,
            sortBy: "timestamp",
            sortOrder: "desc",
            status: [],
            eventType: [],
        });

        return {
            attendanceEvents: result.events,
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
        };
    }

    async getAttendanceEventsByDate(query: AttendanceDateQueryDTO) {
        return this.buildAttendanceDateResponse(query);
    }

    async getAttendanceEventsByRange(query: AttendanceRangeQueryDTO) {
        return this.buildAttendanceRangeResponse(query);
    }

    async getCurrentState(query: any) {
        const date = query?.date ?? todayDate();
        const limit = typeof query?.limit === "number" ? query.limit : 100;
        const offset = typeof query?.offset === "number" ? query.offset : 0;
        const employeeId = query?.employeeId;
        const department = query?.department;
        const registeredOnly = typeof query?.registeredOnly === "boolean" ? query.registeredOnly : true;
        const includeCompleted = Boolean(query?.includeCompleted);
        const timezone = query?.timezone ?? "UTC";
        const sortBy = query?.sortBy ?? "lastSeenAt";
        const sortOrder = query?.sortOrder === "asc" ? 1 : -1;
        const isToday = date === todayDate();

        if (isToday && !includeCompleted) {
            const status = registeredOnly ? ["VERIFIED"] : [];
            let filter: any = this.buildTodayQueryFilter({ status, type: [], cursor: null, limit, from: date });

            if (employeeId) {
                filter = { ...filter, employeeId };
            }

            if (department) {
                const deptEmployees = await EmployeeModel.find({ department }, { id: 1, _id: 1 }).lean();
                const ids = deptEmployees.map((e: any) => e.id).filter(Boolean);
                const objIds = deptEmployees.map((e: any) => e._id?.toString?.()).filter(Boolean);
                const combined = [...ids, ...objIds];
                if (combined.length === 0) return { date, presentEmployees: [], stats: { totalEmployeesPresent: 0, inSession: 0, onBreak: 0, lateArrivals: 0, totalActiveSessions: 0 }, pagination: { limit, offset, total: 0 } };
                filter = { ...filter, employeeId: { $in: combined } };
            }

            filter.state = "IN";

            const total = await PresenceModel.countDocuments(filter);

            // map sortBy to actual field
            const sortFieldMap: Record<string, string> = {
                firstEntryAt: "lastChangedAt",
                lastSeenAt: "lastSeenAt",
                employeeName: "employeeName",
                department: "department",
            };

            const sortField = sortFieldMap[sortBy] ?? "lastSeenAt";

            const docs = await PresenceModel.find(filter).sort({ [sortField]: sortOrder }).skip(offset).limit(limit).lean();

            // enrich with employee info where available
            const employeeIds = docs.map((d: any) => d.employeeId).filter(Boolean);
            const employees = employeeIds.length > 0 ? await EmployeeModel.find({ $or: [{ id: { $in: employeeIds } }, { _id: { $in: employeeIds.filter((id: any) => ObjectId.isValid(id)).map((id: any) => new ObjectId(id)) } }] }).lean() : [];
            const empMap = new Map<string, any>();
            for (const e of employees) {
                empMap.set(e.id ?? e._id?.toString?.(), e);
            }

            // compute firstEntryAt per employee by aggregating AttendanceModel for the date
            const presenceEmployeeIds = docs.map((d: any) => d.employeeId).filter(Boolean);
            const objIds = presenceEmployeeIds.filter((id: any) => ObjectId.isValid(id)).map((id: any) => new ObjectId(id));
            const strIds = presenceEmployeeIds.filter((id: any) => !ObjectId.isValid(id));

            let firstEntryMap = new Map<string, number>();
            if (presenceEmployeeIds.length > 0) {
                const matchOr: any[] = [];
                if (objIds.length > 0) matchOr.push({ employeeId: { $in: objIds } });
                if (strIds.length > 0) matchOr.push({ employeeId: { $in: strIds } });

                if (matchOr.length > 0) {
                    const agg: any[] = [
                        { $match: { date, $or: matchOr } },
                        { $sort: { entryAt: 1 } },
                        { $group: { _id: "$employeeId", firstEntry: { $first: "$entryAt" } } },
                    ];

                    const aggRes: any[] = await AttendanceModel.aggregate(agg).allowDiskUse(true).exec();
                    for (const r of aggRes) {
                        const key = (r._id && typeof r._id === 'object' && r._id.toString) ? r._id.toString() : String(r._id);
                        firstEntryMap.set(key, Number(r.firstEntry));
                    }
                }
            }

            const presentEmployees = docs.map((d: any) => {
                const emp = empMap.get(d.employeeId) ?? null;
                const firstEntryMs = firstEntryMap.get(d.employeeId?.toString?.() ?? String(d.employeeId)) ?? null;
                return {
                    id: d._id?.toString?.() ?? null,
                    employeeId: d.employeeId ?? null,
                    employeeCode: emp?.id ?? d.employeeId ?? null,
                    employeeName: emp?.name ?? d.employeeName ?? "Unknown Person",
                    employeeAvatar: emp?.faceImages?.[0] ?? d.employeeAvatar ?? null,
                    department: emp?.department ?? d.department ?? null,
                    role: emp?.role ?? null,
                    currentStatus: d.state ?? (d.status === "VERIFIED" ? "PRESENT" : "OUT"),
                    firstEntryAt: firstEntryMs ? this.toIsoWithZone(firstEntryMs, timezone) : null,
                    lastSeenAt: d.lastSeenAt ?? d.lastChangedAt ?? null,
                    currentGate: d.lastCameraCode ?? null,
                    currentCameraCode: d.lastCameraCode ?? null,
                    workDurationMinutes: d.workDurationMinutes ?? null,
                    breakDurationMinutes: d.breakDurationMinutes ?? null,
                    flags: [],
                    sessionId: d._id?.toString?.() ?? null,
                };
            });

            const inSession = docs.filter((d: any) => d.state === "IN").length;

            return {
                date,
                presentEmployees,
                stats: {
                    totalEmployeesPresent: total,
                    inSession,
                    onBreak: 0,
                    lateArrivals: 0,
                    totalActiveSessions: total,
                },
                pagination: {
                    limit,
                    offset,
                    total,
                },
            };
        }

        const attendanceMatch: Record<string, any> = { date };
        const attendanceFilters: Record<string, any>[] = [];
        if (employeeId) {
            attendanceFilters.push(this.getEmployeeIdQuery(employeeId));
        }
        if (department) {
            const deptEmployees = await EmployeeModel.find({ department }, { id: 1, _id: 1 }).lean();
            const ids = deptEmployees.map((e: any) => e.id).filter(Boolean);
            const objIds = deptEmployees.map((e: any) => e._id?.toString?.()).filter(Boolean);
            const combined = [...ids, ...objIds];
            if (combined.length === 0) return { date, presentEmployees: [], stats: { totalEmployeesPresent: 0, inSession: 0, onBreak: 0, lateArrivals: 0, totalActiveSessions: 0 }, pagination: { limit, offset, total: 0 } };
            attendanceFilters.push({ employeeId: { $in: combined } });
        }

        if (attendanceFilters.length > 0) {
            attendanceMatch.$and = attendanceFilters;
        }

        const sessions = await AttendanceModel.find(attendanceMatch).sort({ entryAt: 1 }).lean();
        const employeeIds = [...new Set(sessions.map((session: any) => String(session.employeeId)).filter(Boolean))];
        const employees = employeeIds.length > 0
            ? await EmployeeModel.find({ $or: [{ _id: { $in: employeeIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } }, { id: { $in: employeeIds } }] }).lean()
            : [];
        const employeeMap = new Map<string, any>();
        for (const employee of employees as any[]) {
            employeeMap.set(employee._id.toString(), employee);
            if (employee.id) {
                employeeMap.set(String(employee.id), employee);
            }
        }

        const grouped = new Map<string, any[]>();
        for (const session of sessions as any[]) {
            const key = String(session.employeeId);
            const list = grouped.get(key) ?? [];
            list.push(session);
            grouped.set(key, list);
        }

        const presentEmployees = Array.from(grouped.entries()).map(([employeeKey, employeeSessions]) => {
            const emp = employeeMap.get(employeeKey) ?? null;
            const orderedSessions = [...employeeSessions].sort((left, right) => Number(left.entryAt) - Number(right.entryAt));
            const firstEntryAt = orderedSessions[0]?.entryAt ?? null;
            const lastSeenAt = orderedSessions.reduce((max: number | null, session: any) => {
                const sessionTs = Number(session.exitAt ?? session.entryAt ?? 0);
                return max === null || sessionTs > max ? sessionTs : max;
            }, null as number | null);
            const openSession = orderedSessions.find((session: any) => !session.exitAt);

            return {
                id: orderedSessions[0]?._id?.toString?.() ?? null,
                employeeId: emp?.id ?? emp?._id?.toString?.() ?? employeeKey,
                employeeCode: emp?.id ?? employeeKey,
                employeeName: emp?.name ?? "Unknown Person",
                employeeAvatar: emp?.faceImages?.[0] ?? null,
                department: emp?.department ?? null,
                role: emp?.role ?? null,
                currentStatus: openSession ? "IN_SESSION" : "PRESENT",
                firstEntryAt: firstEntryAt ? this.toIsoWithZone(Number(firstEntryAt), timezone) : null,
                lastSeenAt,
                currentGate: openSession?.entryCameraCode ?? orderedSessions[orderedSessions.length - 1]?.exitCameraCode ?? null,
                currentCameraCode: openSession?.entryCameraCode ?? orderedSessions[orderedSessions.length - 1]?.exitCameraCode ?? null,
                workDurationMinutes: orderedSessions.reduce((sum: number, session: any) => sum + Number(session.durationMs ?? 0), 0) / 60000,
                breakDurationMinutes: 0,
                flags: openSession ? ["MISSING_EXIT"] : [],
                sessionId: orderedSessions[0]?._id?.toString?.() ?? null,
            };
        });

        const total = presentEmployees.length;
        const sortedEmployees = presentEmployees.sort((left, right) => {
            const direction = sortOrder === 1 ? 1 : -1;
            let comparison = 0;
            if (sortBy === "employeeName") {
                comparison = String(left.employeeName).localeCompare(String(right.employeeName));
            } else if (sortBy === "department") {
                comparison = String(left.department ?? "").localeCompare(String(right.department ?? ""));
            } else if (sortBy === "firstEntryAt") {
                comparison = Number(left.firstEntryAt ? DateTime.fromISO(left.firstEntryAt).toMillis() : 0) - Number(right.firstEntryAt ? DateTime.fromISO(right.firstEntryAt).toMillis() : 0);
            } else {
                comparison = Number(left.lastSeenAt ?? 0) - Number(right.lastSeenAt ?? 0);
            }

            if (comparison !== 0) {
                return comparison * direction;
            }

            return 0;
        });

        const paginatedEmployees = sortedEmployees.slice(offset, offset + limit);

        return {
            date,
            presentEmployees: paginatedEmployees,
            stats: {
                totalEmployeesPresent: total,
                inSession: sortedEmployees.filter((employee) => employee.currentStatus === "IN_SESSION").length,
                onBreak: 0,
                lateArrivals: 0,
                totalActiveSessions: total,
            },
            pagination: {
                limit,
                offset,
                total,
            },
        };
    }

    async getEmployeeTodayAttendanceSession(employeeId: string, query?: AttendanceEmployeeSessionQueryDTO) {
        const employee = await this.resolveEmployee(employeeId);
        if (!employee) {
            throw new ApiError(StatusCodes.NOT_FOUND, "Employee not found", [{ field: "employeeId", message: "Employee not found" }]);
        }

        const today = query?.date ?? todayDate();
        const timezone = query?.timezone ?? "UTC";
        const sessions = await AttendanceModel.find({
            ...this.getEmployeeIdQuery(employeeId),
            date: today,
        }).sort({ entryAt: 1 }).lean();

        const firstEntry = sessions[0]?.entryAt ?? null;
        const lastClosedExit = [...sessions].reverse().find((session: any) => session.exitAt)?.exitAt ?? null;

        const now = Date.now();
        let totalDurationMs = 0;
        for (const session of sessions) {
            if (typeof session.durationMs === "number" && session.exitAt) {
                totalDurationMs += session.durationMs;
            } else {
                totalDurationMs += Math.max(0, now - Number(session.entryAt));
            }
        }

        let breakMs = 0;
        for (let index = 0; index < sessions.length - 1; index++) {
            const current = sessions[index];
            const next = sessions[index + 1];

            if (!current || !next) continue;

            if (!current.exitAt) continue;

            const gap = Number(next.entryAt) - Number(current.exitAt);
            if (gap > 0) breakMs += gap;
        }

        const hasAnySession = sessions.length > 0;
        const hasOpenSession = sessions.some((session: any) => !session.exitAt);
        const allClosed = sessions.every((session: any) => session.exitAt);

        const status = !hasAnySession
            ? "INCOMPLETE"
            : hasOpenSession
                ? "ONGOING"
                : allClosed
                    ? "COMPLETED"
                    : "INCOMPLETE";

        const flags: AttendanceFlag[] = [];
        if (firstEntry && firstEntry > envConfig.officeStartTime) {
            flags.push("LATE_ENTRY");
        }
        if (lastClosedExit && lastClosedExit < envConfig.officeEndTime) {
            flags.push("EARLY_EXIT");
        }
        if (hasAnySession && sessions.some((session: any) => !session.exitAt)) {
            flags.push("MISSING_EXIT");
        }

        return {
            sessionId: `${employeeId}_${today}`,
            employee: {
                id: employee.id ?? employee._id?.toString?.() ?? employeeId,
                name: employee.name,
                avatar: employee.faceImages?.[0] ?? null,
                department: employee.department ?? null,
                role: employee.role ?? null,
                email: employee.email ?? null,
            },
            date: today,
            firstEntry,
            lastExit: lastClosedExit,
            totalDurationMinutes: Math.round(totalDurationMs / 60000),
            breakDurationMinutes: Math.round(breakMs / 60000),
            status,
            flags,
            sessions: sessions.map((session: any) => ({
                id: session._id?.toString?.() ?? `${employeeId}_${session.entryAt}`,
                type: "ENTRY",
                entryAt: session.entryAt,
                exitAt: session.exitAt ?? null,
                entryCameraCode: session.entryCameraCode ?? null,
                exitCameraCode: session.exitCameraCode ?? null,
                entryConfidence: session.entryConfidence ?? null,
                exitConfidence: session.exitConfidence ?? null,
                entrySource: session.entrySource ?? null,
                exitSource: session.exitSource ?? null,
            })),
        };
    }

    private async buildAttendanceDateResponse(query: AttendanceDateQueryDTO) {
        const result = await this.buildAttendanceEventPage({
            dateFrom: query.date,
            dateTo: query.date,
            limit: query.limit,
            offset: query.offset,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
            timezone: query.timezone,
            status: query.status,
            eventType: query.eventType,
            ...(query.employeeId ? { employeeId: query.employeeId } : {}),
            ...(query.department ? { department: query.department } : {}),
            ...(typeof query.isLate === "boolean" ? { isLate: query.isLate } : {}),
            ...(typeof query.isEarlyExit === "boolean" ? { isEarlyExit: query.isEarlyExit } : {}),
        });

        return {
            date: query.date,
            events: result.events,
            stats: result.stats,
            pagination: {
                limit: query.limit,
                offset: query.offset,
                total: result.total,
            },
        };
    }

    private async buildAttendanceRangeResponse(query: AttendanceRangeQueryDTO) {
        const result = await this.buildAttendanceEventPage({
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            limit: query.limit,
            offset: query.offset,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
            timezone: query.timezone,
            status: query.status,
            eventType: query.eventType,
            ...(query.employeeId ? { employeeId: query.employeeId } : {}),
            ...(query.department ? { department: query.department } : {}),
            ...(typeof query.isLate === "boolean" ? { isLate: query.isLate } : {}),
            ...(typeof query.isEarlyExit === "boolean" ? { isEarlyExit: query.isEarlyExit } : {}),
        });

        return {
            attendanceEvents: result.events,
            pagination: {
                limit: query.limit,
                offset: query.offset,
                total: result.total,
            },
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            dateRange: {
                from: query.dateFrom,
                to: query.dateTo,
            },
        };
    }

    private async buildAttendanceEventPage(query: {
        dateFrom: string;
        dateTo: string;
        employeeId?: string;
        department?: string;
        status: string[];
        eventType: string[];
        limit: number;
        offset: number;
        sortBy: "timestamp" | "employeeName" | "gate";
        sortOrder: "asc" | "desc";
        timezone: string;
        isLate?: boolean;
        isEarlyExit?: boolean;
    }) {
        const { dayStartMs, dayEndMs } = this.getDateRangeBounds(query.dateFrom, query.dateTo, query.timezone);

        let departmentEmployeeIds: string[] = [];
        if (query.department) {
            const departmentEmployees = await EmployeeModel.find({ department: query.department }, { _id: 1 }).lean();
            departmentEmployeeIds = departmentEmployees.map((employee: any) => employee._id.toString());

            if (query.employeeId) {
                const employee = await this.resolveEmployee(query.employeeId);
                if (!employee || !departmentEmployeeIds.includes(employee._id.toString())) {
                    return this.emptyAttendanceEventPage(query.limit, query.offset);
                }
            }
        }

        const attendanceMatch: Record<string, any> = {
            date: { $gte: query.dateFrom, $lte: query.dateTo },
        };

        const attendanceFilters: Record<string, any>[] = [];
        if (query.employeeId) {
            attendanceFilters.push(this.getEmployeeIdQuery(query.employeeId));
        }
        if (departmentEmployeeIds.length > 0) {
            attendanceFilters.push({ employeeId: { $in: departmentEmployeeIds.map((value) => new ObjectId(value)) } });
        }

        if (attendanceFilters.length > 0) {
            attendanceMatch.$and = attendanceFilters;
        }

        const sessions = await AttendanceModel.find(attendanceMatch).sort({ entryAt: 1 }).lean();

        const employeeIds = [...new Set(sessions.map((session: any) => String(session.employeeId)).filter(Boolean))];
        const employees = employeeIds.length > 0
            ? await EmployeeModel.find({ $or: [{ _id: { $in: employeeIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } }, { id: { $in: employeeIds } }] }).lean()
            : [];
        const employeeMap = new Map<string, any>();
        for (const employee of employees as any[]) {
            employeeMap.set(employee._id.toString(), employee);
            if (employee.id) {
                employeeMap.set(String(employee.id), employee);
            }
        }

        const includeUnknownEvents = !query.employeeId && departmentEmployeeIds.length === 0;
        const unknownEvents = includeUnknownEvents
            ? await UnknownEventModel.find({ eventTs: { $gte: dayStartMs, $lte: dayEndMs } }).sort({ eventTs: 1 }).lean()
            : [];

        const now = Date.now();
        const projectedEvents: Array<AttendanceEventDTO & { timestampMs: number }> = [];
        const uniqueEmployees = new Set<string>();
        let totalWorkDuration = 0;
        let lateEntries = 0;
        let earlyExits = 0;

        for (const session of sessions as any[]) {
            const employee = employeeMap.get(String(session.employeeId));
            const employeeId = employee?.id ?? employee?._id?.toString?.() ?? String(session.employeeId);
            uniqueEmployees.add(employeeId);

            const sharedEmployeeFields = {
                employeeId,
                employeeIdToView: employee?.id ?? employeeId,
                employeeName: employee?.name ?? "Unknown Person",
                employeeAvatar: employee?.faceImages?.[0] ?? null,
                department: employee?.department ?? null,
                designation: employee?.role ?? null,
                date: session.date,
            };

            const entryTimestampMs = Number(session.entryAt);
            const entryEvent: AttendanceEventDTO & { timestampMs: number } = {
                id: `${session._id?.toString?.() ?? employeeId}_${session.entryAt}_entry`,
                ...sharedEmployeeFields,
                timestamp: this.toIsoWithZone(entryTimestampMs, query.timezone),
                timestampMs: entryTimestampMs,
                type: "ENTRY",
                gate: session.entryCameraCode ?? "",
                status: "VERIFIED",
                confidence: Number(session.entryConfidence ?? 0),
                source: this.mapAttendanceSource(session.entrySource),
                isLate: this.isLateArrival(entryTimestampMs, query.timezone),
                isEarlyExit: false,
                lastCameraCode: session.entryCameraCode ?? null,
                lastChangedAt: entryTimestampMs,
                lastGate: "ENTRY",
                lastSeenAt: entryTimestampMs,
                state: "IN",
            };

            projectedEvents.push(entryEvent);
            totalWorkDuration += Number(session.durationMs ?? Math.max(0, now - entryTimestampMs));
            if (entryEvent.isLate) {
                lateEntries += 1;
            }

            if (session.exitAt) {
                const exitTimestampMs = Number(session.exitAt);
                const exitEvent: AttendanceEventDTO & { timestampMs: number } = {
                    id: `${session._id?.toString?.() ?? employeeId}_${session.exitAt}_exit`,
                    ...sharedEmployeeFields,
                    timestamp: this.toIsoWithZone(exitTimestampMs, query.timezone),
                    timestampMs: exitTimestampMs,
                    type: "EXIT",
                    gate: session.exitCameraCode ?? "",
                    status: "VERIFIED",
                    confidence: Number(session.exitConfidence ?? 0),
                    source: this.mapAttendanceSource(session.exitSource),
                    isLate: false,
                    isEarlyExit: this.isEarlyExit(exitTimestampMs, query.timezone),
                    lastCameraCode: session.exitCameraCode ?? null,
                    lastChangedAt: exitTimestampMs,
                    lastGate: "EXIT",
                    lastSeenAt: exitTimestampMs,
                    state: "OUT",
                };

                projectedEvents.push(exitEvent);
                if (exitEvent.isEarlyExit) {
                    earlyExits += 1;
                }
            }
        }

        for (const unknownEvent of unknownEvents as any[]) {
            const timestampMs = Number(unknownEvent.eventTs ?? unknownEvent.frameTs ?? unknownEvent.createdAt?.valueOf?.() ?? 0);
            const type = String(unknownEvent.gateRole ?? unknownEvent.eventType ?? "ENTRY").toUpperCase() === "EXIT" || String(unknownEvent.eventType).toLowerCase() === "exited"
                ? "EXIT"
                : "ENTRY";

            projectedEvents.push({
                id: unknownEvent._id?.toString?.() ?? `unknown_${timestampMs}`,
                employeeId: null,
                employeeIdToView: null,
                employeeName: "Unknown Person",
                employeeAvatar: null,
                department: null,
                designation: null,
                date: this.toAttendenceDate(timestampMs),
                timestamp: this.toIsoWithZone(timestampMs, query.timezone),
                timestampMs,
                type,
                gate: unknownEvent.cameraCode ?? "",
                status: "UNKNOWN",
                confidence: Number(unknownEvent.confidence ?? 0),
                source: "FACE_AI",
                isLate: false,
                isEarlyExit: false,
                lastCameraCode: unknownEvent.cameraCode ?? null,
                lastChangedAt: timestampMs,
                lastGate: type,
                lastSeenAt: timestampMs,
                state: type === "EXIT" ? "OUT" : "IN",
            });
        }

        const filteredEvents = projectedEvents.filter((event) => {
            if (query.employeeId && event.employeeId !== query.employeeId && event.employeeIdToView !== query.employeeId) {
                return false;
            }

            if (query.status.length > 0 && !query.status.includes(event.status)) {
                return false;
            }

            if (query.eventType.length > 0 && !query.eventType.includes(event.type)) {
                return false;
            }

            if (typeof query.isLate === "boolean" && Boolean(event.isLate) !== query.isLate) {
                return false;
            }

            if (typeof query.isEarlyExit === "boolean" && Boolean(event.isEarlyExit) !== query.isEarlyExit) {
                return false;
            }

            return true;
        });

        filteredEvents.sort((left, right) => {
            const direction = query.sortOrder === "asc" ? 1 : -1;
            let comparison = 0;

            if (query.sortBy === "employeeName") {
                comparison = left.employeeName.localeCompare(right.employeeName);
            } else if (query.sortBy === "gate") {
                comparison = left.gate.localeCompare(right.gate);
            } else {
                comparison = left.timestampMs - right.timestampMs;
            }

            if (comparison !== 0) {
                return comparison * direction;
            }

            return (left.timestampMs - right.timestampMs) * direction;
        });

        const total = filteredEvents.length;
        const events = filteredEvents.slice(query.offset, query.offset + query.limit).map(({ timestampMs, ...rest }) => rest);

        return {
            events,
            total,
            hasMore: query.offset + query.limit < total,
            nextCursor: query.offset + query.limit < total ? query.offset + query.limit : null,
            stats: {
                totalRecords: total,
                uniqueEmployees: uniqueEmployees.size,
                totalWorkDuration: Math.round(totalWorkDuration / 60000),
                unknownEvents: unknownEvents.length,
                lateEntries,
                earlyExits,
            },
        };
    }

    private emptyAttendanceEventPage(limit: number, offset: number) {
        return {
            events: [],
            total: 0,
            hasMore: false,
            nextCursor: null,
            stats: {
                totalRecords: 0,
                uniqueEmployees: 0,
                totalWorkDuration: 0,
                unknownEvents: 0,
                lateEntries: 0,
                earlyExits: 0,
            },
        };
    }

    async openSession(params: StartSessionInput) {
        const { employeeId, entryAt, entrySource, entryConfidence, entryCameraCode } = params;
        const date = this.toAttendenceDate(entryAt);

        try {
            await AttendanceModel.findOneAndUpdate(
                { employeeId, exitAt: { $exists: false }, date },
                {
                    $setOnInsert: {
                        employeeId,
                        entryAt,
                        lastSeenAt: entryAt,
                        entrySource,
                        date,
                        entryConfidence,
                        entryCameraCode,
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).lean();
        } catch (error: any) {
            // Ignore duplicate key errors that can happen under race conditions
            if (error && (error.code === 11000 || error.code === "E11000")) {
                return;
            }
            throw error;
        }
    }

    async updateSessionLastSeen(employeeId: string, date: string, seenAt: number) {
        try {
            console.log(`Updating last seen for employee ${employeeId} on ${date} to ${seenAt}`);
            const updated = await AttendanceModel.findOneAndUpdate(
                { employeeId, date, exitAt: { $exists: false } },
                { $max: { lastSeenAt: seenAt } }, // only update if seenAt is greater than existing lastSeenAt,
                { sort: { entryAt: -1 } } // 👈 ensures latest session
            );
            console.log(`Updated attendance session: ${updated ? updated._id.toString() : "none"}`);
        } catch (error) {
            // ignore
        }
    }

    async endSession(params: CloseSessionInput) {
        let { employeeId, exitAt, exitSource, exitCameraCode, exitConfidence } = params;
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
        openSession.exitConfidence = exitConfidence;
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

    private resolveEmployee(employeeId: string) {
        return EmployeeModel.findOne({
            $or: [
                { id: employeeId },
                ...(ObjectId.isValid(employeeId) ? [{ _id: new ObjectId(employeeId) }] : []),
            ],
        }).lean();
    }

    private getDateRangeBounds(dateFrom: string, dateTo: string, timezone: string) {
        const from = DateTime.fromISO(dateFrom, { zone: timezone }).startOf("day");
        const to = DateTime.fromISO(dateTo, { zone: timezone }).endOf("day");

        return {
            dayStartMs: from.toMillis(),
            dayEndMs: to.toMillis(),
        };
    }

    private mapAttendanceSource(source?: string): "FACE_AI" | "SYSTEM" | "MANUAL" {
        if (source === "manual" || source === "MANUAL_CORRECTION") return "MANUAL";
        if (source === "system" || source === "SYSTEM_RECOVERY" || source === "AUTO_EXIT" || source === "EXIT_DETECTED") return "SYSTEM";
        return "FACE_AI";
    }

    private isEarlyExit(exitAt: number, timezone: string) {
        const dt = DateTime.fromMillis(exitAt, { zone: timezone });
        const msFromMidnight = ((dt.hour * 60) + dt.minute) * 60 * 1000 + (dt.second * 1000) + dt.millisecond;
        return msFromMidnight < envConfig.officeEndTime;
    }

    private toAttendenceDate(ts: number, timezone = "Asia/Kolkata") {
        const date = luxon.DateTime.fromMillis(ts, { zone: timezone }).toFormat("yyyy-MM-dd");
        return date;
    }

    private buildTodayQueryFilter(filter: any) {
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

    private buildTodayPresencePipeline(filter: any) {
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

    private buildPastPipeline(filter: any) {
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

    private async generateEmployeeHistoryRows(employeeId: string, fromDate: string, toDate: string, timezone: string) {
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

        const fileName = `attendance_${employeeId}_${fromDate}_to_${toDate}.csv`;

        const headers = ["eventId", "timestamp", "type", "cameraId", "cameraCode", "cameraName", "confidence", "status", "source", "note"];

        return { rows, headers, fileName };
    }

    private buildEmployeeHistoryCsv(headers: string[], rows: Record<string, any>[]) {
        const lines = [headers.join(",")];

        rows.forEach((row) => {
            const values = headers.map((header) => this.csvEscape((row as any)[header] ?? ""));
            lines.push(values.join(","));
        });

        return lines.join("\n");
    }

    private async buildEmployeeHistoryXlsx(headers: string[], rows: Record<string, any>[]) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Attendance");

        sheet.columns = headers.map((header) => ({
            header,
            key: header,
            width: Math.max(14, header.length + 4),
        }));

        sheet.addRows(rows);
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    private csvEscape(value: string | number) {
        const text = String(value);
        if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    async exportAttendanceReport(query: any) {
        const date = query?.date ?? todayDate();
        const scope = query?.scope ?? "ALL_EMPLOYEES";
        const format = query?.format ?? "csv";
        const employeeIds = query?.employeeIds ?? [];
        const department = query?.department;
        const registeredOnly = typeof query?.registeredOnly === "boolean" ? query.registeredOnly : true;
        const timezone = query?.timezone ?? "UTC";

        let targetEmployeeIds: string[] = [];

        if (scope === "SELECTED_EMPLOYEES" && employeeIds.length > 0) {
            targetEmployeeIds = employeeIds;
        } else if (scope === "ALL_EMPLOYEES") {
            const filter: any = {};
            if (department) {
                filter.department = department;
            }
            const employees = await EmployeeModel.find(filter, { _id: 1, id: 1 }).lean();
            targetEmployeeIds = employees.map((e: any) => e.id ?? e._id?.toString?.()).filter(Boolean);
        }

        const attendanceMatch: Record<string, any> = { date };
        const matchOr: any[] = [];
        for (const empId of targetEmployeeIds) {
            if (ObjectId.isValid(empId)) {
                matchOr.push({ employeeId: new ObjectId(empId) });
            }
            matchOr.push({ employeeId: empId });
        }

        if (matchOr.length > 0) {
            attendanceMatch.$or = matchOr;
        }

        const sessions = await AttendanceModel.find(attendanceMatch).sort({ entryAt: 1 }).lean();

        const employeeKeys = [...new Set(sessions.map((s: any) => String(s.employeeId)))];
        const employees = employeeKeys.length > 0
            ? await EmployeeModel.find({ $or: [{ id: { $in: employeeKeys } }, { _id: { $in: employeeKeys.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } }] }).lean()
            : [];

        const empMap = new Map<string, any>();
        for (const emp of employees) {
            empMap.set(emp.id ?? emp._id?.toString?.(), emp);
        }

        const grouped = new Map<string, any[]>();
        for (const session of sessions as any[]) {
            const key = String(session.employeeId);
            const list = grouped.get(key) ?? [];
            list.push(session);
            grouped.set(key, list);
        }

        const rows = Array.from(grouped.entries()).map(([empKey, empSessions]) => {
            const emp = empMap.get(empKey);
            const ordered = [...empSessions].sort((l, r) => Number(l.entryAt) - Number(r.entryAt));
            const firstEntry = ordered[0]?.entryAt;
            const lastSeen = ordered.reduce((max: number | null, s: any) => {
                const ts = Number(s.exitAt ?? s.entryAt ?? 0);
                return max === null || ts > max ? ts : max;
            }, null);
            const totalDuration = ordered.reduce((sum: number, s: any) => sum + Number(s.durationMs ?? 0), 0);
            const isPresent = ordered.length > 0 ? "Yes" : "No";
            const isLate = firstEntry && firstEntry > envConfig.officeStartTime ? "Yes" : "No";
            const isEarlyExit = ordered.some((s: any) => s.exitAt && s.exitAt < envConfig.officeEndTime) ? "Yes" : "No";

            return {
                employeeId: emp?.id ?? empKey,
                employeeCode: emp?.id ?? empKey,
                employeeName: emp?.name ?? "Unknown",
                department: emp?.department ?? "",
                role: emp?.role ?? "",
                date,
                firstEntryAt: firstEntry ? this.toIsoWithZone(Number(firstEntry), timezone) : "",
                lastSeenAt: lastSeen ? this.toIsoWithZone(lastSeen, timezone) : "",
                totalWorkDurationMinutes: Math.round(totalDuration / 60000),
                breakDurationMinutes: 0,
                currentStatus: ordered.some((s: any) => !s.exitAt) ? "ONGOING" : (ordered.length > 0 ? "COMPLETED" : "ABSENT"),
                flags: "",
                present: isPresent,
                lateArrival: isLate,
                earlyExit: isEarlyExit,
            };
        });

        const headers = [
            "employeeId",
            "employeeCode",
            "employeeName",
            "department",
            "role",
            "date",
            "firstEntryAt",
            "lastSeenAt",
            "totalWorkDurationMinutes",
            "breakDurationMinutes",
            "currentStatus",
            "flags",
            "present",
            "lateArrival",
            "earlyExit",
        ];

        const isXlsx = format === "xlsx";
        const mimeType = isXlsx
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv";

        const scopeLabel = scope === "ALL_EMPLOYEES" ? "all-employees" : `employees-${employeeIds.length}`;
        const fileName = `attendance-report-${scopeLabel}-${date}.${isXlsx ? "xlsx" : "csv"}`;

        const content = isXlsx
            ? await this.buildAttendanceReportXlsx(headers, rows)
            : this.buildAttendanceReportCsv(headers, rows);

        return {
            type: "file" as const,
            fileName,
            mimeType,
            content,
        };
    }

    private buildAttendanceReportCsv(headers: string[], rows: Record<string, any>[]) {
        const lines = [headers.join(",")];

        rows.forEach((row) => {
            const values = headers.map((header) => this.csvEscape((row as any)[header] ?? ""));
            lines.push(values.join(","));
        });

        return lines.join("\n");
    }

    private async buildAttendanceReportXlsx(headers: string[], rows: Record<string, any>[]) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Attendance Report");

        sheet.columns = headers.map((header) => ({
            header,
            key: header,
            width: Math.max(14, header.length + 4),
        }));

        sheet.addRows(rows);
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }




}


