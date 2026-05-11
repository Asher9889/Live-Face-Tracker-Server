# Attendance Reports API

This document describes the reporting APIs implemented for the Reports page.

Base route: `/attendance/reports` (registered under API version: `/v1/attendance/reports`)

## Endpoints

### GET /attendance/reports/summary
- Query params:
  - `mode` (required): `daily` | `monthly` | `custom`
  - `date` (required if mode=daily): `YYYY-MM-DD`
  - `month` (required if mode=monthly): `YYYY-MM`
  - `startDate`, `endDate` (required if mode=custom): `YYYY-MM-DD`
  - `employeeId` (optional)
  - `department` (optional)
  - `status` (optional)
  - `lateOnly` (optional): boolean
  - `missingExitOnly` (optional): boolean
  - `timezone` (optional, default `Asia/Kolkata`)

Response data shape (in `data`):
```
{ present, absent, late, avgHours, missingExit, overtime, totalEmployees }
```

### GET /attendance/reports/rows
- Query params:
  - same filters as `/summary`
  - `page` (default 1)
  - `pageSize` (default 25, max 200)
  - `sortBy`, `sortOrder`

Response `data` shape:
```
{ mode, rows: [ { id, employeeId, name, avatar, department, entryTime, exitTime, workHours, status, lateStatus, missingExit } ], pagination: { page, pageSize, total, totalPages } }
```

### GET /attendance/reports/employees/:employeeId/timeline
- Query params: `date` (optional), `month` (optional), `timezone` (optional)

Response `data` shape:
```
{ employee: { id, employeeId, name, avatar, department, role }, monthlyStats: { present, absent, late }, events: [ { id, type, timestamp, cameraSource, confidence, statusBadge } ] }
```

### POST /attendance/reports/export
- Body: follows `reportsExportBodySchema` (mode, date/month/start-end, scope, rowIds/employeeIds, filters, format, timezone, registeredOnly)
- Response: binary file (CSV/XLSX) or queued job object

## Notes and behavior
- Empty string values for `employeeId` or `department` are treated as no filter.
- `department=all` is treated as no filter.
- Timezone defaults to `Asia/Kolkata` when missing.
- The APIs return the project's standard envelope: `{ status: 'success', statusCode: 200, data: ... }`.

## Example curl
Summary (daily):
```
curl -G 'http://localhost:3000/v1/attendance/reports/summary' \
  --data-urlencode 'mode=daily' \
  --data-urlencode 'date=2026-05-11' \
  --data-urlencode 'timezone=Asia/Kolkata'
```

Rows (monthly):
```
curl -G 'http://localhost:3000/v1/attendance/reports/rows' \
  --data-urlencode 'mode=monthly' \
  --data-urlencode 'month=2026-05' \
  --data-urlencode 'page=1' \
  --data-urlencode 'pageSize=25' \
  --data-urlencode 'timezone=Asia/Kolkata'
```

Employee timeline:
```
curl -G 'http://localhost:3000/v1/attendance/reports/employees/EMP_123/timeline' \
  --data-urlencode 'date=2026-05-11' \
  --data-urlencode 'timezone=Asia/Kolkata'
```
