import { AgentTool, ToolResult, Type } from "./types.js";

// Check if an IP address or hostname is a private/internal network address
function isPrivateOrInternalAddress(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Common internal hostnames and domains
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".lan") ||
    lower.endsWith(".corp") ||
    lower.includes("metadata.google.internal") ||
    lower === "metadata" ||
    lower === "instance-data"
  ) {
    return true;
  }

  // Check IPv4 patterns
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
      parseInt(ipv4Match[3], 10),
      parseInt(ipv4Match[4], 10),
    ];

    // Check octet range validity
    if (octets.some((o) => o < 0 || o > 255)) return true;

    // 127.0.0.0/8 (loopback)
    if (octets[0] === 127) return true;
    // 0.0.0.0/8
    if (octets[0] === 0) return true;
    // 10.0.0.0/8 (private)
    if (octets[0] === 10) return true;
    // 172.16.0.0/12 (private 172.16 - 172.31)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16 (private)
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 169.254.0.0/16 (link local, cloud metadata API)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 100.64.0.0/10 (carrier-grade NAT)
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
  }

  // Check IPv6 loopback / unique local / link local
  if (
    lower === "::1" ||
    lower === "[::1]" ||
    lower.startsWith("fe80:") ||
    lower.startsWith("fc00:") ||
    lower.startsWith("fd00:")
  ) {
    return true;
  }

  return false;
}

// Convert HTML into clean readable text/markdown
function extractReadableTextFromHtml(html: string): { title: string; content: string; description?: string } {
  // Extract Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "No Title";

  // Extract Meta description
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const description = metaMatch ? metaMatch[1].trim() : undefined;

  // Remove scripts, styles, svgs, comments, noscript, and nav/footers if possible
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");

  // Target main content container if present
  const mainMatch = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
                    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
                    cleaned.match(/<div\b[^>]*class=["'][^"']*(?:content|article|post|documentation|entry)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  const targetHtml = mainMatch ? mainMatch[1] : cleaned;

  // Transform headers into markdown
  let markdown = targetHtml
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Limit content to 12,000 characters to fit agent context cleanly
  if (markdown.length > 12000) {
    markdown = markdown.slice(0, 12000) + "\n\n... [Content truncated for length]";
  }

  return { title, content: markdown, description };
}

export const webFetchTool: AgentTool = {
  name: "web_fetch",
  description:
    "Safely retrieves and extracts readable content from a public web page URL. Includes SSRF protection, strips ads/scripts, and formats the output into clean structured text.",
  declaration: {
    name: "web_fetch",
    description:
      "Fetches and reads content from a public website URL, extracting main text and articles.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The full public HTTP or HTTPS URL to read (e.g. 'https://docs.github.com/en/get-started').",
        },
      },
      required: ["url"],
    },
  },
  execute: async (args: Record<string, any>): Promise<ToolResult> => {
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

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return {
          success: false,
          error: `Invalid URL format: "${url}". Must include http:// or https://.`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Security validation: protocol
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return {
          success: false,
          error: `Disallowed URL protocol '${parsedUrl.protocol}'. Only http: and https: are allowed.`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // SSRF check: private network/localhost protection
      if (isPrivateOrInternalAddress(parsedUrl.hostname)) {
        return {
          success: false,
          error: `Access denied: Target host '${parsedUrl.hostname}' is a private or internal network address.`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch with timeout
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (NusaAgent Bot)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP request failed with status code ${response.status} (${response.statusText})`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();

      if (contentType.includes("application/json")) {
        try {
          const parsed = JSON.parse(text);
          return {
            success: true,
            data: {
              url: parsedUrl.toString(),
              contentType: "application/json",
              content: JSON.stringify(parsed, null, 2).slice(0, 10000),
            },
            executionTimeMs: Date.now() - startTime,
          };
        } catch {
          // fall through
        }
      }

      const { title, content, description } = extractReadableTextFromHtml(text);

      return {
        success: true,
        data: {
          url: parsedUrl.toString(),
          title,
          description,
          length: content.length,
          content,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to fetch URL: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
