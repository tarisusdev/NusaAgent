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

export class GeminiProvider implements ProviderInterface {
  id = "gemini" as const;
  name = "Google Gemini";
  defaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
  requiresApiKey = true;

  getCapabilities(modelId?: string): ProviderCapabilities {
    const isPro = (modelId || "").includes("pro");
    return {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsVision: true,
      contextWindow: isPro ? 2000000 : 1000000,
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
        message: "API key is required. Please provide a valid Google Gemini API key.",
        testedAt: startTime,
      };
    }

    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/models?pageSize=10`, {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
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
      const count = data.models?.length || 0;

      return {
        status: "connected",
        success: true,
        latencyMs,
        message: `Successfully connected to Google Gemini (${count} models available).`,
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
      const res = await fetch(`${baseUrl}/models?pageSize=50`, {
        headers: { "x-goog-api-key": apiKey },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => {
          const id = m.name.replace(/^models\//, "");
          return {
            id,
            name: m.displayName || id,
            description: m.description,
            contextLength: m.inputTokenLimit || 1000000,
            supportsTools: true,
            supportsVision: true,
            isPopular: id.includes("flash") || id.includes("pro"),
          };
        });
    } catch {
      return [];
    }
  }

  private formatContents(messages: ChatMessageParam[]): { contents: any[]; systemInstruction?: any } {
    let systemInstruction: string | undefined;
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = msg.content;
      } else if (msg.role === "tool") {
        let toolResponseObj: any = { content: msg.content };
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed && typeof parsed === "object") {
            toolResponseObj = parsed;
          }
        } catch {
          toolResponseObj = { content: msg.content };
        }
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: msg.name || "tool",
                response: toolResponseObj,
              },
            },
          ],
        });
      } else if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        const parts: any[] = [];
        if (msg.content) parts.push({ text: msg.content });
        for (const tc of msg.toolCalls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = { raw: tc.function.arguments };
          }
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: parsedArgs,
            },
          });
        }
        contents.push({ role: "model", parts });
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    return {
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    };
  }

  async generateResponse(
    messages: ChatMessageParam[],
    config: ProviderConfig,
    options?: GenerateOptions
  ): Promise<string> {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      throw new Error("Google Gemini API key is missing.");
    }

    const model = config.customModel?.trim() || config.selectedModel || "gemini-2.5-flash";
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    const { contents, systemInstruction } = this.formatContents(messages);

    const body: any = { contents };
    if (systemInstruction || options?.systemInstruction) {
      body.systemInstruction = systemInstruction || {
        parts: [{ text: options?.systemInstruction }],
      };
    }
    if (options?.temperature !== undefined) {
      body.generationConfig = { temperature: options.temperature };
    }

    const res = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(sanitizeErrorMessage(err.error?.message || `HTTP ${res.status}`, apiKey));
    }

    const json = await res.json();
    const candidate = json.candidates?.[0];
    const textParts = (candidate?.content?.parts || []).map((p: any) => p.text || "").join("");
    return textParts;
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
      callbacks.onError?.("Google Gemini API key is missing. Please configure it in BYOK settings.");
      return;
    }

    const model = config.customModel?.trim() || config.selectedModel || "gemini-2.5-flash";
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    const { contents, systemInstruction } = this.formatContents(messages);

    const body: any = { contents };
    if (systemInstruction || options?.systemInstruction) {
      body.systemInstruction = systemInstruction || {
        parts: [{ text: options?.systemInstruction }],
      };
    }
    if (options?.temperature !== undefined) {
      body.generationConfig = { temperature: options.temperature };
    }

    if (options?.tools && options.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    try {
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMessage = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        callbacks.onError?.(sanitizeErrorMessage(`Gemini error: ${errMessage}`, apiKey));
        return;
      }

      await readSSEStream(
        res,
        (line) => {
          if (line.startsWith("data:")) {
            const dataStr = line.replace(/^data:\s*/, "");
            if (dataStr === "[DONE]") return;

            try {
              const parsed = JSON.parse(dataStr);
              const candidate = parsed.candidates?.[0];
              const parts = candidate?.content?.parts || [];

              for (const part of parts) {
                if (part.text) {
                  callbacks.onChunk(part.text);
                }
                if (part.functionCall) {
                  callbacks.onToolCall?.({
                    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    name: part.functionCall.name,
                    arguments: part.functionCall.args || {},
                  });
                }
              }
            } catch {
              // ignore malformed frame
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
