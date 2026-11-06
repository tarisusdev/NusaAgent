import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export interface StoredFile {
  id: string;
  sessionId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
  extractedText?: string;
  base64Data?: string;
  isImage: boolean;
  pageCount?: number;
  summary?: string;
}

// In-memory session file storage
const sessionFiles = new Map<string, StoredFile[]>();

export async function processAndStoreFile(
  sessionId: string,
  fileId: string,
  originalName: string,
  mimeType: string,
  buffer: Buffer
): Promise<StoredFile> {
  const isImage = mimeType.startsWith("image/");
  let extractedText = "";
  let base64Data: string | undefined;
  let pageCount: number | undefined;

  if (isImage) {
    base64Data = buffer.toString("base64");
    extractedText = `[Image file: ${originalName}, MIME: ${mimeType}, Size: ${(buffer.length / 1024).toFixed(1)} KB]`;
  } else if (mimeType === "application/pdf" || originalName.toLowerCase().endsWith(".pdf")) {
    try {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || "";
      pageCount = pdfData.numpages;
    } catch (err: any) {
      console.error("PDF parse error:", err);
      extractedText = `[Error extracting PDF text: ${err.message}]`;
    }
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    originalName.toLowerCase().endsWith(".docx")
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || "";
    } catch (err: any) {
      console.error("DOCX parse error:", err);
      extractedText = `[Error extracting DOCX text: ${err.message}]`;
    }
  } else {
    // Text formats: txt, md, csv, json, js, ts, html, py, etc.
    try {
      extractedText = buffer.toString("utf-8");
    } catch {
      extractedText = buffer.toString("ascii");
    }
  }

  // Create summary preview
  const preview = extractedText.replace(/\s+/g, " ").trim().slice(0, 300);
  const summary = preview.length > 0 ? preview : `File ${originalName}`;

  const storedFile: StoredFile = {
    id: fileId,
    sessionId,
    filename: fileId,
    originalName,
    mimeType,
    sizeBytes: buffer.length,
    uploadedAt: Date.now(),
    extractedText: extractedText.trim(),
    base64Data,
    isImage,
    pageCount,
    summary,
  };

  const currentList = sessionFiles.get(sessionId) || [];
  sessionFiles.set(sessionId, [...currentList, storedFile]);

  return storedFile;
}

export function getSessionFiles(sessionId: string): StoredFile[] {
  return sessionFiles.get(sessionId) || [];
}

export function getSessionFileById(sessionId: string, fileId: string): StoredFile | undefined {
  const list = sessionFiles.get(sessionId) || [];
  return list.find((f) => f.id === fileId);
}

export function deleteSessionFile(sessionId: string, fileId: string): boolean {
  const list = sessionFiles.get(sessionId) || [];
  const index = list.findIndex((f) => f.id === fileId);
  if (index !== -1) {
    list.splice(index, 1);
    sessionFiles.set(sessionId, list);
    return true;
  }
  return false;
}

export function clearSessionFiles(sessionId: string): void {
  sessionFiles.delete(sessionId);
}
