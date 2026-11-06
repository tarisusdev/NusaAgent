import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionTestResult,
  ModelInfo,
  ProviderConfig,
  ToolDefinitionParam,
} from "../../types/providers";
import { ProviderAdapter, readSSEStream, sanitizeErrorMessage } from "./base";

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  name: "Anthropic Claude",
  defaultBaseUrl: "https://api.anthropic.com/v1",
  requiresApiKey: true,
  supportsToolCalling: true,
  supportsVision: true,
  supportsStreaming: true,
  isLocal: false,

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      return { success: false, latencyMs: 0, message: "Anthropic API key is required." };
    }

    const baseUrl = (config.baseUrl?.trim() || anthropicAdapter.defaultBaseUrl).replace(/\/+$/, "");

    try {
      // Send minimal test prompt
      const res = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.selectedModel || "claude-3-5-haiku-latest",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
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

      return {
        success: true,
        latencyMs,
        message: "Successfully connected to Anthropic Claude.",
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: sanitizeErrorMessage(err, apiKey),
      };
    }
  },

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", supportsTools: true, supportsVision: true },
      { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", supportsTools: true, supportsVision: true },
      { id: "claude-3-opus-latest", name: "Claude 3 Opus", supportsTools: true, supportsVision: true },
    ];
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
      callbacks.onError?.("Anthropic API key is missing. Please configure it in BYOK settings.");
      return;
    }

    const model = config.customModel?.trim() || config.selectedModel || "claude-3-5-haiku-latest";
    const baseUrl = (config.baseUrl?.trim() || anthropicAdapter.defaultBaseUrl).replace(/\/+$/, "");

    let systemPrompt: string | undefined;
    const formattedMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt = msg.content;
      } else if (msg.role === "tool") {
        formattedMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId || "tool_call",
              content: msg.content,
            },
          ],
        });
      } else {
        formattedMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    const body: any = {
      model,
      max_tokens: 4096,
      messages: formattedMessages,
      stream: true,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    try {
      const res = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMessage = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        callbacks.onError?.(sanitizeErrorMessage(`Anthropic error: ${errMessage}`, apiKey));
        return;
      }

      let currentToolCall: { id: string; name: string; jsonAccumulator: string } | null = null;

      await readSSEStream(
        res,
        (line) => {
          if (!line.startsWith("data:")) return;
          const dataStr = line.replace(/^data:\s*/, "");
          if (dataStr === "[DONE]") return;

          try {
            const parsed = JSON.parse(dataStr);
            const type = parsed.type;

            if (type === "content_block_start") {
              if (parsed.content_block?.type === "tool_use") {
                currentToolCall = {
                  id: parsed.content_block.id,
                  name: parsed.content_block.name,
                  jsonAccumulator: "",
                };
              }
            } else if (type === "content_block_delta") {
              if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
                callbacks.onChunk(parsed.delta.text);
              } else if (parsed.delta?.type === "input_json_delta" && currentToolCall) {
                currentToolCall.jsonAccumulator += parsed.delta.partial_json || "";
              }
            } else if (type === "content_block_stop") {
              if (currentToolCall) {
                let parsedArgs = {};
                try {
                  parsedArgs = JSON.parse(currentToolCall.jsonAccumulator);
                } catch {
                  parsedArgs = { raw: currentToolCall.jsonAccumulator };
                }
                callbacks.onToolCall?.({
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: parsedArgs,
                });
                currentToolCall = null;
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
