export type ProviderId =
  | "gemini"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "mistral"
  | "ollama"
  | "lmstudio";

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  isPopular?: boolean;
}

export interface ProviderMetadata {
  id: ProviderId;
  name: string;
  description: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  apiKeyHelpUrl?: string;
  apiKeyPlaceholder?: string;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  isLocal: boolean;
  defaultModels: ModelInfo[];
  color: string;
}

export interface ProviderConfig {
  providerId: ProviderId;
  apiKey?: string; // Stored encrypted in IndexedDB, in-memory plaintext
  baseUrl?: string;
  selectedModel: string;
  customModel?: string;
  isDefault?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface EncryptedCredential {
  providerId: ProviderId;
  ciphertext: string; // Base64
  iv: string; // Base64
  salt: string; // Base64
  updatedAt: number;
}

export interface StoredProviderConfig {
  providerId: ProviderId;
  baseUrl?: string;
  selectedModel: string;
  customModel?: string;
  isDefault?: boolean;
  encryptedKey?: EncryptedCredential;
  updatedAt: number;
}

export interface ChatMessageParam {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ToolDefinitionParam {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ChatStreamCallbacks {
  onChunk: (text: string) => void;
  onToolCall?: (toolCall: {
    id: string;
    name: string;
    arguments: Record<string, any>;
  }) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  modelsFound?: number;
}
