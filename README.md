# NusaAgent — Full-Stack Hybrid AI Agent Platform

<div align="center">

![NusaAgent Banner](https://img.shields.io/badge/NusaAgent-Hybrid%20AI%20Platform-4F46E5?style=for-the-badge&logo=openai&logoColor=white)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Web Crypto API](https://img.shields.io/badge/Web_Crypto_API-AES--GCM_256--bit-10B981?style=for-the-badge&logo=shield&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

<p align="center">
  <b>A production-grade, login-free autonomous AI agent workspace built with Bring Your Own Key (BYOK) zero-knowledge security architecture.</b>
</p>

[Key Features](#-key-features) •
[Architecture](#-system-architecture) •
[Security Model](#-byok-security-model) •
[Supported Providers](#-supported-ai-providers) •
[Quick Start](#-quick-start) •
[Agent Modes & Tools](#-agent-modes--tools) •
[Local Ollama Guide](#-local-ollama-setup) •
[Documentation](#-documentation)

</div>

---

## 🌟 Executive Summary

**NusaAgent** is an autonomous hybrid AI assistant and agent platform that empowers users to orchestrate frontier models, web research, code auditing, and data analytics without account registration, subscriptions, or centralized AI billing.

Built with a strict **Bring Your Own Key (BYOK)** paradigm:
- **No Shared Billing**: Users bring their own API key from Google Gemini, OpenAI, Anthropic Claude, OpenRouter, or run 100% offline with local Ollama.
- **Zero Server Storage**: API keys are encrypted at rest in client-side IndexedDB using the W3C Web Crypto API (`AES-GCM` 256-bit with `PBKDF2` key derivation). Keys never touch NusaAgent servers.
- **Autonomous Multi-Step Execution**: Plans, decomposes goals into sequential steps, calls real tools (web search, calculator, file parser), and synthesizes comprehensive deliverables.
- **Login-Free Workspaces**: Multi-conversation histories and uploaded files are stored entirely within the user's browser environment.

---

## ⚡ Key Features

- **Modular BYOK Provider Architecture**: Unified adapter interface (`ProviderInterface`) supporting Google Gemini, OpenAI, Anthropic Claude, OpenRouter, and local Ollama.
- **Dynamic Model Discovery & Search**: Query live provider endpoints for available models, inspect context windows, and view capability tags (`Streaming`, `Tools`, `Vision`).
- **Autonomous Agent Engine**: Dynamic plan creation, live thought stream, execution step tracker, and recursive tool execution loop.
- **Real-Time Tool Calling**: Built-in mathematical evaluation engine, SSRF-protected web search, live web page extractor, and code complexity auditor.
- **Comprehensive File Intelligence**: Client-side document processing for PDF, DOCX, TXT, JSON, and source code files with automatic summary generation.
- **Real-Time Token Streaming**: Native Server-Sent Events (SSE) and Line-Delimited JSON (NDJSON) readers for instant token rendering.
- **Dark Charcoal Aesthetic**: Polished, distraction-free interface engineered with Tailwind CSS, custom markdown code highlighting, and collapsible inspector panels.

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NusaAgent Client (Browser)                      │
│                                                                        │
│   ┌─────────────────────┐    ┌─────────────────────────────────────┐   │
│   │   Chat & Composer   │    │      Autonomous Agent Engine        │   │
│   │   - Streaming Chat  │    │      - Multi-step Planner           │   │
│   │   - Mode Switcher   │    │      - Dynamic Tool Execution Loop  │   │
│   └──────────┬──────────┘    └──────────────────┬──────────────────┘   │
│              │                                  │                      │
│              ▼                                  ▼                      │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                   Provider Manager (Singleton)                 │   │
│   └──────┬──────────────┬──────────────┬─────────────┬─────────────┘   │
│          │              │              │             │                 │
│          ▼              ▼              ▼             ▼                 │
│     ┌─────────┐    ┌─────────┐    ┌─────────┐   ┌─────────┐            │
│     │ Gemini  │    │ OpenAI  │    │Anthropic│   │ Ollama  │            │
│     │ Adapter │    │ Adapter │    │ Adapter │   │ Adapter │            │
│     └────┬────┘    └────┬────┘    └────┬────┘   └────┬────┘            │
│          │              │              │             │                 │
└──────────┼──────────────┼──────────────┼─────────────┼─────────────────┘
           │ Direct HTTPS │ Direct HTTPS │ Direct      │ Localhost HTTP
           ▼              ▼              ▼             ▼
    ┌─────────────┐ ┌───────────┐ ┌─────────────┐ ┌───────────┐
    │Google Gemini│ │  OpenAI   │ │  Anthropic  │ │  Ollama   │
    │  API v1beta │ │  API v1   │ │ Messages v1 │ │(11434/api)│
    └─────────────┘ └───────────┘ └─────────────┘ └───────────┘
```

---

## 🛡 BYOK Security Model

NusaAgent implements a zero-knowledge local credential storage architecture:

```
[Plaintext API Key]
        │
        ▼
[PBKDF2 SHA-256 Key Derivation] ◄── User Passphrase or Browser-Isolated Seed
        │ (100,000 iterations, 256-bit AES Key)
        ▼
[AES-GCM Encryption] ◄── Random 96-bit Initialization Vector (IV)
        │
        ▼
[IndexedDB: nusa_agent_db.providers] (Ciphertext + IV + Salt)
```

1. **Client Isolation**: Keys reside only within the browser's IndexedDB storage and are never uploaded, logged, or sent to any central backend.
2. **Encryption at Rest**: Keys are encrypted using standard W3C Web Crypto API with AES-GCM 256-bit.
3. **Optional Master Passphrase**: Users can specify an optional custom passphrase to protect keys across browser sessions.
4. **Scrubbed Exports**: Configuration backups strip all plaintext keys by default.
5. **Instant Key Purge**: The "Delete All Credentials" action purges all decryption keys from memory and clears the IndexedDB store.

---

## 🤖 Supported AI Providers

| Provider | Default Endpoint | Key Format | Streaming | Tool Calling | Vision |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | `AIzaSy...` | ✅ | ✅ | ✅ |
| **OpenAI** | `https://api.openai.com/v1` | `sk-proj-...` | ✅ | ✅ | ✅ |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `sk-or-v1-...` | ✅ | ✅ | ✅ |
| **Anthropic Claude** | `https://api.anthropic.com/v1` | `sk-ant-api03-...` | ✅ | ✅ | ✅ |
| **Ollama (Local)** | `http://localhost:11434` | None (Localhost) | ✅ | ✅ | ✅ |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/nusaagent.git
   cd nusaagent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional for local utilities):
   ```bash
   cp .env.example .env
   ```

4. Launch the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🎯 Agent Modes & Tools

### Agent Modes

1. **General Assistant**: Multi-turn conversation, reasoning, writing, and general knowledge synthesis.
2. **Research Agent**: Deep web search, information extraction, link verification, and markdown bibliography generation.
3. **Coding Agent**: Architecture analysis, bug triage, refactoring, code explanation, and complexity auditing.
4. **Writing Agent**: Executive memos, technical reports, content strategy, and documentation.
5. **Data Analyst**: Calculation verification, dataset transformation, statistical summaries, and tabular data visualization.

### Real Tool Registry

| Tool | Name | Description | Execution Target |
| :--- | :--- | :--- | :--- |
| 🧮 **Calculator** | `calculator` | Evaluates arithmetic and scientific expressions without hallucinations. | Client / In-memory |
| 🌐 **Web Search** | `web_search` | Real-time web query engine returning verified titles, snippets, and source URLs. | Server proxy |
| 📄 **Web Fetch** | `web_fetch` | Fetches web pages and converts HTML to clean, readable markdown text. | Server proxy |
| 💻 **Code Assistant** | `code_assistant` | Static code analysis, syntax evaluation, and Big-O performance review. | Client / Engine |
| 📁 **File Reader** | `file_reader` | Ingests PDF, DOCX, TXT, JSON, and code files for prompt grounding. | Client / Storage |

---

## 💻 Local Ollama Setup

To run models locally with 100% privacy and zero API costs:

1. **Install Ollama**: Download from [ollama.com](https://ollama.com).
2. **Pull a Model**:
   ```bash
   ollama pull llama3.2
   # or
   ollama pull qwen2.5-coder
   # or
   ollama pull deepseek-r1
   ```
3. **Configure Browser CORS**:
   Browsers block cross-origin requests by default. Start Ollama with the origins wildcard flag:
   
   *macOS / Linux:*
   ```bash
   OLLAMA_ORIGINS="*" ollama serve
   ```

   *Windows (PowerShell):*
   ```powershell
   $env:OLLAMA_ORIGINS="*"
   ollama serve
   ```

4. In NusaAgent, open **AI Providers (BYOK)**, select **Ollama (Local)**, and click **Test Connection**.

---

## 📁 Repository Structure

```
.
├── docs/                       # Technical whitepapers & documentation
│   ├── ARCHITECTURE.md         # Deep architectural design & data flow
│   ├── SECURITY.md             # Cryptographic implementation & threat model
│   └── BYOK_GUIDE.md           # Step-by-step key acquisition & setup guide
├── server/                     # Backend proxy & utility services
│   ├── agent/                  # Server-side agent fallback orchestrator
│   ├── middleware/             # Security, rate limiting & session headers
│   ├── routes/                 # Express API routes (health, search, files)
│   └── services/               # SSRF-guarded search and fetch engines
├── src/                        # React Frontend & Client Agent Engine
│   ├── components/             # Reusable UI components
│   │   ├── chat/               # Message composer, message items, welcome hero
│   │   ├── layout/             # Header, sidebar, activity panel
│   │   ├── modals/             # Settings, tools, and documentation modals
│   │   ├── models/             # Searchable ModelSelector with capability tags
│   │   ├── providers/          # ProviderCard, ProviderList, ProviderConfigForm
│   │   └── settings/           # ProviderSettingsView console
│   ├── providers/              # Unified provider adapters (gemini, openai, etc.)
│   ├── services/               # Client services (crypto, credential-store, storage)
│   ├── types/                  # TypeScript interface definitions
│   ├── App.tsx                 # Application root & reactive manager subscription
│   └── main.tsx                # React DOM entry point
├── server.ts                   # Express + Vite dev server entry point
├── package.json                # Project dependencies and scripts
└── tsconfig.json               # TypeScript compiler configuration
```

---

## 🧪 Verification & Build

To verify code quality and compile the production bundle:

```bash
# Type check and lint codebase
npm run lint

# Compile production assets
npm run build

# Start production server
npm run start
```

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with precision for the modern AI engineer. NusaAgent does not collect, log, or sell user credentials.</sub>
</div>
