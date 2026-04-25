import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";
import { ApiError, todayDate } from "../../utils";
import { envConfig } from "../../config";
import AttendanceModel from "../attendance/attendance.model";
import { PresenceLogModel } from "../presence/logs/presence-log.model";
import UnknownModel from "../unknown/unknown.model";
import EmployeeModel from "../employees/infrastructure/employee.model";
import CameraModel from "../cameras/infrastructure/camera.model";
import { GATE_TYPE } from "../cameras/domain/camera.constant";
import DashboadRepositor from "./dashboard.repository";
import { DashboardAttendanceSummaryQueryDTO, DashboardAttendanceSummaryResponse } from "./dashboard.types";
import { UnknownEventModel } from "../unknown/unknown-event.model";

export default class DashboardService {
    constructor(private readonly dashboardRepo: DashboadRepositor) {}

    async getAttendanceSummary(query: DashboardAttendanceSummaryQueryDTO): Promise<DashboardAttendanceSummaryResponse> {
        const range = this.resolveRange(query);
        const employeeObjectIds = await this.resolveEmployeeIds(query.employeeIds, query.department);
        const cameraCodes = await this.resolveCameraCodes(query.cameraIds, query.gateType);

        if (employeeObjectIds === null || cameraCodes === null) {
            return {
                range: {
                    from: range.fromIso,
                    to: range.toIso,
                    timezone: range.timezone,
                },
                stats: {
                    totalRecords: 0,
                    uniqueEmployees: 0,
                    totalWorkDurationMinutes: 0,
                    unknownEvents: 0,
                    lateEntries: 0,
                    earlyExits: 0,
                },
            };
        }

        const attendanceMatch: Record<string, any> = {
            date: { $gte: range.fromDate, $lte: range.toDate },
        };

        if (employeeObjectIds.length > 0) {
            attendanceMatch.employeeId = { $in: employeeObjectIds };
        }

        if (cameraCodes.length > 0) {
            attendanceMatch.$or = [
                { entryCameraCode: { $in: cameraCodes } },
                { exitCameraCode: { $in: cameraCodes } },
            ];
        }

        const sessions = await AttendanceModel.find(attendanceMatch).lean();

        const knownEventMatch: Record<string, any> = {
            occurredAt: { $gte: range.fromMs, $lte: range.toMs },
        };

        if (cameraCodes.length > 0) {
            knownEventMatch.cameraCode = { $in: cameraCodes };
        }

        const knownEventEmployeeIds = employeeObjectIds.map((value) => value.toString());
        if (knownEventEmployeeIds.length > 0) {
            knownEventMatch.employeeId = { $in: knownEventEmployeeIds };
        }

        const knownRecordsCount = await PresenceLogModel.countDocuments(knownEventMatch);

        const unknownMatch: Record<string, any> = {
            eventTs: { $gte: range.fromMs, $lte: range.toMs },
        };

        if (cameraCodes.length > 0) {
            unknownMatch.cameraCode = { $in: cameraCodes };
        }
        const unknownEvents = await UnknownEventModel.countDocuments(unknownMatch);
        const totalRecords = knownRecordsCount + unknownEvents;

        const uniqueEmployees = new Set<string>();
        let totalWorkDurationMinutes = 0;
        let lateEntries = 0;
        let earlyExits = 0;

        for (const session of sessions as any[]) {
            const employeeId = session.employeeId?.toString?.() ?? String(session.employeeId);
            uniqueEmployees.add(employeeId);

            const durationMs = typeof session.durationMs === "number"
                ? session.durationMs
                : session.exitAt
                    ? Number(session.exitAt) - Number(session.entryAt)
                    : Math.max(0, range.nowMs - Number(session.entryAt));

            totalWorkDurationMinutes += Math.round(durationMs / 60000);

            if (this.isLateEntry(Number(session.entryAt), range.timezone)) {
                lateEntries += 1;
            }

            if (session.exitAt && this.isEarlyExit(Number(session.exitAt), range.timezone)) {
                earlyExits += 1;
            }
        }

        return {
            range: {
                from: range.fromIso,
                to: range.toIso,
                timezone: range.timezone,
            },
            stats: {
                totalRecords,
                uniqueEmployees: uniqueEmployees.size,
                totalWorkDurationMinutes,
                unknownEvents,
                lateEntries,
                earlyExits,
            },
        };
    }

