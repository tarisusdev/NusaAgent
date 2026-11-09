import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionStatus,
  ConnectionTestResult,
  GenerateOptions,
  ModelInfo,
  ProviderCapabilities,
  ProviderConfig,
  ProviderId,
  ProviderInterface,
  ToolDefinitionParam,
} from "../types/providers";

/**
 * Sanitize error messages so raw API keys are never leaked to logs or the UI.
 */
export function sanitizeErrorMessage(error: any, apiKey?: string): string {
  let message =
    typeof error === "string"
      ? error
      : error?.message || (error ? JSON.stringify(error) : "An unexpected error occurred.");

  if (apiKey && apiKey.length > 5) {
    message = message.split(apiKey).join("[REDACTED_API_KEY]");
  }

  // Common CORS and browser network hints
  if (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Load failed")
  ) {
    return `${message}. (Note: This is often caused by browser CORS restrictions or an unreachable local endpoint. Check CORS headers or proxy settings).`;
  }

  return message;
}

/**
 * Classify HTTP response code or error string into standard ConnectionStatus
 */
export function classifyErrorStatus(err: any, httpStatus?: number): ConnectionStatus {
  if (httpStatus === 401 || httpStatus === 403) {
    return "invalid_key";
  }
  if (httpStatus === 429) {
    return "quota_exceeded";
  }
  if (httpStatus === 404) {
    return "unsupported_endpoint";
  }
  if (httpStatus && httpStatus >= 500) {
    return "unavailable";
  }

  const msg = (typeof err === "string" ? err : err?.message || "").toLowerCase();

  if (
    msg.includes("invalid api key") ||
    msg.includes("unauthorized") ||
    msg.includes("authentication") ||
    msg.includes("invalid_api_key") ||
    msg.includes("permission denied")
  ) {
    return "invalid_key";
  }

  if (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("insufficient_quota") ||
    msg.includes("credit") ||
    msg.includes("billing")
  ) {
    return "quota_exceeded";
  }

  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("connection refused") ||
    msg.includes("cors") ||
    msg.includes("err_connection_refused")
  ) {
    return "network_error";
  }

  if (msg.includes("not found") || msg.includes("cannot post") || msg.includes("cannot get")) {
    return "unsupported_endpoint";
  }

  return "network_error";
}

/**
 * Process standard Server-Sent Events (SSE) data streams.
 */
export async function readSSEStream(
  response: Response,
  onLine: (line: string) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.body) {
    throw new Error("Response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          onLine(trimmed);
        }
      }
    }

    if (buffer.trim()) {
      onLine(buffer.trim());
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Process line-delimited JSON streams (e.g. Ollama streaming)
 */
export async function readNDJsonStream(
  response: Response,
  onJson: (json: any) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.body) {
    throw new Error("Response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            onJson(parsed);
          } catch {
            // ignore partial or non-json chunks
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        onJson(parsed);
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock();
  }
}
