# NusaAgent Architecture & Design Specification

## 1. Architectural Philosophy

NusaAgent is built upon three foundational tenets:

1. **Decoupled AI Infrastructure (Zero Vendor Lock-In)**: The application does not rely on a monolithic AI backend. Instead, it employs a polymorphic provider adapter pattern where each model provider is an isolated implementation of `ProviderInterface`.
2. **Client-Authoritative Security Boundary**: User credentials (API keys) and conversations reside exclusively within the user's browser environment. The backend acts strictly as an SSRF-safe proxy for external web searches and document ingestion.
3. **Reactive Agent Execution Loop**: The autonomous agent engine decomposes high-level goals into step-by-step action plans, executes real tools sequentially or concurrently, inspects observations, and self-corrects without simulation.

---

## 2. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENT                            │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                         React 19 SPA                           │   │
│   │   [Header]        [Sidebar]        [MessageComposer]  [Right]  │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │                      Provider Manager                          │   │
│   │       - Active Provider State    - Subscriber Notifications    │   │
│   │       - Dynamic Model Selector   - Diagnostics Engine          │   │
│   └──────┬──────────────┬──────────────┬─────────────┬─────────────┘   │
│          │              │              │             │                 │
│          ▼              ▼              ▼             ▼                 │
│   ┌─────────────┐┌─────────────┐┌─────────────┐┌─────────────┐        │
│   │   Gemini    ││   OpenAI    ││  Anthropic  ││   Ollama    │        │
│   │   Adapter   ││   Adapter   ││   Adapter   ││   Adapter   │        │
│   └──────┬──────┘└──────┬──────┘└──────┬──────┘└──────┬──────┘        │
│          │              │              │              │                │
│   ┌──────▼──────────────▼──────────────▼──────────────▼────────────┐   │
│   │                    Web Crypto Credential Store                 │   │
│   │          AES-GCM (256-bit) + PBKDF2 (100k iterations)          │   │
│   │                      IndexedDB Storage                         │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Web Search / Fetch
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS EXPRESS SERVER                          │
│                                                                        │
│   ┌───────────────────────────────┬────────────────────────────────┐   │
│   │   /api/tools/web-search       │   /api/tools/web-fetch         │   │
│   │   - SSRF Protection Guard     │   - Readability / HTML Parser  │   │
│   │   - Domain Blacklisting       │   - Markdown Synthesizer       │   │
│   └───────────────────────────────┴────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Component Subsystems

### A. Provider Adapter Subsystem (`src/providers/`)

Every AI model provider implements the unified contract defined in `ProviderInterface`:

```typescript
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
```

#### Provider Protocol Implementations:
- **Google Gemini (`src/providers/gemini.ts`)**: Directly speaks the Google Generative Language REST protocol (`v1beta`). Transforms generic messages into `contents[].parts` format and handles server-side function declarations.
- **OpenAI (`src/providers/openai.ts`)**: Communicates via standard `/v1/chat/completions` using Bearer authentication and parses Server-Sent Events (SSE) `delta.content` and `delta.tool_calls`.
- **OpenRouter (`src/providers/openrouter.ts`)**: Implements OpenAI-compatible streaming with custom routing headers (`HTTP-Referer` and `X-Title`) to grant access to 100+ models.
- **Anthropic Claude (`src/providers/anthropic.ts`)**: Uses the Anthropic Messages API (`/v1/messages`) with top-level `system` instructions, `input_schema` function tools, and the browser direct-access header (`anthropic-dangerous-direct-browser-access: true`).
- **Ollama (`src/providers/ollama.ts`)**: Connects to the local daemon at `http://localhost:11434`, reads line-delimited JSON streams (NDJSON), and parses `/api/tags` for installed models.

---

### B. Client-Side Agent Execution Engine (`src/services/agent/clientEngine.ts`)

The agent engine operates as a stateful event-driven orchestrator:

1. **Planning Phase**:
   - Analyzes user request and mode constraints (General, Research, Coding, Writing, Data Analyst).
   - Generates structured execution steps:
     ```json
     {
       "title": "Search benchmark figures",
       "tool": "web_search",
       "args": { "query": "Llama 3.3 70B benchmarks" }
     }
     ```
2. **Execution & Tool Invocation**:
   - Emits `plan_created` and `step_update` events to reactive UI inspectors.
   - Dispatches tool invocations through `executeClientTool()`:
     - Math expressions evaluated in a safe mathematical sandboxed parser.
     - Web queries routed through SSRF-protected server proxy.
3. **Observation & Synthesis**:
   - Tool outputs are appended to the conversation history as `tool` role turns.
   - The active model observes the outputs and generates follow-up steps or outputs the final response.

---

### C. Local Storage & Persistence Engine (`src/services/storage.ts`)

NusaAgent utilizes **IndexedDB** (`nusa_agent_db`, version 2) across 4 dedicated object stores:

| Object Store | Key Path | Index | Data Stored |
| :--- | :--- | :--- | :--- |
| `providers` | `providerId` | — | Encrypted API keys, custom base URLs, selected models, connection statuses |
| `conversations` | `id` | `sessionId` | Conversation metadata, titles, active modes, timestamps |
| `messages` | `id` | `conversationId` | Full multi-turn message history, tool calls, results, attached file references |
| `settings` | `key` | — | Global preferences, temperature, max iterations, autoscroll |

---

## 4. Diagnostics & Connection Verification

The connection testing pipeline evaluates network roundtrips and standardizes errors into categorized states:

```
Provider Request ──► HTTP Response / Error
                             │
                             ▼
                    classifyErrorStatus()
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    [401 / 403]            [429]               [CORS]
   "invalid_key"      "quota_exceeded"     "network_error"
```

The system never displays raw technical stack traces; instead, it provides structured recommendations (e.g. key regeneration links or `OLLAMA_ORIGINS="*"` instructions).