    private resolveRange(query: DashboardAttendanceSummaryQueryDTO) {
        const timezone = query.timezone ?? "Asia/Kolkata";

        const baseDate = query.date ?? query.from ?? todayDate();
        const fromDate = query.date ?? query.from ?? baseDate;
        const toDate = query.date ?? query.to ?? baseDate;

        const from = DateTime.fromISO(fromDate, { zone: timezone }).startOf("day");
        const to = DateTime.fromISO(toDate, { zone: timezone }).endOf("day");

        return {
            timezone,
            fromDate: from.toFormat("yyyy-MM-dd"),
            toDate: to.toFormat("yyyy-MM-dd"),
            fromMs: from.toMillis(),
            toMs: to.toMillis(),
            fromIso: from.toISO({ suppressMilliseconds: true }) ?? "",
            toIso: to.toISO({ suppressMilliseconds: true }) ?? "",
            nowMs: Date.now(),
        };
    }

    private async resolveEmployeeIds(employeeIds: string[] = [], department?: string): Promise<ObjectId[] | null> {
        const filter: Record<string, any> = {};

        const employeeObjectIds = employeeIds
            .filter((id) => ObjectId.isValid(id))
            .map((id) => new ObjectId(id));

        if (employeeIds.length > 0 && employeeObjectIds.length === 0) {
            return null;
        }

        if (employeeObjectIds.length > 0) {
            filter._id = { $in: employeeObjectIds };
        }

        if (department) {
            filter.department = department;
        }

        if (Object.keys(filter).length === 0) {
            return [] as ObjectId[];
        }

        const employees = await EmployeeModel.find(filter, { _id: 1 }).lean();
        return employees.map((employee: any) => new ObjectId(employee._id));
    }

    private async resolveCameraCodes(cameraIds: string[] = [], gateType?: string[]): Promise<string[] | null> {
        const filter: Record<string, any> = {};

        if (cameraIds.length > 0) {
            const objectIds = cameraIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
            const stringCodes = cameraIds.filter((id) => !ObjectId.isValid(id));

            if (objectIds.length === 0 && stringCodes.length === 0) {
                return null;
            }

            filter.$or = [] as any[];
            if (objectIds.length > 0) {
                filter.$or.push({ _id: { $in: objectIds } });
            }
            if (stringCodes.length > 0) {
                filter.$or.push({ code: { $in: stringCodes } });
            }
        }

        if (gateType && gateType.length > 0) {
            filter.gateType = { $in: gateType };
        }

        if (Object.keys(filter).length === 0) {
            return [] as string[];
        }

        const cameras = await CameraModel.find(filter, { code: 1 }).lean();
        return cameras.map((camera: any) => camera.code).filter(Boolean);
    }

    private isLateEntry(entryAt: number, timezone: string) {
        const dt = DateTime.fromMillis(entryAt, { zone: timezone });
        const entryMs = ((dt.hour * 60) + dt.minute) * 60 * 1000 + (dt.second * 1000) + dt.millisecond;
        return entryMs > envConfig.officeStartTime;
    }

    private isEarlyExit(exitAt: number, timezone: string) {
        const dt = DateTime.fromMillis(exitAt, { zone: timezone });
        const exitMs = ((dt.hour * 60) + dt.minute) * 60 * 1000 + (dt.second * 1000) + dt.millisecond;
        return exitMs < envConfig.officeEndTime;
    }
}