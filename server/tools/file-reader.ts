import { AgentTool, ToolResult, Type } from "./types.js";
import { getSessionFiles, getSessionFileById } from "../services/file-store.js";

export const fileReaderTool: AgentTool = {
  name: "file_reader",
  description:
    "Reads content and metadata from files uploaded by the user in the current session (PDF, Word DOCX, text files, code, CSV, images). Allows extracting full text or searching specific keywords.",
  declaration: {
    name: "file_reader",
    description:
      "Reads, analyzes, or extracts text from uploaded session documents (PDFs, DOCX, text files, CSV, or images).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        file_name_or_id: {
          type: Type.STRING,
          description:
            "The file name or ID to read. If omitted or 'list', returns the list of all available files in this session.",
        },
        search_query: {
          type: Type.STRING,
          description: "Optional keyword or phrase to search within the document text.",
        },
      },
    },
  },
  execute: async (args: Record<string, any>, context?: any): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const sessionId = context?.sessionId;
      if (!sessionId) {
        return {
          success: false,
          error: "Session ID context is missing.",
          executionTimeMs: Date.now() - startTime,
        };
      }

      const files = getSessionFiles(sessionId);
      const target = (args.file_name_or_id || "").trim();

      // If no target or "list" requested, return catalog of uploaded files
      if (!target || target.toLowerCase() === "list" || target.toLowerCase() === "all") {
        return {
          success: true,
          data: {
            totalFiles: files.length,
            files: files.map((f) => ({
              id: f.id,
              name: f.originalName,
              mimeType: f.mimeType,
              sizeBytes: f.sizeBytes,
              pageCount: f.pageCount,
              preview: f.summary,
            })),
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Find file by ID or case-insensitive name match
      const matchedFile = files.find(
        (f) =>
          f.id === target ||
          f.originalName.toLowerCase() === target.toLowerCase() ||
          f.originalName.toLowerCase().includes(target.toLowerCase())
      );

      if (!matchedFile) {
        return {
          success: false,
          error: `File '${target}' not found in current session. Available files: ${
            files.map((f) => f.originalName).join(", ") || "None"
          }`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check search query
      const searchQuery = (args.search_query || "").trim().toLowerCase();
      let content = matchedFile.extractedText || "";

      if (searchQuery) {
        // Extract passages matching search query
        const lines = content.split("\n");
        const matchingLines = lines.filter((l) => l.toLowerCase().includes(searchQuery));

        return {
          success: true,
          data: {
            fileName: matchedFile.originalName,
            fileId: matchedFile.id,
            mimeType: matchedFile.mimeType,
            searchQuery,
            matchesFound: matchingLines.length,
            snippets: matchingLines.slice(0, 10),
            pageCount: matchedFile.pageCount,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Truncate if gigantic to avoid exceeding context window (e.g. 20,000 characters)
      const isTruncated = content.length > 20000;
      if (isTruncated) {
        content = content.slice(0, 20000) + "\n\n... [File content truncated for context limit]";
      }

      return {
        success: true,
        data: {
          fileName: matchedFile.originalName,
          fileId: matchedFile.id,
          mimeType: matchedFile.mimeType,
          isImage: matchedFile.isImage,
          sizeBytes: matchedFile.sizeBytes,
          pageCount: matchedFile.pageCount,
          contentLength: content.length,
          isTruncated,
          content,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `File reader error: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
