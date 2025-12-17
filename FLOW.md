Frontend
  │
  │ POST /cameras/t12/start
  ▼
Node.js
  │  creates ingress
  │  spawns FFmpeg
  ▼
FFmpeg ──RTMP──▶ Ingress ──WebRTC──▶ LiveKit
                                      │
                                      ▼
                                  Browser <video>

Python AI ──Redis──▶ Node ──WS──▶ Browser overlay
