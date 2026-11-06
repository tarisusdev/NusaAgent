import { ClientAgentTool, ClientToolResult } from "./types";
import { AttachedFile } from "../../types";

export const clientFileReaderTool: ClientAgentTool = {
  name: "file_reader",
  description:
    "Reads and searches text from user-uploaded session files (PDF, DOCX, TXT, CSV, JSON, code, or images).",
  isLocal: true,
  declaration: {
    name: "file_reader",
    description: "Extracts text or inspects metadata from uploaded files in the current conversation.",
    parameters: {
      type: "object",
      properties: {
        file_name_or_id: {
          type: "string",
          description: "Name or ID of the file to inspect. Use 'list' to catalog all files.",
        },
        search_query: {
          type: "string",
          description: "Optional search query to locate specific sections inside the file.",
        },
      },
    },
  },
  execute: async (args: Record<string, any>, context?: { files?: AttachedFile[] }): Promise<ClientToolResult> => {
    const startTime = Date.now();
    try {
      const files = context?.files || [];
      const target = (args.file_name_or_id || "").trim();

      if (!target || target.toLowerCase() === "list" || target.toLowerCase() === "all") {
        return {
          success: true,
          data: {
            totalFiles: files.length,
            files: files.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              sizeBytes: f.size,
              summary: f.summary || "Attached file",
            })),
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      const match = files.find(
        (f) =>
          f.id === target ||
          f.name.toLowerCase() === target.toLowerCase() ||
          f.name.toLowerCase().includes(target.toLowerCase())
      );

      if (!match) {
        return {
          success: false,
          error: `File '${target}' not found. Available files: ${
            files.map((f) => f.name).join(", ") || "None attached"
          }`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      const content = match.summary || `[File ${match.name}, ${match.mimeType}, ${(match.size / 1024).toFixed(1)} KB]`;
      const searchQuery = (args.search_query || "").trim().toLowerCase();

      if (searchQuery) {
        const lines = content.split("\n").filter((l) => l.toLowerCase().includes(searchQuery));
        return {
          success: true,
          data: {
            fileName: match.name,
            searchQuery,
            matches: lines.slice(0, 10),
            totalMatches: lines.length,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      return {
        success: true,
        data: {
          fileName: match.name,
          mimeType: match.mimeType,
          sizeBytes: match.size,
          content: content.slice(0, 15000),
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
