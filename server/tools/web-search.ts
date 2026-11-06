import { AgentTool, ToolResult, Type } from "./types.js";

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// Extract real URL from DuckDuckGo redirect link
function decodeDuckDuckGoUrl(rawUrl: string): string {
  try {
    if (rawUrl.includes("duckduckgo.com/l/?uddg=")) {
      const match = rawUrl.match(/uddg=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    if (rawUrl.startsWith("//")) {
      return `https:${rawUrl}`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

// Clean HTML tags and decode entities
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchDuckDuckGo(query: string, maxResults = 5): Promise<SearchResultItem[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Search provider returned status ${response.status}`);
  }

  const html = await response.text();
  const results: SearchResultItem[] = [];

  // Parse HTML results using Regex patterns matching DuckDuckGo HTML structure
  // <a class="result__snippet" ...> or <a class="result__url" ...> and <h2 class="result__title">
  const resultBlocks = html.split(/class="result\s+results_links/);

  for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
    const block = resultBlocks[i];

    // Extract title & link
    const titleMatch = block.match(/<a[^>]*class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                       block.match(/<a[^>]*class="result__snippet"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                       block.match(/<h2[^>]*class="result__title"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

    // Extract snippet
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ||
                         block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/i);

    if (titleMatch && titleMatch[1]) {
      const rawLink = titleMatch[1];
      const targetUrl = decodeDuckDuckGoUrl(rawLink);
      const title = cleanHtml(titleMatch[2] || "Web Result");
      const snippet = snippetMatch ? cleanHtml(snippetMatch[1]) : "";

      if (targetUrl.startsWith("http") && !targetUrl.includes("duckduckgo.com")) {
        let domain = "";
        try {
          domain = new URL(targetUrl).hostname;
        } catch {
          domain = "web";
        }

        results.push({
          title,
          url: targetUrl,
          snippet: snippet || `Result from ${domain}`,
          source: domain,
        });
      }
    }
  }

  return results;
}

// Fallback search using Wikipedia API for knowledge topics
async function searchWikipedia(query: string, maxResults = 3): Promise<SearchResultItem[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&origin=*`;
  const response = await fetch(url, {
    headers: { "User-Agent": "NusaAgent/1.0" },
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const searchItems = data.query?.search || [];
  const results: SearchResultItem[] = [];

  for (const item of searchItems.slice(0, maxResults)) {
    results.push({
      title: item.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      snippet: cleanHtml(item.snippet || ""),
      source: "wikipedia.org",
    });
  }

  return results;
}

export const webSearchTool: AgentTool = {
  name: "web_search",
  description:
    "Searches the public web for real-time information, news, research papers, documentation, and live data. Returns titles, snippets, domains, and clickable source URLs for citations.",
  declaration: {
    name: "web_search",
    description:
      "Search the live web for facts, documentation, recent events, articles, and citations.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The targeted search query, e.g. 'latest breakthrough in solid state batteries 2026' or 'react 19 useActionState documentation'.",
        },
        num_results: {
          type: Type.INTEGER,
          description: "Number of search results to return (default 5, maximum 10).",
        },
      },
      required: ["query"],
    },
  },
  execute: async (args: Record<string, any>): Promise<ToolResult> => {
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

      const count = Math.min(Math.max(1, Number(num_results) || 5), 10);
      let results: SearchResultItem[] = [];

      try {
        results = await searchDuckDuckGo(query, count);
      } catch (ddgErr) {
        console.warn("DuckDuckGo search error, attempting fallback:", ddgErr);
      }

      // If results were sparse, supplement with Wikipedia
      if (results.length < 2) {
        try {
          const wikiResults = await searchWikipedia(query, count - results.length);
          results = [...results, ...wikiResults];
        } catch {
          // ignore fallback error
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          data: {
            query,
            count: 0,
            results: [],
            message: `No public web results found for query: "${query}". Try refining search terms.`,
          },
          executionTimeMs: Date.now() - startTime,
        };
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
        error: `Web search failed: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
