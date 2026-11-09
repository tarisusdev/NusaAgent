import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionTestResult,
  GenerateOptions,
  ModelInfo,
  ProviderCapabilities,
  ProviderConfig,
  ProviderInterface,
} from "../types/providers";
import { classifyErrorStatus, readSSEStream, sanitizeErrorMessage } from "./base";

export class AnthropicProvider implements ProviderInterface {
  id = "anthropic" as const;
  name = "Anthropic Claude";
  defaultBaseUrl = "https://api.anthropic.com/v1";
  requiresApiKey = true;

  getCapabilities(modelId?: string): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsVision: true,
      contextWindow: 200000,
      isLocal: false,
      requiresApiKey: true,
    };
  }

  async connect(config: ProviderConfig): Promise<boolean> {
    const test = await this.testConnection(config);
    return test.success;
  }

  private getHeaders(apiKey: string): Record<string, string> {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    };
  }

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const apiKey = config.apiKey?.trim();

    if (!apiKey) {
      return {
        status: "invalid_key",
        success: false,
        latencyMs: 0,
        message: "API key is required. Please supply your Anthropic API key.",
        testedAt: startTime,
      };
    }

    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    try {
      // First attempt /v1/models
      const res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(apiKey),
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        // Fallback to minimal 1-token message test
        const msgRes = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: this.getHeaders(apiKey),
          body: JSON.stringify({
            model: config.selectedModel || "claude-3-5-haiku-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }],
          }),
        });

        const msgLatency = Date.now() - startTime;
        if (!msgRes.ok) {
          const errJson = await msgRes.json().catch(() => ({}));
          const rawMsg = errJson.error?.message || `HTTP ${msgRes.status} ${msgRes.statusText}`;
          const status = classifyErrorStatus(errJson.error || rawMsg, msgRes.status);
          return {
            status,
            success: false,
            latencyMs: msgLatency,
            message: sanitizeErrorMessage(`Authentication failed (${status}): ${rawMsg}`, apiKey),
            testedAt: Date.now(),
          };
        }

        return {
          status: "connected",
          success: true,
          latencyMs: msgLatency,
          message: "Successfully connected to Anthropic Claude.",
          testedAt: Date.now(),
        };
      }

      const data = await res.json();
      const count = data.data?.length || 0;

      return {
        status: "connected",
        success: true,
        latencyMs,
        message: `Successfully connected to Anthropic Claude (${count} models found).`,
        modelsFound: count,
        testedAt: Date.now(),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const status = classifyErrorStatus(err);
      return {
        status,
        success: false,
        latencyMs,
        message: sanitizeErrorMessage(err, apiKey),
        testedAt: Date.now(),
      };
    }
  }

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) return this.getDefaultModels();
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: this.getHeaders(apiKey),
      });
      if (!res.ok) return this.getDefaultModels();
      const data = await res.json();
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.display_name || m.id,
        description: `Created: ${m.created_at || "Anthropic"}`,
        contextLength: 200000,
        supportsTools: true,
        supportsVision: true,
        isPopular: m.id.includes("3-5-sonnet") || m.id.includes("3-5-haiku"),
      }));
    } catch {
      return this.getDefaultModels();
    }
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet (Hybrid Reasoning)",
        description: "Anthropic's smartest model with hybrid instant & thinking mode.",
        contextLength: 200000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet (v2)",
        description: "State-of-the-art coding, reasoning, and multimodal performance.",
        contextLength: 200000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        description: "Ultra-fast, high-intelligence model for rapid execution.",
        contextLength: 200000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
    ];
  }

  private formatMessages(
    messages: ChatMessageParam[],
    systemInstruction?: string
  ): { system?: string; formattedMessages: any[] } {
    let system = systemInstruction;
    const formattedMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = (system ? `${system}\n\n` : "") + msg.content;
      } else if (msg.role === "tool") {
        formattedMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId || "call_default",
              content: msg.content,
            },
          ],
        });
      } else if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        const contentParts: any[] = [];
        if (msg.content) {
          contentParts.push({ type: "text", text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = { raw: tc.function.arguments };
          }
          contentParts.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: parsedArgs,
          });
        }
        formattedMessages.push({ role: "assistant", content: contentParts });
      } else {
        formattedMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    // Ensure alternating user/assistant turns if required
    return { system, formattedMessages };
  }

  async generateResponse(
    messages: ChatMessageParam[],
    config: ProviderConfig,
    options?: GenerateOptions
  ): Promise<string> {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) throw new Error("Anthropic API key is missing.");

    const model = config.customModel?.trim() || config.selectedModel || "claude-3-5-haiku-20241022";
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    const { system, formattedMessages } = this.formatMessages(messages, options?.systemInstruction);

    const body: any = {
      model,
      max_tokens: options?.maxTokens || 4096,
      messages: formattedMessages,
    };
    if (system) body.system = system;
    if (options?.temperature !== undefined) body.temperature = options.temperature;

    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: this.getHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(sanitizeErrorMessage(err.error?.message || `HTTP ${res.status}`, apiKey));
    }

    const json = await res.json();
    const textBlocks = (json.content || []).filter((c: any) => c.type === "text");
    return textBlocks.map((c: any) => c.text).join("");
  }

  async streamResponse(
    messages: ChatMessageParam[],
    config: ProviderConfig,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
    options?: GenerateOptions
  ): Promise<void> {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      callbacks.onError?.("Anthropic API key is missing. Please configure it in BYOK settings.");
      return;
    }

    const model = config.customModel?.trim() || config.selectedModel || "claude-3-5-haiku-20241022";
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    const { system, formattedMessages } = this.formatMessages(messages, options?.systemInstruction);

    const body: any = {
      model,
      max_tokens: options?.maxTokens || 4096,
      messages: formattedMessages,
      stream: true,
    };
    if (system) body.system = system;
    if (options?.temperature !== undefined) body.temperature = options.temperature;

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    try {
      const res = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const rawMsg = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        callbacks.onError?.(sanitizeErrorMessage(`Anthropic error: ${rawMsg}`, apiKey));
        return;
      }

      let currentToolCall: { id: string; name: string; partialJson: string } | null = null;

      await readSSEStream(
        res,
        (line) => {
          if (line.startsWith("data:")) {
            const dataStr = line.replace(/^data:\s*/, "");
            if (dataStr === "[DONE]") return;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === "content_block_start") {
                if (event.content_block?.type === "tool_use") {
                  currentToolCall = {
                    id: event.content_block.id || `call_${Date.now()}`,
                    name: event.content_block.name || "",
                    partialJson: "",
                  };
                }
              } else if (event.type === "content_block_delta") {
                if (event.delta?.type === "text_delta" && event.delta.text) {
                  callbacks.onChunk(event.delta.text);
                } else if (
                  event.delta?.type === "input_json_delta" &&
                  event.delta.partial_json &&
                  currentToolCall
                ) {
                  currentToolCall.partialJson += event.delta.partial_json;
                }
              } else if (event.type === "content_block_stop") {
                if (currentToolCall) {
                  let parsedArgs = {};
                  try {
                    parsedArgs = JSON.parse(currentToolCall.partialJson || "{}");
                  } catch {
                    parsedArgs = { raw: currentToolCall.partialJson };
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
              // ignore
            }
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
  }
}
