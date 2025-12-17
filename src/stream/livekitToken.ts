// livekitToken.ts
import { AccessToken } from "livekit-server-sdk";
import { envConfig } from "../config";

export function createCameraToken(cameraId: string) {
  const at = new AccessToken(envConfig.liveKitApiKey, envConfig.liveKitApiSecret, { identity: `camera_${cameraId}` });

  at.addGrant({
    room: cameraId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: false,
  });

  return at.toJwt();
}

export async function createViewerToken(roomName: string, identity: string) {
  const at = new AccessToken(envConfig.liveKitApiKey, envConfig.liveKitApiSecret, { identity } );

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: false,
    canSubscribe: true,
  });

  return at.toJwt();
}
