import { Router, Request, Response } from "express";
import { runAutonomousAgent } from "../agent/engine.js";
import { activeAgentTasks } from "../middleware/security.js";
import { isApiKeyConfigured, DEFAULT_MODEL } from "../gemini.js";

const router = Router();

// POST /api/agent/run
router.post("/agent/run", async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.headers["x-session-id"] as string;
  const { objective, mode = "general", fileIds = [], modelName = DEFAULT_MODEL } = req.body;

  if (!objective || typeof objective !== "string" || objective.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty 'objective' in request body." });
    return;
  }

  if (!isApiKeyConfigured()) {
    res.status(503).json({
      error: "Gemini API key is not configured on the server. Please verify GEMINI_API_KEY.",
    });
    return;
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const abortController = new AbortController();

  // Register task for stop/cancel capability
  activeAgentTasks.set(taskId, abortController);
  activeAgentTasks.set(sessionId, abortController);

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  req.on("close", () => {
    abortController.abort();
    activeAgentTasks.delete(taskId);
    activeAgentTasks.delete(sessionId);
  });

  const emit = (type: string, data: Record<string, any>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type, taskId, ...data })}\n\n`);
    }
  };

  try {
    await runAutonomousAgent({
      sessionId,
      taskId,
      objective,
      modeId: mode,
      fileIds,
      modelName,
      signal: abortController.signal,
      emit,
    });
  } catch (err: any) {
    console.error("Agent execution error:", err);
    emit("agent_error", {
      taskId,
      message: err.message || "An unexpected error occurred during autonomous execution.",
    });
  } finally {
    activeAgentTasks.delete(taskId);
    activeAgentTasks.delete(sessionId);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// POST /api/agent/stop
router.post("/agent/stop", (req: Request, res: Response): void => {
  const sessionId = req.headers["x-session-id"] as string;
  const { taskId } = req.body || {};

  let aborted = false;

  if (taskId && activeAgentTasks.has(taskId)) {
    const controller = activeAgentTasks.get(taskId);
    controller?.abort();
    activeAgentTasks.delete(taskId);
    aborted = true;
  }

  if (activeAgentTasks.has(sessionId)) {
    const controller = activeAgentTasks.get(sessionId);
    controller?.abort();
    activeAgentTasks.delete(sessionId);
    aborted = true;
  }

  res.json({
    success: true,
    stopped: aborted,
    message: aborted ? "Agent execution cancelled." : "No active execution found for this task/session.",
  });
});

export default router;
