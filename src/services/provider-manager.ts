import {
  ChatMessageParam,
  ChatStreamCallbacks,
  ConnectionTestResult,
  GenerateOptions,
  ModelInfo,
  ProviderCapabilities,
  ProviderConfig,
  ProviderId,
  ProviderInterface,
} from "../types/providers";
import { getProvider, getProviderMetadata } from "../providers/registry";
import {
  deleteAllCredentials,
  deleteProviderCredential,
  loadAllProviderCredentials,
  saveProviderCredential,
} from "./credential-store";
import { testProviderConnection } from "./connection-test";

type Listener = () => void;

class ProviderManager {
  private activeConfig: ProviderConfig | null = null;
  private configs: ProviderConfig[] = [];
  private listeners: Set<Listener> = new Set();
  private isInitialized = false;

  constructor() {}

  async init(customPassphrase?: string): Promise<void> {
    try {
      this.configs = await loadAllProviderCredentials(customPassphrase);

      // Determine active config: prefer isDefault, else first with valid key/local
      const defaultConf = this.configs.find((c) => c.isDefault);
      if (defaultConf) {
        this.activeConfig = defaultConf;
      } else if (this.configs.length > 0) {
        this.activeConfig = this.configs[0];
      } else {
        this.activeConfig = null;
      }

      this.isInitialized = true;
      this.notify();
    } catch (err) {
      console.error("ProviderManager initialization failed:", err);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  getAllConfigs(): ProviderConfig[] {
    return [...this.configs];
  }

  getActiveConfig(): ProviderConfig | null {
    return this.activeConfig;
  }

  getActiveAdapter(): ProviderInterface | null {
    if (!this.activeConfig) return null;
    return getProvider(this.activeConfig.providerId);
  }

  getActiveCapabilities(): ProviderCapabilities | null {
    const adapter = this.getActiveAdapter();
    if (!adapter) return null;
    const model = this.activeConfig?.customModel || this.activeConfig?.selectedModel;
    return adapter.getCapabilities(model);
  }

  async switchActiveProvider(providerId: ProviderId): Promise<void> {
    const match = this.configs.find((c) => c.providerId === providerId);
    if (match) {
      this.activeConfig = match;
    } else {
      // Create provisional unconfigured object
      const meta = getProviderMetadata(providerId);
      this.activeConfig = {
        providerId,
        baseUrl: meta.defaultBaseUrl,
        selectedModel: meta.defaultModels[0]?.id || "",
        connectionStatus: "unconfigured",
      };
    }
    this.notify();
  }

  async saveConfig(config: ProviderConfig, customPassphrase?: string): Promise<void> {
    await saveProviderCredential(config, customPassphrase);
    await this.init(customPassphrase);
  }

  async deleteConfig(providerId: ProviderId): Promise<void> {
    await deleteProviderCredential(providerId);
    await this.init();
  }

  async deleteAll(): Promise<void> {
    await deleteAllCredentials();
    this.configs = [];
    this.activeConfig = null;
    this.notify();
  }

  async setDefault(providerId: ProviderId): Promise<void> {
    for (const conf of this.configs) {
      conf.isDefault = conf.providerId === providerId;
      await saveProviderCredential(conf);
    }
    await this.init();
  }

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const result = await testProviderConnection(config);
    // Update local state if it matches a stored provider
    const existing = this.configs.find((c) => c.providerId === config.providerId);
    if (existing) {
      existing.connectionStatus = result.status;
      existing.lastTestedAt = result.testedAt;
      existing.lastLatencyMs = result.latencyMs;
      await saveProviderCredential(existing);
      this.notify();
    }
    return result;
  }

  async fetchModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const provider = getProvider(config.providerId);
    return await provider.listModels(config);
  }

  async streamChat(
    messages: ChatMessageParam[],
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
    options?: GenerateOptions
  ): Promise<void> {
    if (!this.activeConfig) {
      callbacks.onError?.("No AI provider is configured. Please select and configure a provider.");
      return;
    }

    const adapter = getProvider(this.activeConfig.providerId);
    await adapter.streamResponse(messages, this.activeConfig, callbacks, signal, options);
  }
}

export const providerManager = new ProviderManager();
