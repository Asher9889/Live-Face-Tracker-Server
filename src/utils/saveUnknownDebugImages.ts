import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from 'uuid';
import { Request } from "express";

type Context = {
  endpoint: string;
  unknownId?: string;
};

export default async function saveUnknownDebugImages(req: Request, context: Context) {
  try {
    console.log(`[UnknownDebug] Saving debug images for endpoint ${context.endpoint} with unknownId=${context.unknownId || "N/A"}`);
    const enabled = String(process.env.NODE_DEBUG_UNKNOWN_IMAGES || "false").toLowerCase() === "true";
    if (!enabled) return;

    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file as Express.Multer.File] : []);
    if (!files || files.length === 0) return;

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const idPart = context.unknownId ? `unknown_${context.unknownId}` : `unknown_${uuidv4().slice(0,8)}`;
    const baseDir = path.join(process.cwd(), "debug_node_images", date, idPart);
    await fs.mkdir(baseDir, { recursive: true });

    const metadataEntries: any[] = [];

    for (const file of files) {
      const timestamp = Date.now();
      const ts = String(timestamp);
      const safeField = (file.fieldname || "file").replace(/[^a-zA-Z0-9-_\.]/g, "_");

      const rawFilename = `${ts}_${safeField}_raw.bin`;
      const rawPath = path.join(baseDir, rawFilename);
      // Save raw binary exactly as received
      if (file.buffer) {
        await fs.writeFile(rawPath, file.buffer);
      } else if (file.path) {
        // fallback: copy from path
        const data = await fs.readFile(file.path);
        await fs.writeFile(rawPath, data);
      }

      let decodeSuccess = false;
      let width: number | null = null;
      let height: number | null = null;
      let decodedFilename: string | null = null;
      let errorMessage: string | null = null;

      try {
        const image = sharp(file.buffer as Buffer);
        const meta = await image.metadata();
        const out = await image.jpeg({ quality: 90 }).toBuffer();
        decodedFilename = `${ts}_${safeField}_decoded.jpg`;
        const decodedPath = path.join(baseDir, decodedFilename);
        await fs.writeFile(decodedPath, out);
        decodeSuccess = true;
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch (err: any) {
        decodeSuccess = false;
        errorMessage = err?.message ? String(err.message) : String(err || "unknown error");
      }

      const entry = {
        endpoint: context.endpoint,
        timestamp: new Date().toISOString(),
        unknownId: context.unknownId || null,
        fieldName: file.fieldname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        rawPath: rawFilename,
        decodedPath: decodedFilename,
        decodeSuccess,
        width,
        height,
        errorMessage,
      };

      metadataEntries.push(entry);

      // Safe one-line logging per file
      console.log(`[UnknownDebug] ${file.fieldname} decode=${decodeSuccess ? 'OK' : 'FAIL'} raw=${rawPath} decoded=${decodedFilename ? path.join(baseDir, decodedFilename) : 'FAILED'}`);
    }

    const metaFile = path.join(baseDir, `metadata.json`);
    await fs.writeFile(metaFile, JSON.stringify({ generatedAt: new Date().toISOString(), entries: metadataEntries }, null, 2));
  } catch (err) {
    // do not throw — this helper must not break normal flow
    console.error("saveUnknownDebugImages error:", err);
  }
}
