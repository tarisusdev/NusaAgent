import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionTestResult,
  ModelInfo,
  ProviderConfig,
  ToolDefinitionParam,
} from "../../types/providers";
import { ProviderAdapter, readSSEStream, sanitizeErrorMessage } from "./base";

export const lmstudioAdapter: ProviderAdapter = {
  id: "lmstudio",
  name: "LM Studio (Local)",
  defaultBaseUrl: "http://localhost:1234/v1",
  requiresApiKey: false,
  supportsToolCalling: true,
  supportsVision: true,
  supportsStreaming: true,
  isLocal: true,

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const baseUrl = (config.baseUrl?.trim() || lmstudioAdapter.defaultBaseUrl).replace(/\/+$/, "");

    try {
      const res = await fetch(`${baseUrl}/models`);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        return {
          success: false,
          latencyMs,
          message: `LM Studio returned HTTP ${res.status}. Make sure the local server is started.`,
        };
      }

      const data = await res.json();
      const count = data.data?.length || 0;

      return {
        success: true,
        latencyMs,
        message: `Connected to LM Studio (${count} local models loaded/available).`,
        modelsFound: count,
      };
    } catch {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: `Unable to reach LM Studio at ${baseUrl}. Ensure LM Studio local server is active with CORS enabled in Developer settings.`,
      };
    }
  },

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const baseUrl = (config.baseUrl?.trim() || lmstudioAdapter.defaultBaseUrl).replace(/\/+$/, "");
    try {
      const res = await fetch(`${baseUrl}/models`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        supportsTools: true,
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
    const model = config.customModel?.trim() || config.selectedModel || "local-model";
    const baseUrl = (config.baseUrl?.trim() || lmstudioAdapter.defaultBaseUrl).replace(/\/+$/, "");

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMessage = errJson.error?.message || `HTTP ${res.status} ${res.statusText}`;
        callbacks.onError?.(`LM Studio error: ${errMessage}`);
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
        `Failed to reach LM Studio at ${baseUrl}. Ensure LM Studio local server is active with CORS enabled in Developer tab.`
      );
    }
  },
};
