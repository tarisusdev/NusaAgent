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

export class OpenAIProvider implements ProviderInterface {
  id = "openai" as const;
  name = "OpenAI";
  defaultBaseUrl = "https://api.openai.com/v1";
  requiresApiKey = true;

  getCapabilities(modelId?: string): ProviderCapabilities {
    const isReasoning = (modelId || "").startsWith("o1") || (modelId || "").startsWith("o3");
    return {
      supportsStreaming: true,
      supportsToolCalling: !isReasoning,
      supportsVision: true,
      contextWindow: 128000,
      isLocal: false,
      requiresApiKey: true,
    };
  }

  async connect(config: ProviderConfig): Promise<boolean> {
    const test = await this.testConnection(config);
    return test.success;
  }

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const apiKey = config.apiKey?.trim();

    if (!apiKey) {
      return {
        status: "invalid_key",
        success: false,
        latencyMs: 0,
        message: "API key is required. Please supply your OpenAI API key.",
        testedAt: startTime,
      };
    }

    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const rawMsg = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        const status = classifyErrorStatus(errJson.error || rawMsg, res.status);
        return {
          status,
          success: false,
          latencyMs,
          message: sanitizeErrorMessage(`Authentication failed (${status}): ${rawMsg}`, apiKey),
          testedAt: Date.now(),
        };
      }

      const data = await res.json();
      const count = data.data?.length || 0;

      return {
        status: "connected",
        success: true,
        latencyMs,
        message: `Successfully connected to OpenAI (${count} models available).`,
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
    if (!apiKey) return [];
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || [])
        .filter((m: any) => m.id.includes("gpt") || m.id.startsWith("o1") || m.id.startsWith("o3"))
        .sort((a: any, b: any) => (b.created || 0) - (a.created || 0))
        .map((m: any) => ({
          id: m.id,
          name: m.id,
          description: `Owned by ${m.owned_by || "openai"}`,
          contextLength: 128000,
          supportsTools: !m.id.startsWith("o1"),
          supportsVision: true,
          isPopular: m.id === "gpt-4o" || m.id === "gpt-4o-mini",
        }));
    } catch {
      return [];
    }
  }

  private formatMessages(messages: ChatMessageParam[], systemInstruction?: string): any[] {
    const formatted: any[] = [];
    if (systemInstruction) {
      formatted.push({ role: "system", content: systemInstruction });
    }

    for (const msg of messages) {
      if (msg.role === "tool") {
        formatted.push({
          role: "tool",
          tool_call_id: msg.toolCallId || "call_default",
          content: msg.content,
        });
      } else if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        formatted.push({
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.toolCalls,
        });
      } else {
        formatted.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }
    return formatted;
  }

  async generateResponse(
    messages: ChatMessageParam[],
    config: ProviderConfig,
    options?: GenerateOptions
  ): Promise<string> {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) throw new Error("OpenAI API key is missing.");

    const model = config.customModel?.trim() || config.selectedModel || "gpt-4o-mini";
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    const body: any = {
      model,
      messages: this.formatMessages(messages, options?.systemInstruction),
    };
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(sanitizeErrorMessage(err.error?.message || `HTTP ${res.status}`, apiKey));
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || "";
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
      callbacks.onError?.("OpenAI API key is missing. Please configure it in BYOK settings.");
      return;
    }

    const model = config.customModel?.trim() || config.selectedModel || "gpt-4o-mini";
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    const body: any = {
      model,
      messages: this.formatMessages(messages, options?.systemInstruction),
      stream: true,
    };
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options?.tools && options.tools.length > 0 && !model.startsWith("o1")) {
      body.tools = options.tools.map((t) => ({
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const rawMsg = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        callbacks.onError?.(sanitizeErrorMessage(`OpenAI error: ${rawMsg}`, apiKey));
        return;
      }

      const activeToolCalls: Record<number, { id: string; name: string; args: string }> = {};

      await readSSEStream(
        res,
        (line) => {
          if (line.startsWith("data:")) {
            const dataStr = line.replace(/^data:\s*/, "");
            if (dataStr === "[DONE]") return;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) return;

              if (delta.content) {
                callbacks.onChunk(delta.content);
              }

              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index || 0;
                  if (!activeToolCalls[idx]) {
                    activeToolCalls[idx] = {
                      id: tc.id || `call_${Date.now()}`,
                      name: tc.function?.name || "",
                      args: tc.function?.arguments || "",
                    };
                  } else {
                    if (tc.function?.name) activeToolCalls[idx].name += tc.function.name;
                    if (tc.function?.arguments) activeToolCalls[idx].args += tc.function.arguments;
                  }
                }
              }
            } catch {
              // ignore malformed frame
            }
          }
        },
        signal
      );

      // Emit completed tool calls
      for (const key of Object.keys(activeToolCalls)) {
        const tc = activeToolCalls[Number(key)];
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
