import {
  ModelInfo,
  ProviderId,
  ProviderInterface,
  ProviderMetadata,
} from "../types/providers";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { OpenRouterProvider } from "./openrouter";
import { AnthropicProvider } from "./anthropic";
import { OllamaProvider } from "./ollama";

export const PROVIDERS_METADATA: Record<ProviderId, ProviderMetadata> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    description: "Multimodal AI by Google with 1M-2M token context and native reasoning.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://aistudio.google.com/app/apikey",
    apiKeyPlaceholder: "AIzaSy...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "#3b82f6",
    defaultModels: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast, intelligent, best price-performance multimodal model.",
        contextLength: 1000000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "State-of-the-art reasoning for complex coding and multi-step tasks.",
        contextLength: 2000000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Ultra-low latency general assistant model.",
        contextLength: 1000000,
        supportsTools: true,
        supportsVision: true,
      },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "Industry standard models including GPT-4o, GPT-4o-mini, and o1/o3 reasoning.",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://platform.openai.com/api-keys",
    apiKeyPlaceholder: "sk-proj-...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "#10b981",
    defaultModels: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Flagship omni model with high intelligence and vision.",
        contextLength: 128000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o mini",
        description: "Fast, affordable model for everyday chat and tasks.",
        contextLength: 128000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "o3-mini",
        name: "o3-mini",
        description: "Cost-efficient reasoning model with deep chain of thought.",
        contextLength: 200000,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "Unified gateway to 100+ models from DeepSeek, Meta, Anthropic, Mistral, and more.",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://openrouter.ai/keys",
    apiKeyPlaceholder: "sk-or-v1-...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "#8b5cf6",
    defaultModels: [
      {
        id: "openrouter/auto",
        name: "OpenRouter Auto Router",
        description: "Automatically routes to best model by price, latency, and throughput.",
        contextLength: 128000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "deepseek/deepseek-r1",
        name: "DeepSeek R1",
        description: "Open-weights frontier reasoning model with full chain-of-thought.",
        contextLength: 128000,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
      {
        id: "anthropic/claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet (OpenRouter)",
        description: "Anthropic's flagship Sonnet via OpenRouter routing.",
        contextLength: 200000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        description: "State-of-the-art open weights conversational model.",
        contextLength: 128000,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 3.7 Sonnet hybrid reasoning and Claude 3.5 series direct from Anthropic.",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://console.anthropic.com/settings/keys",
    apiKeyPlaceholder: "sk-ant-api03-...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "#d97706",
    defaultModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet (Hybrid)",
        description: "Frontier reasoning model with controllable thought budgets.",
        contextLength: 200000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Benchmark leader for code, text synthesis, and analysis.",
        contextLength: 200000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        description: "High speed, cost-effective model with strong reasoning.",
        contextLength: 200000,
        supportsTools: true,
        supportsVision: true,
        isPopular: true,
      },
    ],
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Run Llama, DeepSeek, Qwen, Mistral entirely offline and locally on your machine.",
    defaultBaseUrl: "http://localhost:11434",
    requiresApiKey: false,
    apiKeyHelpUrl: "https://ollama.com",
    apiKeyPlaceholder: "No API key needed (Runs on localhost)",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: true,
    color: "#06b6d4",
    defaultModels: [
      {
        id: "llama3.2:latest",
        name: "Llama 3.2 (Latest)",
        description: "Fast local assistant running directly on your CPU/GPU.",
        contextLength: 128000,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
      {
        id: "qwen2.5-coder:latest",
        name: "Qwen 2.5 Coder",
        description: "Dedicated local code generation model.",
        contextLength: 32768,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
      {
        id: "deepseek-r1:latest",
        name: "DeepSeek R1 (Local)",
        description: "Distilled reasoning model executing entirely offline.",
        contextLength: 64000,
        supportsTools: true,
        supportsVision: false,
        isPopular: true,
      },
    ],
  },
  groq: {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast LPU inference (500+ tok/s) with open models.",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://console.groq.com/keys",
    apiKeyPlaceholder: "gsk_...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "#f59e0b",
    defaultModels: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", isPopular: true, supportsTools: true },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", supportsTools: true },
    ],
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    description: "European frontier models (Mistral Large, Codestral).",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    requiresApiKey: true,
    apiKeyHelpUrl: "https://console.mistral.ai/api-keys/",
    apiKeyPlaceholder: "...",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: false,
    color: "#ea580c",
    defaultModels: [
      { id: "mistral-large-latest", name: "Mistral Large", isPopular: true, supportsTools: true },
      { id: "codestral-latest", name: "Codestral", isPopular: true, supportsTools: true },
    ],
  },
  lmstudio: {
    id: "lmstudio",
    name: "LM Studio",
    description: "Run local models via LM Studio desktop application server.",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresApiKey: false,
    apiKeyHelpUrl: "https://lmstudio.ai",
    apiKeyPlaceholder: "Not required",
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    isLocal: true,
    color: "#14b8a6",
    defaultModels: [
      { id: "local-model", name: "Currently Loaded Model", isPopular: true, supportsTools: true },
    ],
  },
};

const providerInstances: Partial<Record<ProviderId, ProviderInterface>> = {};

export function getProvider(id: ProviderId): ProviderInterface {
  if (!providerInstances[id]) {
    switch (id) {
      case "gemini":
        providerInstances[id] = new GeminiProvider();
        break;
      case "openai":
        providerInstances[id] = new OpenAIProvider();
        break;
      case "openrouter":
        providerInstances[id] = new OpenRouterProvider();
        break;
      case "anthropic":
        providerInstances[id] = new AnthropicProvider();
        break;
      case "ollama":
        providerInstances[id] = new OllamaProvider();
        break;
      default:
        providerInstances[id] = new GeminiProvider();
    }
  }
  return providerInstances[id]!;
}

export function getAllProviders(): ProviderMetadata[] {
  return Object.values(PROVIDERS_METADATA);
}

export function getProviderMetadata(id: ProviderId): ProviderMetadata {
  return PROVIDERS_METADATA[id] || PROVIDERS_METADATA.gemini;
}
