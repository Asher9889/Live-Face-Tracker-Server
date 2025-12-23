# Architecture Decisions

This document records key architectural decisions made while evolving the system from a prototype to a production-grade, scalable real-time video analytics platform.

The goal is to document **why** decisions were made, not just **what** was built.

---

## ADR-001: Use WebRTC (LiveKit) for Video Streaming

### Status
Accepted

### Context

Initial implementation streamed RTSP camera feeds to the browser using:

RTSP → FFmpeg → WebSocket → JSMpeg → Canvas

This approach worked for:
- demos
- local testing
- 1–2 cameras

However, issues emerged:
- high CPU usage in browser
- poor scalability
- no adaptive bitrate
- no packet loss recovery
- Node.js acting as a media server
- unreliable performance beyond a few cameras

---

### Decision

Replace WebSocket-based video streaming with **WebRTC**, using **LiveKit** as the SFU:

RTSP → FFmpeg → LiveKit (Ingress) → Browser `<video>`

---

### Rationale

- WebRTC is designed for real-time video
- Browser provides hardware decoding
- Adaptive bitrate & congestion control are built-in
- SFU handles multi-client fan-out efficiently
- Media is fully offloaded from Node.js

---

### Consequences

**Positive**
- Stable low-latency playback
- Supports 20+ cameras with proper infrastructure
- Works across desktop & mobile
- Node.js no longer handles media data

**Negative**
- Introduces buffering (100–800ms)
- Requires explicit metadata synchronization
- Slightly higher system complexity

---

## ADR-002: Node.js Is a Control Plane, Not a Media Server

### Status
Accepted

### Context

Node.js originally:
- accepted RTSP streams
- forwarded video frames
- managed client connections
- processed AI metadata

This tightly coupled control logic with high-throughput media flow.

---

### Decision

Restrict Node.js to **control-plane responsibilities only**:

- authentication
- camera registry
- start/stop FFmpeg
- LiveKit signaling
- AI metadata processing
- database writes
- WebSocket metadata delivery

Node.js **never** handles video frames.

---

### Rationale

- Node.js is not optimized for sustained media throughput
- Mixing control and media reduces reliability
- Separation enables independent scaling

---

### Consequences

- Media scaling is delegated to LiveKit
- Control logic remains predictable under load
- Easier horizontal scaling of Node services

---

## ADR-003: WebSocket Used for Metadata Only

### Status
Accepted

### Context

Earlier versions attempted to use WebSocket for:
- video frames
- metadata
- control messages

This caused:
- excessive bandwidth usage
- frame drops
- browser performance issues

---

### Decision

WebSocket is used **only** for:
- AI metadata (bbox, identity, events)
- control events
- stream lifecycle notifications

Video is **never** sent over WebSocket.

---

### Rationale

- WebSocket has no congestion control
- No media-specific buffering or recovery
- WebRTC is purpose-built for video

---

### Consequences

- Clean separation of concerns
- Predictable metadata flow
- Easier debugging and observability

---

## ADR-004: AI Events Are Frame-Annotated Metadata (Not Real-Time UI Events)

### Status
Accepted

### Context

AI events originally contained a `timestamp` generated at **event creation time** (inference completion).

This caused:
- bounding boxes appearing before video frames
- visible overlay drift
- inconsistent behavior under load

---

### Decision

AI events are treated as **annotations of specific video frames**, not real-time UI triggers.

Each AI event must include:
- `frameTs` → when the video frame was captured
- optional `eventTs` → when inference completed

Frontend uses **only `frameTs`** for rendering decisions.

---

### Rationale

- AI inference is faster than video playback
- WebRTC introduces buffering
- UI must align overlays with displayed frames
- Timestamp semantics must be explicit

---

### Consequences

- Requires AI team contract change
- Enables deterministic overlay rendering
- Removes timing hacks and TTL-based sync

---

## ADR-005: Time-Based Synchronization Over Frame-Based Synchronization

### Status
Accepted

### Context

LiveKit (WebRTC) does not expose raw frames or frame indices to the browser.

Attempting to match AI frames by index or count is not feasible.

---

### Decision

Synchronization is performed using **wall-clock time**:

- AI emits `frameTs` (epoch ms)
- Node emits `streamStartTs` when FFmpeg starts
- Browser derives current video frame time using:

  streamStartTs + video.currentTime

Bounding boxes are rendered based on **time proximity**, not arrival order.

---

### Rationale

- WebRTC playback time is monotonic
- Buffering introduces constant offset, not randomness
- Time-based alignment is industry standard (VMS, conferencing, sports analytics)

---

### Consequences

- Small fixed offset required (`DISPLAY_OFFSET_MS`)
- Minor tolerance window (±50–100ms)
- System remains stable under network jitter

---

## ADR-006: TTL Is Used Only for Cleanup, Not Synchronization

### Status
Accepted

### Context

TTL-based cleanup was initially used to hide early overlays.

This masked the issue but failed under scale.

---

### Decision

TTL is used **only** to:
- clean up old metadata
- prevent memory growth

TTL is **never** used to align metadata with video playback.

---

### Rationale

- TTL cannot guarantee correct timing
- Sync must be deterministic, not probabilistic

---

### Consequences

- Cleaner state management
- Explicit synchronization logic
- Easier debugging

---

## Summary

These decisions collectively enforce the following principles:

- RTSP ≠ Browser protocol
- WebSocket ≠ Video transport
- Node.js ≠ Media server
- WebRTC = Real-time video
- AI metadata must be frame-addressable
- Time is the synchronization contract

This architecture matches patterns used in:
- enterprise VMS systems
- smart surveillance platforms
- access control & analytics products
