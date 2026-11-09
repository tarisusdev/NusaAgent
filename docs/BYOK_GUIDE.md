# NusaAgent BYOK Setup & Provider Guide

This guide provides step-by-step instructions for acquiring API keys, configuring each supported provider, and troubleshooting connection issues in **NusaAgent**.

---

## 1. Quick Setup Overview

1. Open **NusaAgent** in your browser.
2. In the left sidebar or the top header, click **AI Providers (BYOK)**.
3. Select your preferred provider from the list.
4. Paste your API key (stored encrypted in browser IndexedDB).
5. Click **Test Connection** to verify roundtrip latency.
6. Select your target model or leave the default.
7. Click **Save Configuration**.

---

## 2. Provider Configuration Guides

### A. Google Gemini

Google Gemini offers generous free and paid tiers with 1M–2M context windows and native function calling.

1. Navigate to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **Create API Key** and select or create a Google Cloud project.
4. Copy your key (`AIzaSy...`).
5. In NusaAgent:
   - Select **Google Gemini**.
   - Paste your key.
   - Default Base URL: `https://generativelanguage.googleapis.com/v1beta`.
   - Recommended models: `gemini-2.5-flash` (ultra-fast) or `gemini-2.5-pro` (complex reasoning).

---

### B. OpenAI

Supports industry standard models including `gpt-4o`, `gpt-4o-mini`, and the `o1`/`o3` reasoning series.

1. Navigate to the [OpenAI Platform API Keys](https://platform.openai.com/api-keys).
2. Sign in and ensure your account has active billing credits under **Settings > Billing**.
3. Click **Create new secret key**, give it a name, and copy the key (`sk-proj-...`).
4. In NusaAgent:
   - Select **OpenAI**.
   - Paste your key.
   - Default Base URL: `https://api.openai.com/v1`.
   - Recommended models: `gpt-4o` for complex multimodal tasks, `gpt-4o-mini` for fast everyday queries.

---

### C. OpenRouter

OpenRouter is a unified API gateway providing access to 200+ models from Meta (Llama), DeepSeek, Anthropic, Mistral, and Google under a single balance.

1. Visit [OpenRouter Keys](https://openrouter.ai/keys).
2. Sign in and click **Create Key**.
3. (Optional) Set a credit limit on the key for peace of mind.
4. Copy your key (`sk-or-v1-...`).
5. In NusaAgent:
   - Select **OpenRouter**.
   - Paste your key.
   - Recommended models:
     - `openrouter/auto`: Automatically selects the best route based on latency and cost.
     - `deepseek/deepseek-r1`: Open-weights reasoning model with full chain-of-thought.
     - `meta-llama/llama-3.3-70b-instruct`: Frontier open-weights model.

---

### D. Anthropic Claude

Offers Claude 3.7 Sonnet (hybrid reasoning) and the Claude 3.5 series with exceptional coding capabilities.

1. Visit the [Anthropic Console](https://console.anthropic.com/settings/keys).
2. Ensure you have purchased credits under **Billing**.
3. Create an API key (`sk-ant-api03-...`).
4. In NusaAgent:
   - Select **Anthropic Claude**.
   - Paste your key.
   - Default Base URL: `https://api.anthropic.com/v1`.
   - *Technical Note*: NusaAgent includes `anthropic-dangerous-direct-browser-access: true` headers to permit direct client-to-API communication without routing through third-party servers.

---

### E. Ollama (Local & 100% Offline)

Run models entirely on your own GPU/CPU with no API keys, zero internet transmission, and zero costs.

1. Download Ollama from [ollama.com](https://ollama.com) and install it on your machine.
2. In your terminal, pull your preferred models:
   ```bash
   ollama pull llama3.2
   ollama pull qwen2.5-coder
   ollama pull deepseek-r1
   ```
3. **CRITICAL: Enable Browser CORS**
   Modern browsers prevent web apps from sending HTTP requests to `localhost` unless the server sends appropriate CORS headers. Start Ollama with the wildcard origin:

   *On Linux / macOS:*
   ```bash
   OLLAMA_ORIGINS="*" ollama serve
   ```

   *On Windows (PowerShell):*
   ```powershell
   $env:OLLAMA_ORIGINS="*"
   ollama serve
   ```

4. In NusaAgent:
   - Select **Ollama (Local)**.
   - Base URL: `http://localhost:11434`.
   - No API key is required.
   - Click **Test Connection**. NusaAgent will automatically discover your locally pulled models!

---

## 3. Diagnostic Error Reference

| Status | Likely Cause | Recommended Resolution |
| :--- | :--- | :--- |
| **`connected`** | Successful authentication | You're ready to chat and execute autonomous tasks. |
| **`invalid_key`** | Key typo, revoked key, or wrong provider selected | Regenerate key in the provider console; check for trailing whitespace. |
| **`quota_exceeded`** | Out of credits or hit request rate limits | Verify billing balance in provider console (e.g. OpenAI billing or Anthropic credits). |
| **`network_error`** | CORS restriction or server unreachable | For Ollama, verify `OLLAMA_ORIGINS="*"`. For cloud providers, check your firewall or browser privacy extensions. |
| **`unsupported_endpoint`** | Base URL contains extra subpaths or typos | Click **Reset to default** next to the Base URL input. |
| **`unavailable`** | Provider upstream outage (5xx error) | Check the provider's status page or temporarily switch to a backup provider. |

---

## 4. Passphrase Protection & Backups

### Setting a Custom Passphrase
By default, NusaAgent encrypts keys at rest using an isolated device seed. If you share your computer or want additional protection:
1. In the BYOK modal, click **Passphrase**.
2. Enter a master passphrase.
3. NusaAgent will re-derive the AES-GCM encryption key using PBKDF2 (100,000 rounds) based on your custom passphrase.

### Exporting & Backing Up
- Click **Export Configuration** to download your provider list and model preferences as JSON.
- For security, **plaintext API keys are scrubbed from exports by default**.
