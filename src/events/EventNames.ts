const EventNames = {
  EMPLOYEE_CREATED: "employee.created",
  EMPLOYEE_UPDATED: "employee.updated",
  EMPLOYEE_DELETED: "employee.deleted",

  EMBEDDING_UPDATED: "embedding.updated",
} as const;

export const RedisEventNames = {
    EMPLOYEE_CREATED: "live-face-tracker:employee:created"
}


export default EventNames;