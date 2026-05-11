# Attendance Reports API - Frontend Contract

Status: implemented in backend (validators, routes, controller handlers, service logic).

This document provides endpoint details, required query/body params, response envelopes, and precise TypeScript-style types to help frontend implement the Reports page.

Base URL (API v1): `/api/v1/attendance`

Response envelope (all endpoints)
```ts
type ApiResponse<T> = {
  status: "success" | "error";
  statusCode: number;
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
}
```

---

**GET /attendance/reports/summary**
- Query parameters
  - `mode`: "daily" | "monthly" | "custom" (required)
  - if `mode=daily`: `date` (string, YYYY-MM-DD) required
  - if `mode=monthly`: `month` (string, YYYY-MM) required
  - if `mode=custom`: `startDate` (YYYY-MM-DD) and `endDate` (YYYY-MM-DD) required
  - `employeeId?: string` (empty or missing => no filter)
  - `department?: string` ("all" or empty => no filter)
  - `status?: string` (allowed values handled by frontend: Present|Absent|Late|Half Day)
  - `lateOnly?: boolean` (default false)
  - `missingExitOnly?: boolean` (default false)
  - `timezone?: string` (IANA, default "Asia/Kolkata")

- Successful response data shape
```ts
type ReportsSummaryData = {
  present: number;        // count
  absent: number;         // count
  late: number;           // count
  avgHours: string;       // formatted "8h 12m"
  missingExit: number;    // count
  overtime: number;       // count (may be 0)
  totalEmployees: number; // count
}
```

Example:
```json
{
  "status": "success",
  "statusCode": 200,
  "data": { "present": 120, "absent": 5, "late": 9, "avgHours": "8h 12m", "missingExit": 2, "overtime": 14, "totalEmployees": 125 }
}
```

---

**GET /attendance/reports/rows**
- Query parameters
  - Same filter params as `/summary`
  - `page?: number` (default 1)
  - `pageSize?: number` (default 25, max 200)
  - `sortBy?: string` (frontend supplied value)
  - `sortOrder?: "asc" | "desc"` (default "asc")

- Response `data` shape (daily/custom row shape shown; monthly differs slightly)
```ts
type ReportRowDaily = {
  id: string;            // stable unique id, e.g. "daily_2026-05-11_emp_123"
  employeeId: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  entryTime?: string | null; // ISO or formatted (frontend expects string)
  exitTime?: string | null;  // ISO or formatted
  lastSeenAt?: string | null; // ISO timestamp of last detection
  workHours?: string | null; // formatted e.g. "8h 12m"
  status: "Present" | "Absent" | "Late" | "Half Day";
  currentStatus: "In" | "Out"; // "in" = open session (employee currently present), "out" = all sessions closed
  lateStatus: boolean;
  missingExit: boolean;
}

type ReportRowMonthly = {
  id: string;
  employeeId: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  avgWorkHours: string;   // e.g. "7h 45m"
  overtimeDays: number;
  missingExits: number;
}

type ReportsRowsData<T = ReportRowDaily | ReportRowMonthly> = {
  mode: "daily" | "monthly" | "custom";
  rows: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }
}
```

Example (daily):
```json
{ "status": "success", "statusCode": 200, "data": { "mode": "daily", "rows": [ { "id": "daily_2026-05-11_emp_123", "employeeId": "emp_123", "name": "Alice Smith", "avatar": null, "department": "Engineering", "entryTime": "2026-05-11T09:12:00+05:30", "exitTime": "2026-05-11T18:05:00+05:30", "lastSeenAt": "2026-05-11T18:05:00+05:30", "workHours": "8h 53m", "status": "Present", "currentStatus": "out", "lateStatus": false, "missingExit": false } ], "pagination": { "page": 1, "pageSize": 25, "total": 125, "totalPages": 5 } } }
```

Notes:
- For monthly mode the `rows` items should conform to `ReportRowMonthly`.
- `entryTime`/`exitTime` are ISO timestamps produced by backend; frontend may format further to user locale/timezone.

---

**GET /attendance/reports/employees/:employeeId/timeline**
- Path param: `employeeId` (required)
- Query params: `date?: YYYY-MM-DD`, `month?: YYYY-MM`, `timezone?: string` (default Asia/Kolkata)

- Response `data` shape
```ts
type EmployeeTimelineEvent = {
  id: string;
  type: "ENTRY_DETECTED" | "EXIT_PENDING" | "EXIT_CANCELLED" | "EXIT_CONFIRMED" | "SYSTEM_RECOVERY";
  timestamp: string; // ISO
  cameraSource?: string | null;
  confidence?: number | null; // percentage or score
  statusBadge: "success" | "warning" | "error" | "info" | "default";
}

type EmployeeTimelineData = {
  employee: {
    id: string; // db object id or internal id
    employeeId: string; // stable employee code
    name: string;
    avatar?: string | null;
    department?: string | null;
    role?: string | null;
  };
  monthlyStats: {
    present: number;
    absent: number;
    late: number;
  };
  events: EmployeeTimelineEvent[];
}
```

Example:
```json
{ "status": "success", "statusCode": 200, "data": { "employee": { "id": "60a..", "employeeId": "EMP_123", "name": "Alice Smith", "avatar": null, "department": "Engineering", "role": "Senior Dev" }, "monthlyStats": { "present": 21, "absent": 1, "late": 2 }, "events": [ { "id": "evt_1", "type": "ENTRY_DETECTED", "timestamp": "2026-05-11T08:45:00+05:30", "cameraSource": "Main Entrance Cam", "confidence": 98.5, "statusBadge": "success" } ] } }
```

---

**POST /attendance/reports/export**
- Body follows `reportsExportBodySchema` (see server validation). Key fields:
  - `mode`, `date`/`month`/`startDate`/`endDate` as per mode rules
  - `scope`: "ALL_ROWS" | "SELECTED_ROWS" | "SELECTED_EMPLOYEES"
  - `rowIds?: string[]`
  - `employeeIds?: string[]`
  - `filters?: { employeeId?, employeeName?, department?, status?, lateOnly?, missingExitOnly? }`
  - `format?: "csv" | "xlsx"` (default csv)
  - `timezone?: string`
  - `registeredOnly?: boolean` (default true)

- Response
  - If export is generated synchronously: binary CSV/XLSX with appropriate `Content-Type` and `Content-Disposition` headers
  - If queued: `200/202` with job object in envelope `data`:
```ts
type ExportJobResponse = { jobId: string; status: "QUEUED" | "COMPLETED"; }
```

Example queued response:
```json
{ "status": "success", "statusCode": 202, "data": { "jobId": "exp_abc123", "status": "QUEUED" } }
```

---

Error handling
- Validation errors: `status: "error"`, `statusCode: 400` or `422`, `errors` array contains `field` and `message`.
- Not found: `404` with message.

---

Implementation notes for frontend
- Treat `employeeId` empty string as unset (do not pass empty values if not filtering).
- Use timezone in query to get deterministic timestamps from backend.
- Backend returns ISO timestamps for times; UI should localize/format when rendering.
- Use `page`/`pageSize` for pagination and render counts from `pagination.total`.

File: [docs/attendance-reports-api-full.md](docs/attendance-reports-api-full.md)
