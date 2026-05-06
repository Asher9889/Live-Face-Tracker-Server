# Data Model Overview

This project uses three collections. Each has a clear and separate responsibility.

---

## attendance

**Purpose:**
Stores final attendance sessions. This is the **source of truth**.

**Used for:**

* Attendance reports
* Late/early calculation
* Salary processing

**Key points:**

* One record per employee per day
* Stores `entryAt` and `exitAt`
* May contain `isExitMissing` if exit was not detected
* Always used for business decisions

---

## employee_presence

**Purpose:**
Stores the current (real-time) state of an employee.

**Used for:**

* Showing who is currently inside/outside
* Fast UI updates

**Key points:**

* Represents latest known state (`IN` / `OUT`)
* Can become stale if events are missed
* Reset daily (via cron or logic)
* Not reliable for historical or business logic

---

## employee_presence_logs

**Purpose:**
Stores all event-level logs for debugging and auditing.

**Used for:**

* Debugging issues
* Understanding event flow
* Audit trail

**Key points:**

* Append-only (no updates)
* Contains events like `ENTRY_DETECTED`, `EXIT_DETECTED`
* Not used for attendance calculation

---

## Summary

* `attendance` → source of truth
* `employee_presence` → current state (cache)
* `employee_presence_logs` → event history

Always use **attendance** for any business logic.
