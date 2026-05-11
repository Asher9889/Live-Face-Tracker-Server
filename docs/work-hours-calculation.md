# Work Hours Calculation Logic - Attendance Reports

## Problem
Currently, `workHours` appears as `null` in many rows. This is because:
1. **Closed sessions only**: Only sessions with `exitAt` set get a `durationMs` value
2. **Open sessions**: Employees with open sessions (no `exitAt`) show 0 hours even if they've been present for hours
3. **Aggregation issue**: The aggregation sums `durationMs`, but incomplete sessions don't contribute

## Solution: Robust Work Hours Calculation

### Step 1: Identify Session Types
For each employee and date, sessions fall into these categories:
- **Closed session**: has `entryAt` + `exitAt` + `durationMs` ✓ use as-is
- **Open session**: has `entryAt` but no `exitAt` → compute duration from entryAt to now (or end-of-day)
- **Sessions without duration**: `durationMs = 0` → likely corrupted, treat as 0

### Step 2: Calculate Total Work Duration
```
For each session:
  if (exitAt exists) {
    // Session is closed, use pre-computed durationMs
    sessionDuration = durationMs
  } else {
    // Session is open/incomplete
    // Option A: Count to end of business day
    sessionDuration = min(lastSeenAt, businessDayEnd) - entryAt
    // Option B: Count to now
    sessionDuration = now - entryAt
  }

total = sum of all sessionDurations (only positive values)
```

### Step 3: Optional - Subtract Break Times
Breaks = gaps between consecutive sessions:
```
if (sessions are sorted by entryAt):
  for i from 0 to sessions.length-2:
    if (sessions[i].exitAt < sessions[i+1].entryAt):
      breakDuration = sessions[i+1].entryAt - sessions[i].exitAt
      // Track break or subtract from total
```

### Step 4: Format as "Xh Ym"
```
minutes = round(totalMs / 60000)
hours = floor(minutes / 60)
remainingMinutes = minutes % 60
formatted = `${hours}h ${remainingMinutes}m`
```

## Implementation Pattern
```ts
// PSEUDO-CODE (human-readable)
function calculateWorkHours(sessions: Session[], options?: { includeOpenSessions?: boolean }): string {
  // Step 1: Sum all session durations
  let totalDurationMs = 0;
  
  for (const session of sessions) {
    // If session is closed, use pre-computed duration
    if (session.exitAt && session.durationMs) {
      totalDurationMs += session.durationMs;
    }
    // If session is open and we want to include it
    else if (!session.exitAt && options?.includeOpenSessions) {
      const durationSinceEntry = now - session.entryAt;
      totalDurationMs += Math.max(0, durationSinceEntry);
    }
  }
  
  // Step 2: Convert to hours/minutes
  const totalMinutes = Math.round(totalDurationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  // Step 3: Format
  return totalMinutes > 0 ? `${hours}h ${minutes}m` : null;
}
```

## Data Model View
```
Employee A on 2026-05-09:
┌─ Session 1 ─┐  (break)  ┌─ Session 2 ─┐
  09:00→10:00              10:30→17:00
  1 hour              +     6.5 hours
  ─────────────────────────────────────
  Total work: 7.5 hours

Employee B on 2026-05-09 (open session):
┌─ Session 1 ─┐  (break)  ┌─ Session 2 (OPEN) ──→ 
  09:00→12:00              13:00→ (still here at 18:00)
  3 hours              +     5 hours (13:00→18:00)
  ────────────────────────────────────────
  Total work: 8 hours (or null if we exclude open sessions)
```

## Why workHours Shows Null
Based on observed response data, likely causes:
1. **All sessions are open** (no exitAt): `durationMs` is never set, so sum = 0
2. **durationMs values are all 0**: Sessions exist but never properly closed
3. **Query returns only records where exitAt is null**: Missing data
4. **Break times > work times**: Filtering logic removes all entries

## Recommended Fix
1. In `getReportsRows` aggregation, fetch ALL session details (not just first/last)
2. Apply robust per-session duration calculation in application layer
3. Handle both closed and open sessions appropriately
4. Provide debug option to log session details when workHours is 0/null

---

**File location**: [docs/work-hours-calculation.md](docs/work-hours-calculation.md)

To apply this logic to the backend, the service method should:
- Fetch full session array instead of just firstEntry/lastExit
- Calculate each session's duration individually  
- Sum only valid, positive durations
- Handle missing/incomplete sessions gracefully
