import { Router, Request, Response } from "express";
import { runDirectChat } from "../agent/engine.js";
import { isApiKeyConfigured, DEFAULT_MODEL } from "../gemini.js";

const router = Router();

router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  const { message, mode = "general", history = [], fileIds = [], modelName = DEFAULT_MODEL } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty 'message' in request body." });
    return;
  }

  if (!isApiKeyConfigured()) {
    res.status(503).json({
      error: "Gemini API key is not configured on the server. Please verify GEMINI_API_KEY.",
    });
    return;
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
  });

  const emit = (type: string, data: Record<string, any>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }
  };

  try {
    emit("start", { mode });

    await runDirectChat({
      sessionId,
      message,
      modeId: mode,
      history,
      fileIds,
      modelName,
      signal: abortController.signal,
      emit,
    });
  } catch (err: any) {
    console.error("Chat streaming error:", err);
    emit("error", {
      message: err.message || "An unexpected error occurred during chat processing.",
    });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});

export default router;
