# How attendence works?

- Attendance collection (THIS is the key)
	- Attendance model = one work session
	- One document = one IN → OUT session.
	- Attendance records are APPEND-ONLY

- Attendence Model
```javascript
{
  employeeId: ObjectId | string

  entryAt: number        // timestamp (ms)
  exitAt: number         // timestamp (ms)

  durationMs: number     // exitAt - entryAt

  entrySource: "ENTRY_CAMERA"
  exitSource: "EXIT_CAMERA" | "AUTO_EXIT" | "SYSTEM_RECOVERY"

  date: "2026-01-09"      // YYYY-MM-DD (Most imp) // Strings are compared lexicographically (left → right).
  createdAt
}
```
## Why date is YYYY-MM-DD?
- Imagine these dates:
	- 02-01-2026  (2 Jan 2026)
	- 15-12-2025  (15 Dec 2025)
	- Lexicographically:
		- "15-12-2025" > "02-01-2026"
		- But in reality:
		- 15 Dec 2025 < 2 Jan 2026
