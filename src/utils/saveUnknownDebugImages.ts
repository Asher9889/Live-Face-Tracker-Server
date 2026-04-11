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

      // Try to obtain raw bytes robustly: prefer buffer (memoryStorage), then disk path, then stream
      let rawData: Buffer | null = null;
      const bufferLen = file.buffer ? file.buffer.length : 0;
      try {
        if (file.buffer && bufferLen > 0) {
          rawData = file.buffer as Buffer;
        } else if ((file as any).path) {
          try {
            rawData = await fs.readFile((file as any).path);
          } catch (_) {
            rawData = null;
          }
        } else if ((file as any).stream && typeof (file as any).stream.pipe === 'function') {
          // read stream into buffer
          rawData = await new Promise<Buffer | null>((resolve) => {
            const chunks: Buffer[] = [];
            (file as any).stream.on('data', (c: Buffer) => chunks.push(c));
            (file as any).stream.on('end', () => resolve(Buffer.concat(chunks)));
            (file as any).stream.on('error', () => resolve(null));
          });
        }
      } catch (e) {
        rawData = null;
      }

      // Save raw binary exactly as received (or empty if unavailable)
      if (rawData && rawData.length > 0) {
        await fs.writeFile(rawPath, rawData);
      } else {
        // ensure a file exists so user can inspect folder; write zero bytes if nothing else
        await fs.writeFile(rawPath, Buffer.alloc(0));
      }

      let decodeSuccess = false;
      let width: number | null = null;
      let height: number | null = null;
      let decodedFilename: string | null = null;
      let errorMessage: string | null = null;

      try {
        // Only attempt decode if we have non-empty rawData
        if (rawData && rawData.length > 0) {
          const image = sharp(rawData);
          const meta = await image.metadata();
          const out = await image.jpeg({ quality: 90 }).toBuffer();
          decodedFilename = `${ts}_${safeField}_decoded.jpg`;
          const decodedPath = path.join(baseDir, decodedFilename);
          await fs.writeFile(decodedPath, out);
          decodeSuccess = true;
          width = meta.width ?? null;
          height = meta.height ?? null;
        } else {
          decodeSuccess = false;
          errorMessage = "No raw bytes available (size=0)";
        }
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
        bufferLength: bufferLen,
        rawSavedBytes: rawData ? rawData.length : 0,
        rawPath: rawFilename,
        decodedPath: decodedFilename,
        decodeSuccess,
        width,
        height,
        errorMessage,
      };

      metadataEntries.push(entry);

      // Safe one-line logging per file
      console.log(`[UnknownDebug] ${file.fieldname} decode=${decodeSuccess ? 'OK' : 'FAIL'} size=${file.size} buffer=${bufferLen} saved=${rawData ? rawData.length : 0} raw=${rawPath} decoded=${decodedFilename ? path.join(baseDir, decodedFilename) : 'FAILED'}`);
    }

    const metaFile = path.join(baseDir, `metadata.json`);
    await fs.writeFile(metaFile, JSON.stringify({ generatedAt: new Date().toISOString(), entries: metadataEntries }, null, 2));
  } catch (err) {
    // do not throw — this helper must not break normal flow
    console.error("saveUnknownDebugImages error:", err);
  }
}
