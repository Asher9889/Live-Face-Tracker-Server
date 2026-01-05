import { PresenceLogModel } from "./presence-log.model";

type PresenceLogInput = {
  employeeId: string;

  eventType: "ENTRY_DETECTED" | "EXIT_DETECTED" | "AUTO_EXIT_TIMEOUT" | "SYSTEM_RECOVERY" | "MANUAL_CORRECTION";

  fromState?: "IN" | "OUT";
  toState?: "IN" | "OUT";

  cameraCode?: string;
  occurredAt?: number;

  source?: "face_recognition" | "manual" | "system";
  confidence?: number;
  note?: string | undefined;
};


class PresenceLogService {
  async insertLog(input: PresenceLogInput) {
    const occurredAt = input.occurredAt ?? Date.now();

    const log = new PresenceLogModel({
      employeeId: input.employeeId,
      eventType: input.eventType,
      fromState: input.fromState,
      toState: input.toState,
      cameraCode: input.cameraCode,
      occurredAt,
      source: input.source ?? "face_recognition",
      confidence: input.confidence,
      note: input.note,
    });

    await log.save();

    return { logged: true };
  }
}


export default PresenceLogService;
