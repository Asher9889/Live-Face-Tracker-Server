import { type TGateType } from "../../domain/camera.constant";

export interface CreateCameraDTO {

  name: string; // "Entry Gate 1",
  code: string;  // "entry_1",                        

  gateType: TGateType; // // ENTRY | EXIT | BOTH | VISITOR
  location: string; // "Main Entrance"  human-readable location

  rtspUrl: string;
  credentials: {
    username: string | null;
    password: string | null;
  };

  streamConfig: {
    aiFps: number;
    displayFps: number;
  };

  enabled: boolean;

  roi: {
    enabled: boolean | null;
    polygons: number[][] | null;          // [[x,y], [x,y], ...]
  };

  wsStreamId: string | null;

  status: {
    online: boolean;
    lastCheckedAt: Date | null;
    lastFrameAt: Date | null;
  };
}
