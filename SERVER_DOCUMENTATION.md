**Project Overview**
- **Purpose:** Backend for Live Face Tracker — ingest camera streams, run face/embedding pipelines (via external AI/embedding service), store results, provide attendance/presence APIs and object storage (MinIO).
- **Main entry:** [src/server.ts](src/server.ts#L1-L120)

**Repository Layout (high-level)**
- **src/**: application source
  - **server.ts** — app bootstrap and middleware registration ([src/server.ts](src/server.ts#L1-L120))
  - **routes/** — top-level API routers ([src/routes/v1/index.ts](src/routes/v1/index.ts#L1-L60))
  - **module/** — domain modules (attendance, presence, employees, unknown, shared etc.)
  - **stream/** — stream management, websocket server, Redis subscription for camera events ([src/stream/initCameraBBoxSubscriber.ts](src/stream/initCameraBBoxSubscriber.ts#L1-L240))
  - **shared/** — MinIO client/service and embedding base code ([src/module/shared/minio/minio.service.ts](src/module/shared/minio/minio.service.ts#L1-L120), [src/module/shared/embedding/embedding.base.ts](src/module/shared/embedding/embedding.base.ts#L1-L140))
  - **middlewares/** — request validation and auth ([src/middlewares/validate.middleware.ts](src/middlewares/validate.middleware.ts#L1-L80))

**How Node talks to AI / Embedding services**
- Embedding generation requests are proxied to the configured embedding API (`envConfig.embeddingApiUrl`). See embedding request wrapper: [src/module/shared/embedding/embedding.base.ts](src/module/shared/embedding/embedding.base.ts#L1-L120).
  - Files are sent as multipart form-data with `file.buffer` as binary body via `form-data` and `axios.post(form, { headers: form.getHeaders() })`.
  - Caller examples:
    - Employee creation → [src/module/employees/application/employee.service.ts](src/module/employees/application/employee.service.ts#L1-L80) uses `EmployeeEmbeddingService` which extends `EmbeddingBase`.
    - Unknown identities → [src/module/unknown/unknown.service.ts](src/module/unknown/unknown.service.ts#L1-L120) uses `UnknownEmbeddingService`.
- Merge / external AI endpoints:
  - Unknown merge calls an external merge endpoint via `axios.post('http://localhost:4001/merge', ...)` in [src/module/unknown/unknown.controller.ts](src/module/unknown/unknown.controller.ts#L116-L126).
  - Employee promotion / matching call configurable endpoints from `envConfig` (see [src/module/employees/application/employee.service.ts](src/module/employees/application/employee.service.ts#L100-L160)).

**MinIO / Object storage**
- MinIO is used via the AWS S3 compatible SDK. Upload code uses raw Buffer as Body (no string conversion): [src/module/shared/minio/minio.service.ts](src/module/shared/minio/minio.service.ts#L1-L80).
  - Key generation: `generateKey(prefix, originalName)` and `upload(bucket, key, file)`.
  - Client config: [src/module/shared/minio/minio.client.ts](src/module/shared/minio/minio.client.ts#L1-L60) uses `endpoint`, `accessKey`, `secretKey` from env.

**Multipart handling & file flow**
- Multer is used in memory mode (buffers) so request files are available as `req.file` or `req.files` (buffers): [src/module/employees/middlewares/multer.ts](src/module/employees/middlewares/multer.ts#L1-L200).
- Important rules used in codebase:
  - Upload routes call multer middleware before validation: e.g. [src/module/unknown/unknown.routes.ts](src/module/unknown/unknown.routes.ts#L8-L18) uses `uploadUnknownFaces.any()` or `uploadFace` before `validate(...)`.
  - Uploaded buffers are passed directly to embedding APIs (see `EmbeddingBase`) and to MinIO upload (see `MinioService.upload`).
  - Avoid any `.toString()` or `JSON.stringify()` on file buffers — codebase follows that: check `EmbeddingBase` which appends `file.buffer` into FormData.

**Event & Stream architecture (how camera → DB works)**
- Cameras / AI processors publish per-frame/person events to Redis channels named `live-face-tracker:camera-events:<camera_code>`.
- The server subscribes to these patterns in [src/stream/initCameraBBoxSubscriber.ts](src/stream/initCameraBBoxSubscriber.ts#L1-L240).
  - Incoming messages contain event types such as `person_entered`, `person_exited`, `track_update`, with payload fields: camera_code, person_id, similarity, bbox, timestamps.
  - Subscriber normalizes bbox and broadcasts to WS via [src/stream/WSStreamServer.ts](src/stream/WSStreamServer.ts#L1-L120) for UI clients.
  - Crucially the subscriber translates `person_entered` / `person_exited` into presence updates by calling `presenceService.onPersonEntered(...)` and `presenceService.onPersonExit(...)`.

**Presence service (runtime in-memory + DB) — deep attendance flow**
- Module entry points: [src/module/presence/presence.module.ts](src/module/presence/presence.module.ts#L1-L40) exports `presenceService` used by the stream subscriber and by server bootstrap for recovery.
- Runtime map: `PresenceService` maintains a Map<employeeId, RuntimePresence> to avoid frequent DB writes and to manage exit timers. See implementation: [src/module/presence/presence.service.ts](src/module/presence/presence.service.ts#L1-L300).

Detailed step-by-step flow when a person is detected (ENTRY) by camera AI:
1. External AI or tracker publishes a Redis message: `live-face-tracker:camera-events:<cameraCode>` with `event: 'person_entered'` and `person_id` (employee id), `eventTs`, `similarity`.
   - Publisher side is external (camera/AI process). Server code expects this pattern in [src/stream/initCameraBBoxSubscriber.ts](src/stream/initCameraBBoxSubscriber.ts#L1-L120).
2. `initCameraBBoxSubscriber` receives message and calls `presenceService.onPersonEntered({ employeeId, cameraCode, gateRole: 'ENTRY', eventTs, confidence })`.
   - See the call site: [src/stream/initCameraBBoxSubscriber.ts](src/stream/initCameraBBoxSubscriber.ts#L1-L240#L1-L120).
3. In `PresenceService.onPersonEntered`:
   - Look up presence in the in-memory `presenceMap`.
   - If missing, create a runtime presence with `state: 'OUT'` and set lastSeenAt/eventTs, lastGate, entryCameraCode.
   - Update heartbeat fields and cancel any existing pending exit timer.
   - If previous state was `OUT` and gateRole is `ENTRY`, call `markIN` (start session); otherwise call `updateMarkIN`.
   - Implementation: [src/module/presence/presence.service.ts](src/module/presence/presence.service.ts#L1-L220).
4. `markIN` (start attendance session):
   - Update DB `PresenceModel` with `state: IN`, set `lastSeenAt`, `lastChangedAt`, `date` and `lastGate: ENTRY`.
   - Insert log via `PresenceLogService.insertLog(...)` for `ENTRY_DETECTED` (persistence for audit).
   - Create an attendance session row via `attendanceService.openSession({ employeeId, entryAt, entrySource: 'ENTRY_CAMERA', entryCameraCode, entryConfidence })`.
   - Implementation references:
     - PresenceModel schema: [src/module/presence/presence.model.ts](src/module/presence/presence.model.ts#L1-L120)
     - markIN code: [src/module/presence/presence.service.ts](src/module/presence/presence.service.ts#L120-L200)
     - attendance openSession: [src/module/attendance/attendance.service.ts](src/module/attendance/attendance.service.ts#L1-L120)
5. `attendanceService.openSession` creates an `AttendanceModel` entry with entryAt and other metadata; this model later is updated when `endSession` is called.
   - See [src/module/attendance/attendance.service.ts](src/module/attendance/attendance.service.ts#L1-L160)

When a person exits (EXIT) detected by camera AI:
1. Redis publisher emits `person_exited` with `person_id` and `eventTs`.
2. Subscriber calls `presenceService.onPersonExit(...)` which updates runtime presence and schedules a delayed exit.
   - A delay (timer) is used to avoid false exits due to momentary occlusion. Timeout values from env: `exitTimeoutAfterExitGate`, `exitTimeoutAfterEntryGate`.
   - Implementation: [src/module/presence/presence.service.ts](src/module/presence/presence.service.ts#L1-L220)
3. When the timer fires and conditions hold (`state === IN && lastGate === 'EXIT' && idle >= timeout`), `markOUT` is invoked:
   - Update `PresenceModel` to `OUT`, insert a log (`PresenceLogService`), and call `attendanceService.endSession(...)` which sets `exitAt`, computes duration and persists session end.
   - See `markOUT` implementation: [src/module/presence/presence.service.ts](src/module/presence/presence.service.ts#L220-L380)

Attendance aggregation and API exposure
- Attendance aggregation for UI is computed from `PresenceModel` or `AttendanceModel` via aggregation pipelines in [src/module/attendance/attendance.service.ts](src/module/attendance/attendance.service.ts#L1-L400).
- API endpoints:
  - GET `/api/v1/attendance/today/:employeeId` → `attendanceController.getEmployeeTodayAttendanceSession` ([src/module/attendance/attendance.routes.ts](src/module/attendance/attendance.routes.ts#L1-L40))
  - GET `/api/v1/attendance/events` → `attendanceController.getAllAttendenceEvents` with query validation ([src/module/attendance/attendance.validation.ts](src/module/attendance/attendance.validation.ts#L1-L60)).

**Important invariants & what to watch for (debug checklist)**
- Multer must run before validation on upload routes. Upload routes are declared as `upload...` then `multerErrorHandler` then `validate(...)` then controller. Check [src/module/unknown/unknown.routes.ts](src/module/unknown/unknown.routes.ts#L8-L18).
- Embeddings: embedding API expects binary content; embedding flows use `file.buffer`. Ensure external AI returns expected JSON shape (raw_embeddings, mean_embedding) as code assumes.
- MinIO uploads use `file.buffer` directly (`Body: file.buffer`). Do not convert buffers to strings.
- Redis channel naming: ensure external publisher uses `live-face-tracker:camera-events:<camera_code>` (subscriber uses `psubscribe` pattern). See [src/stream/initCameraBBoxSubscriber.ts](src/stream/initCameraBBoxSubscriber.ts#L1-L240).

**Where Node calls external services (summary)**
- Embedding API: [src/module/shared/embedding/embedding.base.ts](src/module/shared/embedding/embedding.base.ts#L1-L120) (used by employees & unknown flows).
- Merge AI: `http://localhost:4001/merge` in [src/module/unknown/unknown.controller.ts](src/module/unknown/unknown.controller.ts#L116-L126).
- Unknown-match & promote APIs configured in env used by [src/module/employees/application/employee.service.ts](src/module/employees/application/employee.service.ts#L100-L160).
- MinIO/S3: [src/module/shared/minio/minio.client.ts](src/module/shared/minio/minio.client.ts#L1-L60) and [src/module/shared/minio/minio.service.ts](src/module/shared/minio/minio.service.ts#L1-L120).

**Deep attendance flow diagram (linear trace)**
1. Camera/AI → Publish Redis `live-face-tracker:camera-events:entry_1` with payload { event: 'person_entered', person_id, eventTs, similarity }
2. Node redis subscriber ([src/stream/initCameraBBoxSubscriber.ts](src/stream/initCameraBBoxSubscriber.ts#L1-L240)) receives message
3. Subscriber normalizes bounding box and broadcasts WS event to UI via [src/stream/WSStreamServer.ts](src/stream/WSStreamServer.ts#L1-L120)
4. Subscriber calls `presenceService.onPersonEntered(...)` ([src/module/presence/presence.service.ts](src/module/presence/presence.service.ts#L1-L220))
5. If new entry → `markIN`: write/update PresenceModel, log event (PresenceLogService), call `attendanceService.openSession(...)` to create new AttendanceModel record ([src/module/attendance/attendance.service.ts](src/module/attendance/attendance.service.ts#L1-L200))
6. When exit is detected & timer elapses → `markOUT`: write PresenceModel->OUT, log event, call `attendanceService.endSession(...)` to close attendance session and compute durations
7. UI queries attendance through endpoints in [src/module/attendance/attendance.routes.ts](src/module/attendance/attendance.routes.ts#L1-L40)

**Practical debugging notes (file upload / corruption issues)**
- When investigating corrupted uploads from Python clients:
  - Confirm client is not manually setting Content-Type header (requests library sets boundary automatically).
  - Use an in-memory test route (multer memoryStorage) to log `req.file.size` and `req.file.buffer.slice(0,4).toString('hex')` to verify JPEG header `ffd8`.
  - Verify MinIO uploads use the raw Buffer as Body (see [src/module/shared/minio/minio.service.ts](src/module/shared/minio/minio.service.ts#L1-L60)).

**Where to look first if attendance events are missing or wrong**
- Redis publisher: check external AI/camera service that publishes camera-events (not in this repo).
- Redis subscriber logs: [src/stream/initCameraBBoxSubscriber.ts](src/stream/initCameraBBoxSubscriber.ts#L1-L240) — add logs to confirm payload fields.
- Presence service runtime map and scheduled timers: [src/module/presence/presence.service.ts](src/module/presence/presence.service.ts#L1-L380) — examine `exitTimerId` behavior and env-configured timeouts.
- Attendance writes/aggregation: [src/module/attendance/attendance.service.ts](src/module/attendance/attendance.service.ts#L1-L400) — pipeline building and `openSession`/`endSession` logic.

**Environment & configuration pointers**
- See environment config values in [src/config/env.config.ts](src/config/env.config.ts#L1-L120) — keys include MinIO, embeddingApiUrl, LiveKit, timeouts.
- Ensure `EMBEDDING_API_URL`, MinIO vars, and Redis URL are set in environment for production behavior.

**Appendix — quick file map (most relevant files)**
- [src/server.ts](src/server.ts#L1-L120) — bootstrap
- [src/routes/v1/index.ts](src/routes/v1/index.ts#L1-L120) — Router mounts
- [src/module/presence/presence.service.ts](src/module/presence/presence.service.ts#L1-L380) — in-memory presence + DB writes (core attendance orchestration)
- [src/module/attendance/attendance.service.ts](src/module/attendance/attendance.service.ts#L1-L400) — attendance open/end session and aggregations
- [src/stream/initCameraBBoxSubscriber.ts](src/stream/initCameraBBoxSubscriber.ts#L1-L240) — Redis subscription → presence
- [src/module/shared/embedding/embedding.base.ts](src/module/shared/embedding/embedding.base.ts#L1-L140) — embedding API client
- [src/module/shared/minio/minio.service.ts](src/module/shared/minio/minio.service.ts#L1-L120) — MinIO upload
- [src/module/employees/middlewares/multer.ts](src/module/employees/middlewares/multer.ts#L1-L200) — multer config and filters

If you want, I can now:
- Generate a sequence diagram for the attendance flow (Mermaid) and add it to this file.
- Expand any specific section (e.g., storage schema, presence timers, Redis channel contract) into even deeper detail.

