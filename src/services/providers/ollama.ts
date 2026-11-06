import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionTestResult,
  ModelInfo,
  ProviderConfig,
  ToolDefinitionParam,
} from "../../types/providers";
import { ProviderAdapter, readSSEStream, sanitizeErrorMessage } from "./base";

export const ollamaAdapter: ProviderAdapter = {
  id: "ollama",
  name: "Ollama (Local)",
  defaultBaseUrl: "http://localhost:11434",
  requiresApiKey: false,
  supportsToolCalling: true,
  supportsVision: true,
  supportsStreaming: true,
  isLocal: true,

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const baseUrl = (config.baseUrl?.trim() || ollamaAdapter.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        return {
          success: false,
          latencyMs,
          message: `Ollama returned HTTP ${res.status}. Ensure Ollama is running at ${baseUrl}.`,
        };
      }

      const data = await res.json();
      const models = data.models || [];

      return {
        success: true,
        latencyMs,
        message: `Connected to local Ollama (${models.length} local models installed).`,
        modelsFound: models.length,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message:
          "Unable to reach Ollama at " +
          baseUrl +
          ". Make sure Ollama is running and OLLAMA_ORIGINS='*' is set if using from a browser origin.",
      };
    }
  },

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const baseUrl = (config.baseUrl?.trim() || ollamaAdapter.defaultBaseUrl).replace(/\/+$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        description: `Size: ${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB`,
        supportsTools: true,
      }));
    } catch {
      return [
        { id: "llama3.2:latest", name: "llama3.2:latest", supportsTools: true },
        { id: "llama3.3:latest", name: "llama3.3:latest", supportsTools: true },
        { id: "qwen2.5-coder:latest", name: "qwen2.5-coder:latest", supportsTools: true },
        { id: "mistral:latest", name: "mistral:latest", supportsTools: true },
      ];
    }
  },

  async chatStream(
    messages: ChatMessageParam[],
    tools: ToolDefinitionParam[],
    config: ProviderConfig,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const model = config.customModel?.trim() || config.selectedModel || "llama3.2:latest";
    const baseUrl = (config.baseUrl?.trim() || ollamaAdapter.defaultBaseUrl).replace(/\/+$/, "");

    // Ollama supports OpenAI-compatible /v1/chat/completions endpoint
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
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMessage = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        callbacks.onError?.(`Ollama error: ${errMessage}`);
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
            // ignore
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
      callbacks.onError?.(
        `Failed to reach Ollama at ${baseUrl}. Verify Ollama is running and CORS is enabled via 'OLLAMA_ORIGINS="*" ollama serve'.`
      );
    }
  },
};
