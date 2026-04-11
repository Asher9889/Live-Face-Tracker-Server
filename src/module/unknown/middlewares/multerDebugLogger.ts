import { NextFunction, Request, Response } from "express";

export default function multerDebugLogger(req: Request, res: Response, next: NextFunction) {
  const enabled = String(process.env.NODE_DEBUG_UNKNOWN_IMAGES || "false").toLowerCase() === "true";
  if (!enabled) return next();

  try {
    console.log("[MulterDebug] headers.content-type=", req.headers["content-type"] || "N/A");
    console.log("[MulterDebug] headers.content-length=", req.headers["content-length"] || "N/A");

    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file as Express.Multer.File] : []);
    if (!files || files.length === 0) {
      console.log("[MulterDebug] No files parsed by multer (req.files empty)");
      return next();
    }

    for (const f of files) {
      const bufferLen = f.buffer ? f.buffer.length : 0;
      console.log(`[MulterDebug] field=${f.fieldname} original=${f.originalname} size=${f.size} buffer=${bufferLen} mimetype=${f.mimetype} path=${(f as any).path || 'N/A'}`);
    }
  } catch (err) {
    console.error("[MulterDebug] error while logging:", err);
  }

  next();
}
