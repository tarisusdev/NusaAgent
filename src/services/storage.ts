import { Conversation, Message, AgentSettings } from "../types";
import { ProviderConfig, ProviderId, StoredProviderConfig } from "../types/providers";
import { encryptApiKey, decryptApiKey } from "./crypto";
import { PROVIDERS_METADATA } from "./providers/registry";

const DB_NAME = "nusa_agent_db";
const DB_VERSION = 2;

// In-memory decrypted keys cache for active session
const memoryDecryptedKeys = new Map<ProviderId, string>();

// Anonymous session identifier (never an auth credential)
export function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem("nusa_session_id");
  if (!sessionId) {
    sessionId = "nusa_" + crypto.randomUUID();
    sessionStorage.setItem("nusa_session_id", sessionId);
  }
  return sessionId;
}

// Open or upgrade IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;

      if (!db.objectStoreNames.contains("conversations")) {
        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
        convStore.createIndex("sessionId", "sessionId", { unique: false });
        convStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("conversationId", "conversationId", { unique: false });
        msgStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      // BYOK Providers Store
      if (!db.objectStoreNames.contains("providers")) {
        db.createObjectStore("providers", { keyPath: "providerId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- BYOK Provider Storage ---

export async function getStoredProviders(customPassphrase?: string): Promise<ProviderConfig[]> {
  const db = await openDatabase();
  return new Promise(async (resolve, reject) => {
    const tx = db.transaction("providers", "readonly");
    const store = tx.objectStore("providers");
    const req = store.getAll();

    req.onsuccess = async () => {
      const storedList: StoredProviderConfig[] = req.result || [];
      const configs: ProviderConfig[] = [];

      for (const item of storedList) {
        let apiKey: string | undefined = memoryDecryptedKeys.get(item.providerId);

        // If not in memory, decrypt from IndexedDB using Web Crypto API
        if (!apiKey && item.encryptedKey) {
          try {
            apiKey = await decryptApiKey(
              item.encryptedKey.ciphertext,
              item.encryptedKey.iv,
              item.encryptedKey.salt,
              customPassphrase
            );
            if (apiKey) {
              memoryDecryptedKeys.set(item.providerId, apiKey);
            }
          } catch (decErr) {
            console.warn(`Failed to decrypt key for provider ${item.providerId}:`, decErr);
          }
        }

        configs.push({
          providerId: item.providerId,
          apiKey,
          baseUrl: item.baseUrl,
          selectedModel: item.selectedModel,
          customModel: item.customModel,
          isDefault: item.isDefault,
          updatedAt: item.updatedAt,
        });
      }

      resolve(configs);
    };

    req.onerror = () => reject(req.error);
  });
}

export async function saveStoredProvider(
  config: ProviderConfig,
  customPassphrase?: string
): Promise<void> {
  const db = await openDatabase();

  let encryptedKeyData: any = undefined;

  // Cache plaintext key in memory for this session
  if (config.apiKey && config.apiKey.trim().length > 0) {
    const cleanKey = config.apiKey.trim();
    memoryDecryptedKeys.set(config.providerId, cleanKey);

    // Encrypt with Web Crypto AES-GCM for persistent IndexedDB storage
    const encrypted = await encryptApiKey(cleanKey, customPassphrase);
    encryptedKeyData = {
      providerId: config.providerId,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      updatedAt: Date.now(),
    };
  } else {
    memoryDecryptedKeys.delete(config.providerId);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("providers", "readwrite");
    const store = tx.objectStore("providers");

    const record: StoredProviderConfig = {
      providerId: config.providerId,
      baseUrl: config.baseUrl,
      selectedModel: config.selectedModel,
      customModel: config.customModel,
      isDefault: config.isDefault,
      encryptedKey: encryptedKeyData,
      updatedAt: Date.now(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStoredProvider(providerId: ProviderId): Promise<void> {
  memoryDecryptedKeys.delete(providerId);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("providers", "readwrite");
    const store = tx.objectStore("providers");
    const req = store.delete(providerId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getActiveProviderConfig(
  customPassphrase?: string
): Promise<ProviderConfig | null> {
  const providers = await getStoredProviders(customPassphrase);
  if (providers.length === 0) return null;

  const defaultProv = providers.find((p) => p.isDefault);
  if (defaultProv) return defaultProv;

  // Otherwise return first configured provider
  return providers[0];
}

export async function setDefaultProvider(providerId: ProviderId): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction("providers", "readwrite");
  const store = tx.objectStore("providers");
  const req = store.getAll();

  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const list: StoredProviderConfig[] = req.result || [];
      for (const item of list) {
        item.isDefault = item.providerId === providerId;
        store.put(item);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// --- Conversations API ---

export async function getStoredConversations(sessionId: string): Promise<Conversation[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("conversations", "readonly");
    const store = tx.objectStore("conversations");
    const request = store.getAll();

    request.onsuccess = () => {
      const results: Conversation[] = request.result || [];
      results.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveStoredConversation(conv: Conversation): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("conversations", "readwrite");
    const store = tx.objectStore("conversations");
    const req = store.put(conv);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStoredConversation(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["conversations", "messages"], "readwrite");
    const convStore = tx.objectStore("conversations");
    const msgStore = tx.objectStore("messages");

    convStore.delete(id);

    const index = msgStore.index("conversationId");
    const req = index.getAllKeys(IDBKeyRange.only(id));
    req.onsuccess = () => {
      const keys = req.result;
      for (const key of keys) {
        msgStore.delete(key);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// --- Messages API ---

export async function getStoredMessages(conversationId: string): Promise<Message[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("conversationId");
    const request = index.getAll(IDBKeyRange.only(conversationId));

    request.onsuccess = () => {
      const results: Message[] = request.result || [];
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveStoredMessage(msg: Message): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const req = store.put(msg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Settings API ---

export const DEFAULT_SETTINGS: AgentSettings = {
  modelName: "gemini-2.5-flash",
  maxIterations: 6,
  temperature: 0.7,
  autoScroll: true,
};

export async function getStoredSettings(): Promise<AgentSettings> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("settings", "readonly");
      const store = tx.objectStore("settings");
      const req = store.get("user_settings");
      req.onsuccess = () => {
        resolve(req.result?.value || DEFAULT_SETTINGS);
      };
      req.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveStoredSettings(settings: AgentSettings): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    const store = tx.objectStore("settings");
    const req = store.put({ key: "user_settings", value: settings });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Import / Export ---

export async function exportLocalConfiguration(includePlaintextKeys = false): Promise<string> {
  const providers = await getStoredProviders();
  const settings = await getStoredSettings();

  const exportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    providers: providers.map((p) => ({
      providerId: p.providerId,
      baseUrl: p.baseUrl,
      selectedModel: p.selectedModel,
      customModel: p.customModel,
      isDefault: p.isDefault,
      // Plaintext keys are stripped by default for security
      apiKey: includePlaintextKeys ? p.apiKey : undefined,
    })),
  };

  return JSON.stringify(exportPayload, null, 2);
}

export async function importLocalConfiguration(
  jsonString: string,
  customPassphrase?: string
): Promise<{ importedCount: number }> {
  const data = JSON.parse(jsonString);
  if (!data.providers || !Array.isArray(data.providers)) {
    throw new Error("Invalid configuration format: Missing providers array.");
  }

  let count = 0;
  for (const p of data.providers) {
    if (p.providerId && PROVIDERS_METADATA[p.providerId as ProviderId]) {
      await saveStoredProvider(
        {
          providerId: p.providerId,
          apiKey: p.apiKey,
          baseUrl: p.baseUrl,
          selectedModel: p.selectedModel || PROVIDERS_METADATA[p.providerId as ProviderId].defaultModels[0]?.id || "",
          customModel: p.customModel,
          isDefault: Boolean(p.isDefault),
        },
        customPassphrase
      );
      count++;
    }
  }

  if (data.settings) {
    await saveStoredSettings(data.settings);
  }

  return { importedCount: count };
}

// --- Clear All Data ---

export async function clearAllLocalData(): Promise<void> {
  memoryDecryptedKeys.clear();
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["conversations", "messages", "settings", "providers"], "readwrite");
    tx.objectStore("conversations").clear();
    tx.objectStore("messages").clear();
    tx.objectStore("settings").clear();
    tx.objectStore("providers").clear();
    tx.oncomplete = () => {
      sessionStorage.removeItem("nusa_session_id");
      getOrCreateSessionId();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
