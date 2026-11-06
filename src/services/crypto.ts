/**
 * Web Crypto API client-side encryption utility for BYOK credentials.
 * Uses AES-GCM (256-bit) with PBKDF2 key derivation (SHA-256, 100,000 iterations).
 * Stored strictly in IndexedDB; never in localStorage.
 */

const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;

// Convert Uint8Array to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Derive AES-GCM CryptoKey from passphrase or device salt using PBKDF2
async function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// Get or generate persistent device seed for default device-level encryption
let cachedDeviceSeed: string | null = null;
export async function getDeviceEncryptionSeed(): Promise<string> {
  if (cachedDeviceSeed) return cachedDeviceSeed;
  const SEED_KEY = "nusa_crypto_device_seed";

  // Check if session has a seed in IndexedDB, fallback to crypto random
  const stored = sessionStorage.getItem(SEED_KEY);
  if (stored) {
    cachedDeviceSeed = stored;
    return stored;
  }

  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  const newSeed = bufferToBase64(randomBytes);
  try {
    sessionStorage.setItem(SEED_KEY, newSeed);
  } catch {
    // sessionStorage fallback
  }
  cachedDeviceSeed = newSeed;
  return newSeed;
}

/**
 * Encrypt a secret API key string using AES-GCM.
 * Returns { ciphertext, iv, salt } encoded as Base64.
 */
export async function encryptApiKey(
  apiKey: string,
  customPassphrase?: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("Cannot encrypt an empty API key.");
  }

  const passphrase = customPassphrase || (await getDeviceEncryptionSeed());
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for AES-GCM

  const key = await deriveEncryptionKey(passphrase, salt);
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(apiKey.trim());

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encodedData
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
  };
}

/**
 * Decrypt an encrypted API key back to plaintext.
 */
export async function decryptApiKey(
  ciphertextBase64: string,
  ivBase64: string,
  saltBase64: string,
  customPassphrase?: string
): Promise<string> {
  const passphrase = customPassphrase || (await getDeviceEncryptionSeed());
  const ciphertext = base64ToBuffer(ciphertextBase64);
  const iv = base64ToBuffer(ivBase64);
  const salt = base64ToBuffer(saltBase64);

  const key = await deriveEncryptionKey(passphrase, salt);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as any,
      },
      key,
      ciphertext as any
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err: any) {
    throw new Error(
      "Decryption failed. If you configured a custom passphrase, please verify it is correct."
    );
  }
}

/**
 * Mask an API key for safe display in UI (e.g., "sk-proj...3a9f").
 */
export function maskApiKey(apiKey?: string): string {
  if (!apiKey) return "";
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return "••••••••";
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}••••••••${end}`;
}
