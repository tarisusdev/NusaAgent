import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionTestResult,
  ModelInfo,
  ProviderConfig,
  ToolDefinitionParam,
} from "../../types/providers";

export interface ProviderAdapter {
  id: string;
  name: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  isLocal: boolean;

  testConnection(config: ProviderConfig): Promise<ConnectionTestResult>;
  listModels?(config: ProviderConfig): Promise<ModelInfo[]>;
  chatStream(
    messages: ChatMessageParam[],
    tools: ToolDefinitionParam[],
    config: ProviderConfig,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void>;
}

/**
 * Sanitize error message to ensure API keys are never exposed in logs or UI.
 */
export function sanitizeErrorMessage(error: any, apiKey?: string): string {
  let message = typeof error === "string" ? error : error?.message || "An unexpected error occurred.";

  if (apiKey && apiKey.length > 5) {
    message = message.split(apiKey).join("[REDACTED_API_KEY]");
  }

  // Detect common CORS failures
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return `${message}. Note: Some local or restrictive providers require enabling CORS or configuring appropriate headers.`;
  }

  return message;
}

/**
 * Process SSE stream lines from a Fetch Response Reader.
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
