# NusaAgent BYOK Security Whitepaper

## 1. Executive Security Overview

In traditional AI software-as-a-service (SaaS) architectures, user API keys or credits are collected on a centralized server. This creates significant security liabilities, including centralized credential databases vulnerable to breaches, unmonitored logging of proprietary keys, and potential regulatory non-compliance.

**NusaAgent** eliminates these risks entirely through a **Zero-Knowledge Bring Your Own Key (BYOK)** design. NusaAgent servers never receive, log, or persist user API credentials.

---

## 2. Cryptographic Architecture

NusaAgent utilizes the native browser **W3C Web Crypto API** (`window.crypto.subtle`), avoiding third-party JavaScript cryptographic dependencies that may contain side-channel vulnerabilities.

### A. Key Derivation Function (KDF)
- **Algorithm**: `PBKDF2` (RFC 2898 / PKCS #5 v2.0)
- **Hash Function**: `SHA-256`
- **Iteration Count**: `100,000` rounds
- **Salt**: 16 bytes (128 bits) generated via `window.crypto.getRandomValues()` per encryption operation
- **Derived Key**: 256-bit raw key imported for `AES-GCM` usage

### B. Encryption at Rest
- **Cipher**: `AES-GCM` (Advanced Encryption Standard in Galois/Counter Mode)
- **Key Length**: 256 bits
- **Initialization Vector (IV)**: 12 bytes (96 bits) cryptographically random, unique per encryption invocation
- **Authentication Tag**: 128 bits (enforces ciphertext integrity and authenticates associated data)

```
                       [User Passphrase / Device Seed]
                                      │
                                      ▼
[128-bit Salt] ────────► [PBKDF2 (100k rounds, SHA-256)]
                                      │
                                      ▼
                              [256-bit AES Key]
                                      │
[Plaintext Key] ──► [AES-GCM Encryption (96-bit IV)] ──► [Ciphertext + Auth Tag]
                                                              │
                                                              ▼
                                                   [IndexedDB Persistence]
```

---

## 3. Storage Boundary & Memory Lifecycle

### In-Memory Key Handling
1. **Volatile Memory**: Plaintext API keys exist only in volatile JavaScript heap memory within the `inMemoryKeyCache` of `credential-store.ts`.
2. **Ephemeral Lifetime**: Keys are decrypted into memory upon first usage or configuration save, and remain in memory only during the active browser session.
3. **No Web Storage Leaks**: Plaintext keys are **never** written to `localStorage`, `sessionStorage`, or `document.cookie`.

### Data Scrubbing & Sanitization
- **Masking (`maskApiKey()`)**: Keys are masked across all UI forms (e.g. `sk-proj••••••••3a9f`).
- **Error Sanitization (`sanitizeErrorMessage()`)**: Any error response from an API provider (such as an invalid authorization failure) is scrubbed. If the error text contains the API key string, it is replaced with `[REDACTED_API_KEY]`.
- **Export Scrubbing**: Backups created using the configuration exporter omit plaintext keys by default.

---

## 4. Server-Side SSRF Protection

NusaAgent includes a lightweight Express backend solely for utility functions (web search and HTML text extraction). To prevent Server-Side Request Forgery (SSRF):

1. **Private Network Blacklisting**:
   Outbound network fetch requests validate URLs and reject private or internal IP ranges:
   - `127.0.0.0/8` (Localhost)
   - `10.0.0.0/8` (Private network)
   - `172.16.0.0/12` (Private network)
   - `192.168.0.0/16` (Private network)
   - `169.254.0.0/16` (Link-local / Cloud metadata service)
2. **Protocol Restrictions**: Only `http:` and `https:` schemes are permitted. Schemes such as `file:`, `ftp:`, or `gopher:` are strictly prohibited.
3. **Session Verification**: All backend utility routes require a valid `x-nusa-session` header and are rate-limited to prevent abuse.

---

## 5. Threat Model & User Responsibilities

| Threat Vector | Mitigation Strategy |
| :--- | :--- |
| **Server Compromise** | NusaAgent servers hold zero user keys or decrypted message data. A compromise of the hosting infrastructure exposes no user credentials. |
| **Physical Device Theft** | Keys in IndexedDB are encrypted with AES-GCM. If a custom passphrase is configured, an attacker with physical access to the device cannot decrypt the keys without the passphrase. |
| **Malicious Browser Extensions** | Extensions with full tab inspection privileges could inspect JavaScript memory. Users are advised to run AI workspaces in dedicated, unbloated browser profiles. |
| **CORS Eavesdropping** | Direct API calls use standard TLS 1.3 encryption directly between the browser and the provider (Google, OpenAI, Anthropic). |

---

## 6. Complete Data Destruction

Users have immediate, unilateral control over their stored data:

- **Provider Key Wipe**: Deleting a single provider deletes its entry from the IndexedDB `providers` store and purges the volatile cache.
- **Delete All Credentials**: The "Delete All Credentials" action purges the entire IndexedDB database and revokes in-memory key handles.
- **Clear Browser Site Data**: Clearing site data in browser preferences permanently destroys all IndexedDB stores, device encryption seeds, and conversation histories.
