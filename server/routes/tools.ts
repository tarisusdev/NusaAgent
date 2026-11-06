import { Router, Request, Response } from "express";
import { webSearchTool } from "../tools/web-search.js";
import { webFetchTool } from "../tools/web-fetch.js";

const router = Router();

// POST /api/tools/web-search (Pure utility for browser tool execution, no AI keys needed)
router.post("/tools/web-search", async (req: Request, res: Response): Promise<void> => {
  const { query, num_results = 5 } = req.body || {};
  if (!query || typeof query !== "string") {
    res.status(400).json({ error: "Missing required 'query' parameter." });
    return;
  }

  const result = await webSearchTool.execute({ query, num_results });
  if (!result.success) {
    res.status(500).json({ error: result.error || "Search failed" });
    return;
  }

  res.json(result.data || {});
});

// POST /api/tools/web-fetch (SSRF-protected web fetcher utility, no AI keys needed)
router.post("/tools/web-fetch", async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing required 'url' parameter." });
    return;
  }

  const result = await webFetchTool.execute({ url });
  if (!result.success) {
    res.status(400).json({ error: result.error || "Fetch failed" });
    return;
  }

  res.json(result.data || {});
});

export default router;
