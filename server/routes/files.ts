import { Router, Request, Response } from "express";
import multer from "multer";
import {
  processAndStoreFile,
  getSessionFiles,
  deleteSessionFile,
  clearSessionFiles,
} from "../services/file-store.js";
import { MAX_FILE_SIZE_BYTES } from "../middleware/security.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

// POST /api/files/upload
router.post("/files/upload", upload.array("files", 5), async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  if (!sessionId) {
    res.status(400).json({ error: "Missing session ID" });
    return;
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  try {
    const uploadedResults = [];

    for (const file of files) {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const stored = await processAndStoreFile(
        sessionId,
        fileId,
        file.originalname,
        file.mimetype,
        file.buffer
      );

      uploadedResults.push({
        id: stored.id,
        name: stored.originalName,
        size: stored.sizeBytes,
        mimeType: stored.mimeType,
        isImage: stored.isImage,
        pageCount: stored.pageCount,
        summary: stored.summary,
      });
    }

    res.json({
      success: true,
      files: uploadedResults,
    });
  } catch (err: any) {
    console.error("File upload error:", err);
    res.status(500).json({
      error: `File processing failed: ${err.message}`,
    });
  }
});

// GET /api/files
router.get("/files", (req: Request, res: Response) => {
  const sessionId = req.headers["x-session-id"] as string;
  const files = getSessionFiles(sessionId).map((f) => ({
    id: f.id,
    name: f.originalName,
    size: f.sizeBytes,
    mimeType: f.mimeType,
    isImage: f.isImage,
    pageCount: f.pageCount,
    summary: f.summary,
    uploadedAt: f.uploadedAt,
  }));

  res.json({ files });
});

// DELETE /api/files/:id
router.delete("/files/:id", (req: Request, res: Response): void => {
  const sessionId = req.headers["x-session-id"] as string;
  const fileId = req.params.id;

  const deleted = deleteSessionFile(sessionId, fileId);
  if (!deleted) {
    res.status(404).json({ error: "File not found or already deleted in this session" });
    return;
  }

  res.json({ success: true, fileId });
});

export default router;
