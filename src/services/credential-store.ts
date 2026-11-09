/**
 * NusaAgent BYOK Credential Store
 *
 * Implements browser-local credential security:
 * - Credentials stored exclusively in client IndexedDB ("nusa_agent_db").
 * - Zero transmission to any server or centralized proxy.
 * - Encrypted at rest using AES-GCM (256-bit key derived via PBKDF2 with SHA-256 and 100,000 iterations).
 * - Master key derived from either user-supplied custom passphrase or browser-isolated device seed.
 * - Plaintext API keys exist in memory only during runtime execution.
 * - Exports strip plaintext keys by default.
 * - Includes complete wipe action ("Delete All Credentials").
 */

import {
  EncryptedCredential,
  ProviderConfig,
  ProviderId,
  StoredProviderConfig,
} from "../types/providers";
import {
  decryptApiKey,
  encryptApiKey,
  getDeviceEncryptionSeed,
  maskApiKey,
} from "./crypto";
import { PROVIDERS_METADATA } from "../providers/registry";

const DB_NAME = "nusa_agent_db";
const DB_VERSION = 2;
const STORE_PROVIDERS = "providers";

// In-memory cache of decrypted plaintext keys for the active session only
const inMemoryKeyCache = new Map<ProviderId, string>();

let activePassphrase: string | undefined = undefined;

export function setActivePassphrase(passphrase?: string): void {
  activePassphrase = passphrase?.trim() || undefined;
  // Clear cached keys so they are re-decrypted with the new passphrase
  inMemoryKeyCache.clear();
}

export function getActivePassphrase(): string | undefined {
  return activePassphrase;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROVIDERS)) {
        db.createObjectStore(STORE_PROVIDERS, { keyPath: "providerId" });
      }
      if (!db.objectStoreNames.contains("conversations")) {
        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
        convStore.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("conversationId", "conversationId", { unique: false });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save provider configuration with encrypted credential at rest.
 */
export async function saveProviderCredential(
  config: ProviderConfig,
  customPassphrase?: string
): Promise<void> {
  const db = await openDatabase();
  const meta = PROVIDERS_METADATA[config.providerId];
  const passphrase = customPassphrase || activePassphrase;

  let encryptedKeyData: EncryptedCredential | undefined;

  if (meta?.requiresApiKey && config.apiKey && config.apiKey.trim().length > 0) {
    const trimmedKey = config.apiKey.trim();
    inMemoryKeyCache.set(config.providerId, trimmedKey);

    const { ciphertext, iv, salt } = await encryptApiKey(trimmedKey, passphrase);
    encryptedKeyData = {
      providerId: config.providerId,
      ciphertext,
      iv,
      salt,
      updatedAt: Date.now(),
    };
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROVIDERS, "readwrite");
    const store = tx.objectStore(STORE_PROVIDERS);

    // If an existing record exists and no new key was typed, preserve old encrypted key
    const getReq = store.get(config.providerId);
    getReq.onsuccess = () => {
      const existing: StoredProviderConfig | undefined = getReq.result;
      const finalEncryptedKey = encryptedKeyData || existing?.encryptedKey;

      const record: StoredProviderConfig = {
        providerId: config.providerId,
        baseUrl: config.baseUrl?.trim() || meta?.defaultBaseUrl,
        selectedModel: config.selectedModel || meta?.defaultModels[0]?.id || "",
        customModel: config.customModel?.trim(),
        isDefault: Boolean(config.isDefault),
        encryptedKey: finalEncryptedKey,
        connectionStatus: config.connectionStatus || existing?.connectionStatus || "unconfigured",
        lastTestedAt: config.lastTestedAt || existing?.lastTestedAt,
        lastLatencyMs: config.lastLatencyMs || existing?.lastLatencyMs,
        updatedAt: Date.now(),
      };

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Load all stored provider configurations and decrypt credentials into memory.
 */
export async function loadAllProviderCredentials(
  customPassphrase?: string
): Promise<ProviderConfig[]> {
  const db = await openDatabase();
  const passphrase = customPassphrase || activePassphrase;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROVIDERS, "readonly");
    const store = tx.objectStore(STORE_PROVIDERS);
    const req = store.getAll();

    req.onsuccess = async () => {
      const storedConfigs: StoredProviderConfig[] = req.result || [];
      const configs: ProviderConfig[] = [];

      for (const record of storedConfigs) {
        let decryptedKey: string | undefined = inMemoryKeyCache.get(record.providerId);

        if (!decryptedKey && record.encryptedKey) {
          try {
            decryptedKey = await decryptApiKey(
              record.encryptedKey.ciphertext,
              record.encryptedKey.iv,
              record.encryptedKey.salt,
              passphrase
            );
            inMemoryKeyCache.set(record.providerId, decryptedKey);
          } catch {
            // Decryption failure (e.g. wrong passphrase or invalid salt)
            decryptedKey = undefined;
          }
        }

        configs.push({
          providerId: record.providerId,
          apiKey: decryptedKey,
          baseUrl: record.baseUrl,
          selectedModel: record.selectedModel,
          customModel: record.customModel,
          isDefault: Boolean(record.isDefault),
          connectionStatus: record.connectionStatus || (decryptedKey ? "connected" : "unconfigured"),
          lastTestedAt: record.lastTestedAt,
          lastLatencyMs: record.lastLatencyMs,
          updatedAt: record.updatedAt,
        });
      }

      resolve(configs);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a specific provider's credentials and config.
 */
export async function deleteProviderCredential(providerId: ProviderId): Promise<void> {
  inMemoryKeyCache.delete(providerId);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROVIDERS, "readwrite");
    const store = tx.objectStore(STORE_PROVIDERS);
    const req = store.delete(providerId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete all stored provider credentials and reset provider state.
 */
export async function deleteAllCredentials(): Promise<void> {
  inMemoryKeyCache.clear();
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROVIDERS, "readwrite");
    const store = tx.objectStore(STORE_PROVIDERS);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Export configuration. Plaintext keys are stripped by default for privacy.
 */
export async function exportBYOKConfiguration(includePlaintext = false): Promise<string> {
  const configs = await loadAllProviderCredentials();
  const payload = {
    app: "NusaAgent BYOK",
    version: 1,
    exportedAt: new Date().toISOString(),
    securityNote:
      "API keys belong to individual users. NusaAgent does not store credentials on servers.",
    providers: configs.map((c) => ({
      providerId: c.providerId,
      baseUrl: c.baseUrl,
      selectedModel: c.selectedModel,
      customModel: c.customModel,
      isDefault: c.isDefault,
      apiKey: includePlaintext ? c.apiKey : undefined,
      maskedKey: c.apiKey ? maskApiKey(c.apiKey) : undefined,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Security documentation explaining client storage boundaries and trade-offs.
 */
export const CREDENTIAL_SECURITY_INFO = {
  architecture: "Browser-local zero-knowledge BYOK",
  encryptionStandard: "AES-GCM (256-bit) via W3C Web Crypto API",
  kdf: "PBKDF2 with SHA-256 and 100,000 iterations",
  storageLocation: "IndexedDB ('nusa_agent_db.providers')",
  centralServerTransmission: "None. Direct client-to-provider HTTPS calls only.",
  limitations: [
    "Browser Isolation: Credentials remain strictly inside this browser profile and device.",
    "Storage Clearing: Clearing browser site data or IndexedDB will remove your stored keys.",
    "Browser Extensions: Malicious third-party browser extensions with full page access could theoretically inspect memory.",
    "CORS Policies: Some providers (like local Ollama or certain self-hosted endpoints) require CORS configuration to permit direct browser requests.",
  ],
};
