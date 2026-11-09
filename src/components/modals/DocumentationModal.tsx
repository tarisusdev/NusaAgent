import React, { useState } from "react";
import {
  X,
  BookOpen,
  Shield,
  Key,
  Cpu,
  Terminal,
  ExternalLink,
  CheckCircle2,
  Lock,
  Layers,
  Wrench,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBYOK?: () => void;
}

type DocTab = "overview" | "security" | "providers" | "ollama" | "tools";

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  onClose,
  onOpenBYOK,
}) => {
  const [activeTab, setActiveTab] = useState<DocTab>("overview");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#0d121d] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl text-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-white">
                  NusaAgent Documentation & Architecture
                </h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 font-mono">
                  v1.0 BYOK
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official guide to zero-knowledge BYOK, security standards, and agent orchestration.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-2 border-b border-slate-800 bg-slate-950/60 flex items-center gap-1 overflow-x-auto shrink-0">
          {[
            { id: "overview", label: "Overview", icon: Sparkles },
            { id: "security", label: "Security & Encryption", icon: Shield },
            { id: "providers", label: "AI Providers Setup", icon: Key },
            { id: "ollama", label: "Local Ollama Guide", icon: Terminal },
            { id: "tools", label: "Agent Modes & Tools", icon: Wrench },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DocTab)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "border-indigo-500 text-indigo-300 bg-indigo-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs sm:text-sm custom-scrollbar bg-slate-900/20">
          {activeTab === "overview" && (
            <div className="space-y-5 leading-relaxed">
              <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 p-4 rounded-xl border border-indigo-500/20 space-y-2">
                <h3 className="font-semibold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  What is NusaAgent?
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm">
                  NusaAgent is a login-free autonomous AI workspace that couples multi-turn conversational intelligence with multi-step goal execution. Users supply their own API keys (BYOK) or connect to local open-weights models, eliminating centralized subscriptions, user tracking, and shared API billing.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Zero-Knowledge
                  </span>
                  <p className="text-xs text-slate-400">
                    Keys are encrypted with AES-GCM (256-bit) and stored exclusively in your browser's IndexedDB.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Key className="w-4 h-4" /> Multi-Provider
                  </span>
                  <p className="text-xs text-slate-400">
                    Switch between Gemini, OpenAI, Claude, OpenRouter, and Ollama without losing context.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4" /> Autonomous Tools
                  </span>
                  <p className="text-xs text-slate-400">
                    Executes real tools: calculator, SSRF-safe web search, HTML extract, and code auditing.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                {onOpenBYOK && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenBYOK();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs flex items-center gap-2 transition"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Open BYOK Settings</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4 leading-relaxed">
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Browser-Local Cryptographic Architecture
              </h3>

              <p className="text-xs text-slate-300">
                NusaAgent implements the W3C Web Crypto API standard to ensure your credentials are encrypted at rest on your physical machine:
              </p>

              <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs">
                <div className="text-indigo-400 font-semibold mb-1">Cryptographic Primitives:</div>
                <div>• Algorithm: AES-GCM (Galois/Counter Mode, 256-bit key)</div>
                <div>• Key Derivation: PBKDF2 with SHA-256 (100,000 iterations)</div>
                <div>• Salt: 128-bit cryptographically secure random bytes</div>
                <div>• IV: 96-bit initialization vector unique per encryption</div>
                <div>• Storage: IndexedDB (`nusa_agent_db.providers`)</div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-200 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Zero Server Key Transmission
                </div>
                <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                  When sending prompts, your browser sends requests directly from your machine to the AI provider endpoint via TLS 1.3 HTTPS. NusaAgent servers do not proxy or inspect your API keys.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="font-semibold text-slate-200">Data Wipe Guarantee</span>
                <p className="text-slate-400 text-xs">
                  Clicking "Delete All Credentials" in BYOK settings purges all in-memory keys and wipes the IndexedDB provider database permanently.
                </p>
              </div>
            </div>
          )}

          {activeTab === "providers" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">Supported Providers & Portals</h3>
              <div className="space-y-3">
                {[
                  {
                    name: "Google Gemini",
                    desc: "Free and paid tiers with 1M-2M token context, multimodal vision, and function calling.",
                    url: "https://aistudio.google.com/app/apikey",
                    keyPattern: "AIzaSy...",
                    models: "gemini-2.5-flash, gemini-2.5-pro",
                  },
                  {
                    name: "OpenAI",
                    desc: "Industry standard models including GPT-4o, GPT-4o-mini, and o1/o3 reasoning.",
                    url: "https://platform.openai.com/api-keys",
                    keyPattern: "sk-proj-...",
                    models: "gpt-4o, gpt-4o-mini, o3-mini",
                  },
                  {
                    name: "OpenRouter",
                    desc: "Unified routing gateway giving access to 200+ models under a single account.",
                    url: "https://openrouter.ai/keys",
                    keyPattern: "sk-or-v1-...",
                    models: "openrouter/auto, deepseek/deepseek-r1, meta-llama/llama-3.3-70b",
                  },
                  {
                    name: "Anthropic Claude",
                    desc: "State-of-the-art coding and hybrid reasoning via direct browser connection.",
                    url: "https://console.anthropic.com/settings/keys",
                    keyPattern: "sk-ant-api03-...",
                    models: "claude-3-7-sonnet, claude-3-5-sonnet, claude-3-5-haiku",
                  },
                  {
                    name: "Ollama (Local)",
                    desc: "Run open models (Llama 3.2, Qwen 2.5, DeepSeek) completely offline on your device.",
                    url: "https://ollama.com",
                    keyPattern: "None (localhost)",
                    models: "llama3.2:latest, qwen2.5-coder:latest",
                  },
                ].map((prov) => (
                  <div key={prov.name} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{prov.name}</span>
                      <a
                        href={prov.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <span>Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-xs text-slate-400">{prov.desc}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                      <span>Format: {prov.keyPattern}</span>
                      <span>•</span>
                      <span>Models: {prov.models}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "ollama" && (
            <div className="space-y-4 leading-relaxed">
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Local Ollama Setup & CORS Configuration
              </h3>

              <p className="text-xs text-slate-300">
                To enable NusaAgent to communicate with your local Ollama instance directly from your browser, Ollama must be launched with the wildcard origin flag to satisfy browser Cross-Origin Resource Sharing (CORS) security policies.
              </p>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Step 1: Pull Models</div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 flex items-center justify-between">
                  <span>ollama pull llama3.2</span>
                  <button
                    onClick={() => copyToClipboard("ollama pull llama3.2", "pull")}
                    className="p-1 hover:text-white"
                  >
                    {copiedSnippet === "pull" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Step 2: Start Ollama with CORS Allowed</div>
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-400">macOS / Linux:</div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 flex items-center justify-between">
                    <span>OLLAMA_ORIGINS="*" ollama serve</span>
                    <button
                      onClick={() => copyToClipboard('OLLAMA_ORIGINS="*" ollama serve', "unix")}
                      className="p-1 hover:text-white"
                    >
                      {copiedSnippet === "unix" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400">Windows (PowerShell):</div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 flex items-center justify-between">
                    <span>$env:OLLAMA_ORIGINS="*"; ollama serve</span>
                    <button
                      onClick={() => copyToClipboard('$env:OLLAMA_ORIGINS="*"; ollama serve', "win")}
                      className="p-1 hover:text-white"
                    >
                      {copiedSnippet === "win" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg text-cyan-200 text-xs">
                Once started, navigate to BYOK settings in NusaAgent, choose <b>Ollama (Local)</b>, and click <b>Test Connection</b>. NusaAgent will automatically list all locally installed models.
              </div>
            </div>
          )}

          {activeTab === "tools" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">Agent Modes & Real Tool Execution</h3>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-semibold text-indigo-400">5 Specialized Agent Modes</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <b>General:</b> Broad tasks & conversational reasoning.<br />
                    <b>Research:</b> Deep web search, citations, and structured briefs.<br />
                    <b>Coding:</b> Syntax analysis, Big-O auditing, and refactoring.<br />
                    <b>Writing:</b> Executive articles, marketing copy, and documentation.<br />
                    <b>Data Analyst:</b> Strict calculation verification and markdown tables.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-semibold text-emerald-400">5 Real Execution Tools</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <b>calculator:</b> In-memory deterministic math evaluation.<br />
                    <b>web_search:</b> SSRF-safe queries returning live web URLs & snippets.<br />
                    <b>web_fetch:</b> HTML-to-markdown reader for real page grounding.<br />
                    <b>code_assistant:</b> Algorithmic complexity and security audits.<br />
                    <b>file_reader:</b> Ingests PDF, DOCX, TXT, JSON, and source files.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Local files:</span>
            <span className="font-mono text-slate-400">README.md · /docs/ARCHITECTURE.md · /docs/SECURITY.md</span>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
