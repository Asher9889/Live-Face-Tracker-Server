const EventNames = {
  EMPLOYEE_CREATED: "employee.created",
  EMPLOYEE_UPDATED: "employee.updated",
  EMPLOYEE_DELETED: "employee.deleted",

  EMBEDDING_UPDATED: "embedding.updated",
} as const;

export const RedisEventNames = {
    EMPLOYEE_CREATED: "live-face-tracker:employee:created",
    CAMERA_STATE: (cameraId: string) =>  `live-face-tracker:camera-event:${cameraId}:status`
}


export default EventNames;