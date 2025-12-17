# Installation

- Install Docker engine
    - sudo usermod -aG docker thelifeastro (If current user is not have access to root)
- Follow livekit offical doc to install over wps using docker.
- Port 7880 = LiveKit signaling

```javascript
Your production config files are generated in directory: livekit.mssplonline.in

Please point update DNS for the following domains to the IP address of your server.
 * livekit.mssplonline.in
 * livekit-turn.mssplonline.in
Once started, Caddy will automatically acquire TLS certificates for the domains.

The file "init_script.sh" is a script that can be used in the "user-data" field when starting a new VM.

Please ensure the following ports are accessible on the server
 * 443 - primary HTTPS and TURN/TLS
 * 80 - for TLS issuance
 * 7881 - for WebRTC over TCP
 * 3478/UDP - for TURN/UDP
 * 50000-60000/UDP - for WebRTC over UDP

Server URL: wss://livekit.mssplonline.in
API Key: APIeRxMYAsQbTWq
API Secret: fmGQuX3ZnNddKj6msJSRxQ9eOkYYWt3q5cfdmIOYmQmB

Here's a test token generated with your keys: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE4MDE4MTQ3MzQsImlzcyI6IkFQSWVSeE1ZQXNRYlRXcSIsIm5hbWUiOiJUZXN0IFVzZXIiLCJuYmYiOjE3NjU4MTQ3MzQsInN1YiI6InRlc3QtdXNlciIsInZpZGVvIjp7InJvb20iOiJteS1maXJzdC1yb29tIiwicm9vbUpvaW4iOnRydWV9fQ.Zc1ptL5L9Y5LQ84KvA3A0tXik0Jsq2rOwvhx0M-TCwo

An access token identifies the participant as well as the room it's connecting to
thelifeastro@114:~/livekit-server$ 

```

# FFmpeg 
- FFmpeg is NOT just decoding. In this setup FFmpeg is doing three things:
    - Pulling RTSP from camera
    - Re-encoding / packetizing video
    - Publishing that media to LiveKit
- How does FFmpeg publish media into LiveKit?
  - Answer: via LiveKit Ingress (WHIP).
- LiveKit cannot accept:
  - raw RTSP
  - raw RTP over UDP
  - WebSocket video
- LiveKit can accept:
  - WHIP (WebRTC HTTP Ingest) ✅ BEST(We will use it. Need to install Whip service from livekit)
  - RTMP
  - LiveKit SDK publishers

# What LiveKit actually is (core concept)
  - LiveKit is not a generic media server.
  - LiveKit is a WebRTC SFU (Selective Forwarding Unit) with an application model: 
  - Selective Forwarding Unit (SFU).
    - Ingest media once
    - Forward to many viewers
    - No re-encoding
    - Minimal CPU usage
    - Camera → Ingress → LiveKit → N viewers


# Ingress exists because FFmpeg outputs media, but LiveKit needs a publisher participant.
- FFmpeg can push bytes in many protocols.
- LiveKit does not accept raw media protocols directly.
- Ingress is the bridge that turns “media input” into a LiveKit participant.

# Protocols in different level
| Component   | Protocol      |
| ----------- | ------------- |
| Camera      | RTSP          |
| FFmpeg      | RTSP → RTMP   |
| Ingress     | RTMP → WebRTC |
| LiveKit SFU | WebRTC        |
| Browser     | WebRTC        |
