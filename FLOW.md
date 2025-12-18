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



# For live Status broadcast
CameraController
   ↓
Redis HSET (state)
   ↓
Redis PUBLISH (event)
   ↓
Redis Subscriber (Node)
   ↓
WSStreamServer.broadcast()
   ↓
Browser

# Redis
- Connection A → commands + writes
- Connection B → subscriptions only
- You must NOT use the same Redis connection for normal commands and Pub/Sub subscriptions.
- You should:
  - use one Redis connection for GET / SET / HSET / PUBLISH
  - use a separate Redis connection for SUBSCRIBE
  - That’s why redis.duplicate() exists.

