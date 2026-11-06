import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionTestResult,
  ModelInfo,
  ProviderConfig,
  ToolDefinitionParam,
} from "../../types/providers";
import { ProviderAdapter, readSSEStream, sanitizeErrorMessage } from "./base";

export const geminiAdapter: ProviderAdapter = {
  id: "gemini",
  name: "Google Gemini",
  defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  requiresApiKey: true,
  supportsToolCalling: true,
  supportsVision: true,
  supportsStreaming: true,
  isLocal: false,

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      return { success: false, latencyMs: 0, message: "API key is required." };
    }

    const baseUrl = (config.baseUrl?.trim() || geminiAdapter.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
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
      const count = data.models?.length || 0;

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to Google Gemini (${count} models available).`,
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
    if (!apiKey) return [];
    const baseUrl = (config.baseUrl?.trim() || geminiAdapter.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { "x-goog-api-key": apiKey },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => ({
          id: m.name.replace(/^models\//, ""),
          name: m.displayName || m.name,
          description: m.description,
          supportsTools: true,
          supportsVision: true,
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
      callbacks.onError?.("Google Gemini API key is missing. Please configure it in BYOK settings.");
      return;
    }

    const model = config.customModel?.trim() || config.selectedModel || "gemini-2.5-flash";
    const baseUrl = (config.baseUrl?.trim() || geminiAdapter.defaultBaseUrl).replace(/\/+$/, "");

    // Format Gemini contents and system instruction
    let systemInstruction: string | undefined;
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = msg.content;
      } else if (msg.role === "tool") {
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: msg.name || "tool",
                response: { content: msg.content },
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

    // Build tool declarations
    let geminiTools: any[] | undefined;
    if (tools && tools.length > 0) {
      geminiTools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const requestBody: any = {
      contents,
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (geminiTools) {
      requestBody.tools = geminiTools;
    }

    try {
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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
            } catch (parseErr) {
              // ignore non-json SSE frames
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
  },
};
