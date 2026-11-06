import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionTestResult,
  ModelInfo,
  ProviderConfig,
  ToolDefinitionParam,
} from "../../types/providers";
import { ProviderAdapter, readSSEStream, sanitizeErrorMessage } from "./base";

export const openrouterAdapter: ProviderAdapter = {
  id: "openrouter",
  name: "OpenRouter",
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  requiresApiKey: true,
  supportsToolCalling: true,
  supportsVision: true,
  supportsStreaming: true,
  isLocal: false,

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      return { success: false, latencyMs: 0, message: "OpenRouter API key is required." };
    }

    const baseUrl = (config.baseUrl?.trim() || openrouterAdapter.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "NusaAgent",
        },
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        return {
          success: false,
          latencyMs,
          message: sanitizeErrorMessage(`Authentication failed: ${msg}`, apiKey),
        };
      }

      const data = await res.json();
      const count = data.data?.length || 0;

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to OpenRouter (${count} models available).`,
        modelsFound: count,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: sanitizeErrorMessage(err, apiKey),
      };
    }
  },

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const apiKey = config.apiKey?.trim();
    const baseUrl = (config.baseUrl?.trim() || openrouterAdapter.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const headers: Record<string, string> = {
        "HTTP-Referer": window.location.origin,
        "X-Title": "NusaAgent",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const res = await fetch(`${baseUrl}/models`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).slice(0, 50).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        description: m.description,
        contextLength: m.context_length,
        supportsTools: true,
        supportsVision: Boolean(m.architecture?.modality?.includes("image")),
      }));
    } catch {
      return [];
    }
  },

  async chatStream(
    messages: ChatMessageParam[],
    tools: ToolDefinitionParam[],
    config: ProviderConfig,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      callbacks.onError?.("OpenRouter API key is missing. Please configure it in BYOK settings.");
      return;
    }

    const model = config.customModel?.trim() || config.selectedModel || "anthropic/claude-3.5-sonnet";
    const baseUrl = (config.baseUrl?.trim() || openrouterAdapter.defaultBaseUrl).replace(/\/+$/, "");

    const formattedMessages = messages.map((m) => {
      const msgObj: any = { role: m.role, content: m.content };
      if (m.name) msgObj.name = m.name;
      if (m.toolCallId) msgObj.tool_call_id = m.toolCallId;
      if (m.toolCalls) msgObj.tool_calls = m.toolCalls;
      return msgObj;
    });

    const body: any = {
      model,
      messages: formattedMessages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "NusaAgent",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMessage = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        callbacks.onError?.(sanitizeErrorMessage(`OpenRouter error: ${errMessage}`, apiKey));
        return;
      }

      const toolCallAccumulators: Record<number, { id: string; name: string; args: string }> = {};

      await readSSEStream(
        res,
        (line) => {
          if (!line.startsWith("data:")) return;
          const dataStr = line.replace(/^data:\s*/, "");
          if (dataStr === "[DONE]") {
            for (const key of Object.keys(toolCallAccumulators)) {
              const tc = toolCallAccumulators[Number(key)];
              if (tc && tc.name) {
                let parsedArgs = {};
                try {
                  parsedArgs = JSON.parse(tc.args);
                } catch {
                  parsedArgs = { raw: tc.args };
                }
                callbacks.onToolCall?.({
                  id: tc.id,
                  name: tc.name,
                  arguments: parsedArgs,
                });
              }
            }
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.content) {
              callbacks.onChunk(delta.content);
            }

            if (delta?.tool_calls) {
              for (const tcDelta of delta.tool_calls) {
                const index = tcDelta.index ?? 0;
                if (!toolCallAccumulators[index]) {
                  toolCallAccumulators[index] = {
                    id: tcDelta.id || `call_${Date.now()}`,
                    name: tcDelta.function?.name || "",
                    args: tcDelta.function?.arguments || "",
                  };
                } else {
                  if (tcDelta.function?.name) {
                    toolCallAccumulators[index].name += tcDelta.function.name;
                  }
                  if (tcDelta.function?.arguments) {
                    toolCallAccumulators[index].args += tcDelta.function.arguments;
                  }
                }
              }
            }
          } catch {
            // ignore malformed SSE
          }
        },
        signal
      );

      callbacks.onDone?.();
    } catch (err: any) {
      if (signal?.aborted) {
        callbacks.onDone?.();
        return;
      }
      callbacks.onError?.(sanitizeErrorMessage(err, apiKey));
    }
  },
};
