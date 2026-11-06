import { ProviderId, ProviderMetadata } from "../../types/providers";
import { ProviderAdapter } from "./base";
import { geminiAdapter } from "./gemini";
import { openaiAdapter } from "./openai";
import { anthropicAdapter } from "./anthropic";
import { openrouterAdapter } from "./openrouter";
import { groqAdapter } from "./groq";
import { mistralAdapter } from "./mistral";
import { ollamaAdapter } from "./ollama";
import { lmstudioAdapter } from "./lmstudio";

export const PROVIDERS_METADATA: Record<ProviderId, ProviderMetadata> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    description: "Multimodal intelligence from Google with free and paid tiers.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://aistudio.google.com/app/apikey",
    apiKeyPlaceholder: "AIzaSy...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "from-blue-500 to-indigo-600",
    defaultModels: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Fast, Versatile)", isPopular: true, supportsTools: true, supportsVision: true },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Deep Reasoning)", supportsTools: true, supportsVision: true },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", supportsTools: true, supportsVision: true },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "Industry-standard GPT-4o and reasoning models.",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://platform.openai.com/api-keys",
    apiKeyPlaceholder: "sk-proj-...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "from-emerald-500 to-teal-600",
    defaultModels: [
      { id: "gpt-4o", name: "GPT-4o (Omni Flagship)", isPopular: true, supportsTools: true, supportsVision: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Affordable, Ultra-Fast)", isPopular: true, supportsTools: true, supportsVision: true },
      { id: "o3-mini", name: "o3-mini (Advanced Reasoning & STEM)", supportsTools: true },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "Unified gateway to 200+ models (Claude, DeepSeek, Llama, Gemini, Mistral).",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://openrouter.ai/keys",
    apiKeyPlaceholder: "sk-or-v1-...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "from-violet-500 to-purple-600",
    defaultModels: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", isPopular: true, supportsTools: true, supportsVision: true },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (Open Reasoning)", isPopular: true, supportsTools: false },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", supportsTools: true },
      { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free Route)", isPopular: true, supportsTools: true },
    ],
  },
  groq: {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast LPU inference (500+ tokens/sec) with open models.",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://console.groq.com/keys",
    apiKeyPlaceholder: "gsk_...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "from-amber-500 to-orange-600",
    defaultModels: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", isPopular: true, supportsTools: true },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Ultra-fast)", supportsTools: true },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", supportsTools: false },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 3.5 Sonnet and Haiku with superior reasoning and code.",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://console.anthropic.com/settings/keys",
    apiKeyPlaceholder: "sk-ant-api03-...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "from-amber-600 to-rose-600",
    defaultModels: [
      { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet (Latest)", isPopular: true, supportsTools: true, supportsVision: true },
      { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku (Fast)", isPopular: true, supportsTools: true, supportsVision: true },
      { id: "claude-3-opus-latest", name: "Claude 3 Opus", supportsTools: true, supportsVision: true },
    ],
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    description: "European open-weight and frontier models (Mistral Large, Codestral).",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://console.mistral.ai/api-keys/",
    apiKeyPlaceholder: "...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "from-orange-500 to-red-600",
    defaultModels: [
      { id: "mistral-large-latest", name: "Mistral Large (Flagship)", isPopular: true, supportsTools: true },
      { id: "codestral-latest", name: "Codestral (Specialized for Code)", isPopular: true, supportsTools: true },
      { id: "mistral-small-latest", name: "Mistral Small (Fast)", supportsTools: true },
    ],
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    description: "Run Llama, Mistral, Qwen and DeepSeek locally on your device for 100% privacy.",
    defaultBaseUrl: "http://localhost:11434",
    requiresApiKey: false,
    apiKeyHelpUrl: "https://ollama.com",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: true,
    color: "from-neutral-400 to-stone-600",
    defaultModels: [
      { id: "llama3.2:latest", name: "llama3.2:latest (Local)", isPopular: true, supportsTools: true },
      { id: "llama3.3:latest", name: "llama3.3:latest (Local)", isPopular: true, supportsTools: true },
      { id: "qwen2.5-coder:latest", name: "qwen2.5-coder:latest", supportsTools: true },
      { id: "deepseek-r1:latest", name: "deepseek-r1:latest", supportsTools: false },
    ],
  },
  lmstudio: {
    id: "lmstudio",
    name: "LM Studio",
    description: "Run local GGUF models via LM Studio desktop application server.",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresApiKey: false,
    apiKeyHelpUrl: "https://lmstudio.ai",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: true,
    color: "from-teal-400 to-cyan-600",
    defaultModels: [
      { id: "local-model", name: "Currently Loaded Model", isPopular: true, supportsTools: true },
    ],
  },
};

const adapters: Record<ProviderId, ProviderAdapter> = {
  gemini: geminiAdapter,
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  openrouter: openrouterAdapter,
  groq: groqAdapter,
  mistral: mistralAdapter,
  ollama: ollamaAdapter,
  lmstudio: lmstudioAdapter,
};

export function getProviderAdapter(providerId: ProviderId): ProviderAdapter {
  const adapter = adapters[providerId];
  if (!adapter) {
    throw new Error(`Provider '${providerId}' is not supported.`);
  }
  return adapter;
}

export function getAllProviders(): ProviderMetadata[] {
  return Object.values(PROVIDERS_METADATA);
}

export function getProviderMetadata(providerId: ProviderId): ProviderMetadata {
  return PROVIDERS_METADATA[providerId] || PROVIDERS_METADATA.gemini;
}
