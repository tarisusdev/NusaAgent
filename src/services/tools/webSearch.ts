import { ClientAgentTool, ClientToolResult } from "./types";

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

async function searchWikipedia(query: string, maxResults = 4): Promise<SearchResultItem[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.query?.search || []).slice(0, maxResults).map((item: any) => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
    snippet: (item.snippet || "").replace(/<[^>]+>/g, ""),
    source: "wikipedia.org",
  }));
}

export const clientWebSearchTool: ClientAgentTool = {
  name: "web_search",
  description:
    "Searches the public web for real-time information, research, and documentation. Returns titles, snippets, and citations.",
  isLocal: false,
  declaration: {
    name: "web_search",
    description: "Searches the live public web for current events, facts, articles, and citations.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords, e.g. 'latest breakthroughs in quantum computing 2026'.",
        },
        num_results: {
          type: "number",
          description: "Number of search results to return (1-8).",
        },
      },
      required: ["query"],
    },
  },
  execute: async (args: Record<string, any>): Promise<ClientToolResult> => {
    const startTime = Date.now();
    try {
      const { query, num_results = 5 } = args;
      if (!query || typeof query !== "string") {
        return {
          success: false,
          error: "Missing required 'query' parameter.",
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Try local server utility proxy first if available, fallback to direct Wikipedia API
      let results: SearchResultItem[] = [];

      try {
        const proxyRes = await fetch("/api/tools/web-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, num_results }),
        });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData.results && proxyData.results.length > 0) {
            results = proxyData.results;
          }
        }
      } catch {
        // fallback to direct browser fetch
      }

      if (results.length === 0) {
        results = await searchWikipedia(query, Math.min(num_results, 5));
      }

      return {
        success: true,
        data: {
          query,
          count: results.length,
          results,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Web search error: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
