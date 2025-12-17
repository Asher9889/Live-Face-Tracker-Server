import { IngressClient, IngressInput, type CreateIngressOptions } from "livekit-server-sdk";
import { envConfig } from "../config";

const ingressClient = new IngressClient(
  envConfig.liveKitIngressHost,
  envConfig.liveKitApiKey,
  envConfig.liveKitApiSecret
);

export async function createCameraIngress(cameraId: string) {
  const options: CreateIngressOptions = {
    roomName: cameraId,
    participantIdentity: `camera_${cameraId}`,
    name: `Camera ${cameraId}`,
  };

  return await ingressClient.createIngress(
    IngressInput.RTMP_INPUT,
    options            
  );
}
