# 🐞 Bug: AI Bounding Boxes Appear Before Video Frame Is Displayed

### Summary

- Bounding box overlays (face detection / recognition) appear earlier than the corresponding video frame in the browser when streaming via LiveKit (WebRTC).
- This results in visible “floating boxes” or misaligned overlays.
---
```javascript
- RTSP Camera => FFmpeg (RTSP → WebRTC Ingress) => LiveKit (SFU) => Browser <video>
- Python AI (RTSP ingestion) => Redis Pub/Sub => Node.js (Control Plane) => WebSocket => Browser (Canvas Overlay)
```
---
## Observed Behavior
- AI bounding box events arrive at the frontend before the video frame is visible.
- Bounding boxes briefly appear on incorrect positions or on empty frames.
- Issue becomes more noticeable when:
    - network latency increases
    - multiple cameras are active
    - WebRTC buffering increases

## Expected Behavior
- Bounding boxes should be rendered only when the corresponding video frame is visible.
- AI metadata and video playback must be time-aligned.

### Root Cause Analysis
1. Different Latency Profiles
```
| Pipeline                                                     | Latency      |
| ------------------------------------------------------------ | ------------ |
| AI inference (RTSP → OpenCV → model)                         | ~50–200 ms   |
| Video streaming (RTSP → FFmpeg → LiveKit → WebRTC → Browser) | ~300–1200 ms |
```
2. Incorrect Timestamp Semantics
```
AI events include a timestamp field generated at event creation time
{
  "event": "track_update",
  "timestamp": 1766479491
}
This timestamp represents AI processing time, not video frame capture time.
```
3. Frontend Uses “Latest State” Instead of “Frame Time”
  - The frontend originally:
    - applied bounding boxes immediately upon WebSocket arrival
    - used TTL-based cleanup (e.g. 500–800 ms)
    - did not align metadata with video playback time
    - TTL masked the issue but did not solve synchronization.
---
### Why This Happens (Key Insight)
- AI events are frame annotations, not real-time UI events.
- Without knowing which video frame an AI event belongs to, the frontend cannot synchronize overlays with WebRTC playback.
  - Because:
    - WebRTC buffers video
    - AI metadata arrives earlier
    - there is no shared time reference
---
## Correct Design Principle
- Both video and AI metadata must be aligned on the same time axis.
- The correct shared axis is wall-clock time (epoch milliseconds) representing frame capture time.

#### Required Contract Change (Fix)
1. AI Event Payload
  - AI must emit frame capture timestamp, not inference timestamp.
```
{
  "event": "person_update",
  "cameraCode": "entry_1",
  "trackId": 58,
  "bbox": {...},
  "frameTs": 1766479491123,   // frame capture time (ms)
  "eventTs": 1766479491650    // inference completion time (optional)
}

```
- frameTs is used for synchronization
- eventTs is for observability only

## Frontend Synchronization Strategy
1. When FFmpeg starts streaming to LiveKit, Node emitts
```
{
  "type": "camera:stream_started",
  "payload": {
    "cameraCode": "entry_1",
    "streamStartTs": 1766479489000
  }
}
```
2. Frontend calculates current video frame time:
```
currentVideoFrameTs = streamStartTs + video.currentTime * 1000 - DISPLAY_OFFSET_MS;
```
3. Bounding boxes are rendered only if:
```
abs(frameTs - currentVideoFrameTs) < toleranceMs
```