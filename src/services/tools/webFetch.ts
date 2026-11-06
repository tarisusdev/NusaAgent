import { ClientAgentTool, ClientToolResult } from "./types";

function isPrivateOrInternal(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.includes("metadata.google.internal")
  ) {
    return true;
  }
  const ipv4 = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [_, a, b] = ipv4.map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // cloud metadata
  }
  return false;
}

export const clientWebFetchTool: ClientAgentTool = {
  name: "web_fetch",
  description:
    "Safely retrieves and reads readable content from a public web page with SSRF protection.",
  isLocal: false,
  declaration: {
    name: "web_fetch",
    description: "Fetches and extracts readable text and article content from a public website URL.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Full HTTP or HTTPS URL to read (e.g. 'https://docs.github.com/en').",
        },
      },
      required: ["url"],
    },
  },
  execute: async (args: Record<string, any>): Promise<ClientToolResult> => {
    const startTime = Date.now();
    try {
      const { url } = args;
      if (!url || typeof url !== "string") {
        return {
          success: false,
          error: "Missing required 'url' parameter.",
          executionTimeMs: Date.now() - startTime,
        };
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return {
          success: false,
          error: `Invalid URL format: "${url}". Must include http:// or https://.`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          success: false,
          error: `Disallowed protocol '${parsed.protocol}'. Only http: and https: are allowed.`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (isPrivateOrInternal(parsed.hostname)) {
        return {
          success: false,
          error: `SSRF Security Block: Hostname '${parsed.hostname}' is a private or internal address.`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Delegate to SSRF-protected utility endpoint
      const res = await fetch("/api/tools/web-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsed.toString() }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      return {
        success: true,
        data,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Web fetch error: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
