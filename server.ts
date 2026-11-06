import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

import { securityAndSessionMiddleware } from "./server/middleware/security.js";
import healthRouter from "./server/routes/health.js";
import chatRouter from "./server/routes/chat.js";
import agentRouter from "./server/routes/agent.js";
import filesRouter from "./server/routes/files.js";
import toolsRouter from "./server/routes/tools.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing with generous limit for file metadata and text payloads
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Basic security headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  // Public health check route (no session header required)
  app.use("/api", healthRouter);

  // Apply session verification and rate limiting to all interactive API routes
  app.use("/api", securityAndSessionMiddleware);

  // Mount API routers
  app.use("/api", chatRouter);
  app.use("/api", agentRouter);
  app.use("/api", filesRouter);
  app.use("/api", toolsRouter);

  // Error handling middleware
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error("Unhandled server error:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: err.message || "An internal server error occurred.",
      });
    }
  });

  // Setup Vite dev server or production static serving
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        port: PORT,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
    console.log(`[NusaAgent] Vite dev middleware attached in development mode.`);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
    console.log(`[NusaAgent] Serving static assets from ${distPath}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[NusaAgent] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
