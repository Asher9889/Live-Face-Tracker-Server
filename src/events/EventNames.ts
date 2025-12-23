const EventNames = {
  EMPLOYEE_CREATED: "employee.created",
  EMPLOYEE_UPDATED: "employee.updated",
  EMPLOYEE_DELETED: "employee.deleted",

  EMBEDDING_UPDATED: "embedding.updated",

  // Camera events
  CAMERA_STREAM_STARTED: "camera:stream:started",
  CAMERA_STREAM_STOPPED: "camera:stream:stopped",
} as const;

// for pub/bub
export const RedisEventNames = {
  EMPLOYEE_CREATED: "live-face-tracker:employee:created",
  CAMERA_STATE : (cameraId: string) =>  `live-face-tracker:camera-event:${cameraId}:status`,
  CAMERA_STATE_CHANGED : `live-face-tracker:camera-event:status:change`,
  AI_HUMAN_DETETCT_EVENT : (cameraId: string) => `live-face-tracker:camera-events:${cameraId}`, // live-face-tracker:camera-events:ent
}



export default EventNames;