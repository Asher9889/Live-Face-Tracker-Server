import { z } from "zod";
import { GATE_TYPE } from "../domain/camera.constant";

export const cameraSchema = z.object({
  name: z.string().min(4, "Camera name is required"),
  code: z.string().min(4, "Camera code is required"),

  gateType: z.enum(Object.values(GATE_TYPE)),

  location: z.string().min(4, "Location is required"),

  rtspUrl: z.url({error : "Please enter a valid RTSP URL"}),

  // ------- Embedded: credentials -------
  credentials: z
    .object({
      username: z.string().nullable().default(null),
      password: z.string().nullable().default(null),
    }),

  // ------- Embedded: streamConfig -------
  streamConfig: z
    .object({
      aiFps: z.number().default(25),
      displayFps: z.number().default(25),
    }),

  // ------- Embedded: ROI -------
  roi: z
    .object({
      enabled: z.boolean().default(false),
      polygons: z
        .array(z.array(z.number())).nullable()
        .default(null), // number[][]
    }),

  wsStreamId: z.string().nullable().default(null),

  enabled: z.boolean().default(false),

  // ------- Embedded: status -------
  status: z.object({
    online: z.boolean().default(false),
    lastCheckedAt: z.coerce.date().nullable().default(null),
    lastFrameAt: z.coerce.date().nullable().default(null),
  }),
});


export type TCameraSchema = z.infer<typeof cameraSchema>;
