import type { TGateType } from "./camera.constant";

export interface ICameraProps {
  name: string;
  code: string;

  gateType: TGateType;
  location: string;

  rtspUrl: string;

  credentials: {
    username: string | null;
    password: string | null;
  } | null;

  streamConfig: {
    aiFps: number | null;
    displayFps: number | null;
  } | null;

  enabled: boolean | null;

  roi: {
    enabled: boolean | null;
    polygons: number[][] | null;
  } | null;

  wsStreamId: string | null;

  status: {
    online: boolean;
    lastCheckedAt: Date | null;
    lastFrameAt: Date | null;
  };
}

export default class Camera {
  private props: ICameraProps;

  constructor(props: ICameraProps) {
    this.props = {
      ...props,

      credentials: props.credentials ?? { username: null, password: null },

      streamConfig: props.streamConfig ?? {
        aiFps: 25,
        displayFps: 25,
      },

      roi: props.roi ?? {
        enabled: null,
        polygons: null,
      },

      enabled: props.enabled ?? null,

      wsStreamId: props.wsStreamId ?? null,

      status: {
        online: props.status?.online ?? false,
        lastCheckedAt: props.status?.lastCheckedAt ?? null,
        lastFrameAt: props.status?.lastFrameAt ?? null,
      },
    };
  }

  // ----------------- Getters ------------------

  get name() { return this.props.name; }
  get code() { return this.props.code; }
  get gateType() { return this.props.gateType; }
  get location() { return this.props.location; }

  get rtspUrl() { return this.props.rtspUrl; }

  get credentials() { return this.props.credentials; }

  get streamConfig() { return this.props.streamConfig; }

  get enabled() { return this.props.enabled; }

  get roi() { return this.props.roi; }

  get wsStreamId() { return this.props.wsStreamId; }

  get status() { return this.props.status; }


  // ---------------- Domain Logic ----------------

  markOnline() {
    this.props.status.online = true;
    this.props.status.lastCheckedAt = new Date();
  }

  markOffline() {
    this.props.status.online = false;
    this.props.status.lastCheckedAt = new Date();
  }

  updateLastFrameTimestamp() {
    this.props.status.lastFrameAt = new Date();
  }

  toggleEnabled(value: boolean | null) {
    this.props.enabled = value;
  }

  updateRtspUrl(newUrl: string) {
    this.props.rtspUrl = newUrl;
  }

  updateLocation(newLocation: string) {
    this.props.location = newLocation;
  }

  updateGateType(newGate: TGateType) {
    this.props.gateType = newGate;
  }

  toJSON(): ICameraProps {
    return { ...this.props };
  }
}
