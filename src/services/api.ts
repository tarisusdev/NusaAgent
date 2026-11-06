import { getOrCreateSessionId } from "./storage";
import { AttachedFile, Message } from "../types";

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  geminiConfigured: boolean;
  defaultModel: string;
  tools: Array<{ name: string; description: string }>;
  modes: Array<{ id: string; name: string; badge: string; description: string; tools: string[] }>;
}

export async function checkServerHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) {
    throw new Error(`Server health check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadSessionFiles(files: File[]): Promise<AttachedFile[]> {
  const sessionId = getOrCreateSessionId();
  const formData = new FormData();
  for (const f of files) {
    formData.append("files", f);
  }

  const res = await fetch("/api/files/upload", {
    method: "POST",
    headers: {
      "x-session-id": sessionId,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function deleteSessionFile(fileId: string): Promise<void> {
  const sessionId = getOrCreateSessionId();
  const res = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: {
      "x-session-id": sessionId,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete file");
  }
}

export async function stopActiveAgent(taskId?: string): Promise<boolean> {
  const sessionId = getOrCreateSessionId();
  const res = await fetch("/api/agent/stop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId,
    },
    body: JSON.stringify({ taskId }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  return data.stopped;
}

// Stream Chat response
export async function streamChat(params: {
  message: string;
  mode: string;
  history: Array<{ role: "user" | "model" | "assistant"; content: string }>;
  fileIds?: string[];
  modelName?: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onToolCall?: (toolCall: any) => void;
  onToolResult?: (toolResult: any) => void;
  onError: (error: string) => void;
  onDone: () => void;
}): Promise<void> {
  const sessionId = getOrCreateSessionId();
  const { message, mode, history, fileIds, modelName, signal, onChunk, onToolCall, onToolResult, onError, onDone } =
    params;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({
        message,
        mode,
        history,
        fileIds,
        modelName,
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      onError(err.error || `HTTP error ${response.status}`);
      return;
    }

    if (!response.body) {
      onError("No response body received from server");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === "chunk" && data.text) {
              onChunk(data.text);
            } else if (data.type === "tool_call" && onToolCall) {
              onToolCall(data);
            } else if (data.type === "tool_result" && onToolResult) {
              onToolResult(data);
            } else if (data.type === "error") {
              onError(data.message || "An error occurred");
            }
          } catch (e) {
            console.warn("Failed to parse SSE line:", trimmed);
          }
        }
      }
    }

    onDone();
  } catch (err: any) {
    if (signal?.aborted) {
      onDone();
      return;
    }
    onError(err.message || "Network request failed");
  }
}

// Stream Autonomous Agent Execution
export async function streamAgentExecution(params: {
  objective: string;
  mode: string;
  fileIds?: string[];
  modelName?: string;
  signal?: AbortSignal;
  onEvent: (type: string, data: any) => void;
  onError: (error: string) => void;
  onDone: () => void;
}): Promise<void> {
  const sessionId = getOrCreateSessionId();
  const { objective, mode, fileIds, modelName, signal, onEvent, onError, onDone } = params;

  try {
    const response = await fetch("/api/agent/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({
        objective,
        mode,
        fileIds,
        modelName,
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      onError(err.error || `Agent execution error ${response.status}`);
      return;
    }

    if (!response.body) {
      onError("No response body received from agent server");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            onEvent(data.type, data);

            if (data.type === "agent_error") {
              onError(data.message || "Agent execution failed");
            }
          } catch (e) {
            console.warn("Failed to parse agent SSE:", trimmed);
          }
        }
      }
    }

    onDone();
  } catch (err: any) {
    if (signal?.aborted) {
      onDone();
      return;
    }
    onError(err.message || "Network request failed");
  }
}
