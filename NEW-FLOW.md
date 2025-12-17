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

