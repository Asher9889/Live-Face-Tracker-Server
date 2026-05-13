import { PresenceLogModel } from "./presence-log.model";
import { PresenceLogType } from "../../../domain/types";
import mongoose from "mongoose";

type PresenceLogInput = {
  employeeId: string;

  eventType: PresenceLogType;

  fromState?: "IN" | "OUT" | "EXIT_PENDING" | "PENDING_EXIT";
  toState?: "IN" | "OUT" | "EXIT_PENDING" | "PENDING_EXIT";

  cameraCode?: string;
  occurredAt?: number;
  date: string

  source?: "face_recognition" | "manual" | "system";
  confidence?: number;
  note?: string | undefined;
};


class PresenceLogService {
  async insertLog(input: PresenceLogInput, session?: mongoose.ClientSession) {
    const occurredAt = input.occurredAt ?? Date.now();

    const log = new PresenceLogModel({
      employeeId: input.employeeId,
      eventType: input.eventType,
      fromState: input.fromState,
      toState: input.toState,
      cameraCode: input.cameraCode,
      occurredAt,
      date: input.date,
      source: input.source ?? "face_recognition",
      confidence: input.confidence,
      note: input.note,
    });

    await log.save(session ? { session } : {});

    return { logged: true };
  }
}


export default PresenceLogService;
