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
import { classifyErrorStatus, readNDJsonStream, sanitizeErrorMessage } from "./base";

export class OllamaProvider implements ProviderInterface {
  id = "ollama" as const;
  name = "Ollama (Local)";
  defaultBaseUrl = "http://localhost:11434";
  requiresApiKey = false;

  getCapabilities(modelId?: string): ProviderCapabilities {
    const isVision = (modelId || "").includes("llava") || (modelId || "").includes("vision");
    return {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsVision: isVision,
      contextWindow: 32768,
      isLocal: true,
      requiresApiKey: false,
    };
  }

  async connect(config: ProviderConfig): Promise<boolean> {
    const test = await this.testConnection(config);
    return test.success;
  }

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        return {
          status: "unavailable",
          success: false,
          latencyMs,
          message: `Ollama returned HTTP ${res.status}. Verify Ollama server status.`,
          testedAt: Date.now(),
        };
      }

      const data = await res.json();
      const count = data.models?.length || 0;

      return {
        status: "connected",
        success: true,
        latencyMs,
        message: `Successfully connected to local Ollama (${count} local models installed).`,
        modelsFound: count,
        testedAt: Date.now(),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const status = classifyErrorStatus(err);
      const isCorsOrFetch = err?.message?.includes("Failed to fetch") || status === "network_error";

      const hint = isCorsOrFetch
        ? "Could not reach Ollama at " +
          baseUrl +
          ". Ensure Ollama is running (`ollama serve`). To allow browser requests, set OLLAMA_ORIGINS=\"*\" in your shell before starting Ollama."
        : sanitizeErrorMessage(err);

      return {
        status,
        success: false,
        latencyMs,
        message: hint,
        testedAt: Date.now(),
      };
    }
  }

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) return this.getDefaultModels();
      const data = await res.json();
      if (!data.models || data.models.length === 0) return this.getDefaultModels();

      return data.models.map((m: any) => ({
        id: m.name,
        name: m.name,
        description: `Size: ${((m.size || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB · Format: ${
          m.details?.format || "gguf"
        }`,
        contextLength: 32768,
        supportsTools: true,
        supportsVision: m.name.includes("llava") || m.name.includes("vision"),
        isPopular: m.name.includes("llama3") || m.name.includes("mistral") || m.name.includes("qwen"),
      }));
    } catch {
      return this.getDefaultModels();
    }
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      {
        id: "llama3.2:latest",
        name: "Llama 3.2 (3B / 1B)",
        description: "Meta's lightweight local instruction-tuned model.",
        contextLength: 128000,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
      {
        id: "qwen2.5-coder:latest",
        name: "Qwen 2.5 Coder",
        description: "Alibaba's specialized code generation model.",
        contextLength: 32768,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
      {
        id: "deepseek-r1:latest",
        name: "DeepSeek R1 (Distill)",
        description: "Open-weights reasoning model for step-by-step logic.",
        contextLength: 64000,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
    ];
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
          content: msg.content,
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
    const model = config.customModel?.trim() || config.selectedModel || "llama3.2:latest";
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    const body: any = {
      model,
      messages: this.formatMessages(messages, options?.systemInstruction),
      stream: false,
    };
    if (options?.temperature !== undefined) {
      body.options = { temperature: options.temperature };
    }

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const json = await res.json();
    return json.message?.content || "";
  }

  async streamResponse(
    messages: ChatMessageParam[],
    config: ProviderConfig,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
    options?: GenerateOptions
  ): Promise<void> {
    const model = config.customModel?.trim() || config.selectedModel || "llama3.2:latest";
    const baseUrl = (config.baseUrl?.trim() || this.defaultBaseUrl).replace(/\/+$/, "");

    const body: any = {
      model,
      messages: this.formatMessages(messages, options?.systemInstruction),
      stream: true,
    };
    if (options?.temperature !== undefined) {
      body.options = { temperature: options.temperature };
    }

    if (options?.tools && options.tools.length > 0) {
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
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        callbacks.onError?.(`Ollama error: ${errJson.error || `HTTP ${res.status}`}`);
        return;
      }

      await readNDJsonStream(
        res,
        (json) => {
          if (json.message?.content) {
            callbacks.onChunk(json.message.content);
          }
          if (json.message?.tool_calls) {
            for (const tc of json.message.tool_calls) {
              callbacks.onToolCall?.({
                id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                name: tc.function?.name || "tool",
                arguments: tc.function?.arguments || {},
              });
            }
          }
          if (json.done) {
            callbacks.onDone?.();
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
      callbacks.onError?.(sanitizeErrorMessage(err));
    }
  }
}
