export type ProviderId =
  | "gemini"
  | "openai"
  | "openrouter"
  | "anthropic"
  | "ollama"
  | "groq"
  | "mistral"
  | "lmstudio";

export type ConnectionStatus =
  | "connected"
  | "invalid_key"
  | "quota_exceeded"
  | "network_error"
  | "unsupported_endpoint"
  | "unavailable"
  | "unconfigured"
  | "testing";

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  isPopular?: boolean;
  isCustom?: boolean;
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  contextWindow: number;
  isLocal: boolean;
  requiresApiKey: boolean;
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
  apiKey?: string; // Stored encrypted in IndexedDB, plaintext only in memory
  baseUrl?: string;
  selectedModel: string;
  customModel?: string;
  isDefault?: boolean;
  connectionStatus?: ConnectionStatus;
  lastTestedAt?: number;
  lastLatencyMs?: number;
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
  connectionStatus?: ConnectionStatus;
  lastTestedAt?: number;
  lastLatencyMs?: number;
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
  status?: ConnectionStatus;
  success: boolean;
  latencyMs: number;
  message: string;
  modelsFound?: number;
  testedAt?: number;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinitionParam[];
  systemInstruction?: string;
}

export interface ProviderInterface {
  id: ProviderId;
  name: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;

  connect(config: ProviderConfig): Promise<boolean>;
  testConnection(config: ProviderConfig): Promise<ConnectionTestResult>;
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
  generateResponse(
    messages: ChatMessageParam[],
    config: ProviderConfig,
    options?: GenerateOptions
  ): Promise<string>;
  streamResponse(
    messages: ChatMessageParam[],
    config: ProviderConfig,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
    options?: GenerateOptions
  ): Promise<void>;
  getCapabilities(modelId?: string): ProviderCapabilities;
}
