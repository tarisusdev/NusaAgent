import { Router, Request, Response } from "express";
import { getAllTools } from "../tools/registry.js";
import { AGENT_MODES } from "../agent/modes.js";

const router = Router();

router.get("/health", (req: Request, res: Response) => {
  const tools = getAllTools().map((t) => ({
    name: t.name,
    description: t.description,
  }));

  const modes = Object.values(AGENT_MODES).map((m) => ({
    id: m.id,
    name: m.name,
    badge: m.badge,
    description: m.description,
    tools: m.allowedTools,
  }));

  const supportedProviders = [
    "Google Gemini",
    "OpenAI",
    "Anthropic Claude",
    "OpenRouter",
    "Groq",
    "Mistral AI",
    "Ollama (Local)",
    "LM Studio (Local)",
  ];

  res.json({
    status: "ok",
    app: "NusaAgent",
    version: "2.0.0",
    architecture: "BYOK (Bring Your Own Key)",
    loginFree: true,
    supportedProviders,
    tools,
    modes,
    serverTimestamp: new Date().toISOString(),
  });
});

export default router;
