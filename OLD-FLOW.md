# 🚀 CCTV Streaming + AI Recognition System (Production Architecture)

This document explains:

1. Our **current CCTV streaming architecture**
2. Why it works for **1–6 cameras**
3. Why it **fails beyond ~20 cameras**
4. Why we are migrating to **LiveKit (WebRTC media server)**
5. What changes and what stays the same

This is **not a college demo** — this design is meant for real deployments.

---

## 🧠 Current System Overview

### High-level flow (current)
- RTSP Camera
-   ↓
- FFmpeg (spawned by Node)
-   ↓ 
- MPEG-TS (mpeg1video)
-   ↓
- Node.js
-   ↓ 
- WebSocket
-   ↓
- Browser (JSMpeg)



### Frontend
- Receives **video stream via WebSocket**
- Decodes using **JSMpeg (WASM)**
- Draws bounding boxes on overlay canvas

### Node.js
- Spawns FFmpeg per camera
- Pipes video bytes through Node
- Broadcasts video to WebSocket clients
- Receives AI events via Redis
- Writes logs to DB
- Sends metadata overlays to frontend

### Python AI
- Reads RTSP directly
- Detects faces
- Tracks persons
- Publishes events to Redis

---

## ✅ Why This Works for 1–6 Cameras

This setup works **initially** because:

### 1️⃣ Low concurrency
- Few FFmpeg processes
- Few WebSocket clients
- Node event loop not saturated

### 2️⃣ Manageable CPU load
- MPEG1 decoding happens in browser
- Node only relays bytes
- Memory usage stays bounded

### 3️⃣ Acceptable latency
- ~200–400 ms latency
- Fine for demos, POCs, internal testing

### 4️⃣ Simple deployment
- Single Node server
- No separate media infrastructure
- Easy to debug early on

For **small installations (1–6 cameras, 1–2 viewers)** this is acceptable.

---

## ❌ Why This Architecture Fails at ~20 Cameras

As camera count increases, **fundamental architectural limits** are hit.

---

### ❌ Problem 1: Node.js becomes a media server (wrong role)

Node is handling:
- raw video bytes
- fan-out to multiple clients
- buffering
- backpressure (poorly)

Node is **not designed** to be a media data plane.

**Result:**
- event loop stalls
- GC pauses
- dropped frames
- random freezes

---

### ❌ Problem 2: No congestion control

WebSocket streaming:
- has no adaptive bitrate
- has no packet loss recovery
- has no jitter buffer

One slow client can:
- block buffers
- increase memory usage
- affect all viewers

---

### ❌ Problem 3: CPU-heavy frontend decoding

JSMpeg:
- decodes video in JavaScript/WASM
- no hardware acceleration
- very expensive at scale

At ~20 cameras:
- laptops throttle
- mobile devices fail
- browsers drop frames

---

### ❌ Problem 4: Poor scalability model

Scaling WebSocket video means:
- more Node instances
- more FFmpeg processes
- duplicated RTSP pulls
- higher camera load

This does **not scale horizontally**.

---

### ❌ Problem 5: Unreliable long uptime

Over hours/days:
- FFmpeg restarts accumulate
- memory slowly grows
- streams desync from AI overlays
- system requires manual restarts

This is unacceptable for production CCTV.

---

## 🧨 Root Cause Summary

| Issue | Reason |
|-----|------|
Node instability | Media handled in JS |
High CPU | MPEG1 + JSMpeg |
No backpressure | WebSocket misuse |
No scaling | Tight coupling |
Poor reliability | No media protocol |

---

## ✅ Why LiveKit Fixes All These Problems

### Key architectural change

**Node no longer handles video bytes.**

---

## 🟩 New Architecture (with LiveKit)

RTSP Camera
↓
FFmpeg (RTSP → RTP)
↓
LiveKit (WebRTC SFU)
↓
Browser <video>

Python AI
↓ Redis
Node.js
↓ WebSocket
Browser (bbox overlays)



---

## 🧩 Responsibilities After Migration

### LiveKit (Media Server)
- WebRTC streaming
- Jitter buffering
- Packet loss recovery
- Congestion control
- Hardware decoding in browser
- Multi-client fan-out

### Node.js (Control Plane)
- Authentication
- Camera registry
- Start/stop FFmpeg
- LiveKit signaling
- AI event processing
- DB writes
- WebSocket metadata

### Python AI
- Unchanged
- Continues RTSP processing
- Publishes recognition events

---

## 🚀 Why This Scales to 20+ Cameras

### ✅ Media offloaded from Node
- Node handles **control**, not data
- Stable under load

### ✅ WebRTC is designed for video
- Adaptive bitrate
- NAT traversal
- Hardware decoding
- Low latency

### ✅ One FFmpeg per camera
- No duplicate RTSP pulls
- Camera-friendly

### ✅ Browser performance
- GPU accelerated decoding
- Works on mobile & desktop

### ✅ Horizontal scaling
- LiveKit scales independently
- Node scales independently
- AI workers scale independently

---

## 📈 Expected Performance (Realistic)

| Cameras | Result |
|-------|-------|
1–6 | Perfect |
10–20 | Stable |
20–50 | Scales with infra |
50+ | Add nodes / SFU |

---

## 🧠 Final Design Principles (Non-negotiable)

- **RTSP ≠ Browser protocol**
- **WebSocket ≠ Video transport**
- **Node ≠ Media server**
- **WebRTC = Real-time video**
- **WS = Metadata only**

---

## 🏁 Conclusion

The original WebSocket + JSMpeg setup is:
- good for learning
- good for demos
- NOT production-grade

Migrating to **LiveKit**:
- preserves your AI pipeline
- preserves your overlay logic
- fixes scaling and reliability
- enables real deployments

This is the architecture used by:
- enterprise VMS
- smart offices
- airports
- access-control systems

---

## ✅ Next Steps

1. Deploy LiveKit server
2. Route RTSP → FFmpeg → LiveKit
3. Replace JSMpeg with WebRTC player
4. Keep WebSocket overlays unchanged
5. Gradually remove WS video streaming



