import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limiting map per session
const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_REQUESTS_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Maximum payload limits
export const MAX_INPUT_LENGTH = 50000; // characters
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
export const AGENT_TIMEOUT_MS = 120 * 1000; // 2 minutes

// Active execution controllers for cancellation
export const activeAgentTasks = new Map<string, AbortController>();

export function securityAndSessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract or validate anonymous session ID
  const sessionId = (req.headers["x-session-id"] as string) || (req.query.sessionId as string);

  if (!sessionId || typeof sessionId !== "string" || sessionId.length < 8) {
    res.status(400).json({
      error: "Missing or invalid x-session-id header. NusaAgent requires an anonymous session identifier.",
    });
    return;
  }

  // Rate limiting check
  const now = Date.now();
  let entry = rateLimitMap.get(sessionId);

  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(sessionId, entry);
  } else {
    entry.count += 1;
    if (entry.count > MAX_REQUESTS_PER_MINUTE) {
      const waitSeconds = Math.ceil((entry.resetTime - now) / 1000);
      res.status(429).json({
        error: `Rate limit exceeded. Please wait ${waitSeconds}s before making more requests.`,
        retryAfter: waitSeconds,
      });
      return;
    }
  }

  // Input length validation for POST bodies
  if (req.method === "POST" && req.body && typeof req.body.message === "string") {
    if (req.body.message.length > MAX_INPUT_LENGTH) {
      res.status(400).json({
        error: `Message exceeds maximum allowed length of ${MAX_INPUT_LENGTH} characters.`,
      });
      return;
    }
  }

  // Attach clean session ID
  req.headers["x-session-id"] = sessionId;
  next();
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime + RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(id);
    }
  }
}, 5 * 60 * 1000);
