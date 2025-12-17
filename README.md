# Minio Steup

- Command to run minio: `server C:\minio\data --address :9000 --console-address :9001`

# LiveKit Steup

Node.js (control plane)
 ├─ Auth / permissions
 ├─ Camera registry
 ├─ Start / stop streams
 ├─ Health monitoring
 └─ Token generation
        ↓
FFmpeg (media worker, OS process)
 ├─ Pulls RTSP
 ├─ Encodes video
 └─ Publishes to LiveKit (WebRTC)
        ↓
LiveKit (media plane)
 └─ Routes video to browsers
        ↓
Browser (React, WebRTC)


