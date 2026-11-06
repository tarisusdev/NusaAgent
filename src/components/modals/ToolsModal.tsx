import React from "react";
import {
  X,
  Wrench,
  Calculator,
  Search,
  Globe,
  FileText,
  Code2,
  CheckCircle2,
  Shield,
  Layers,
} from "lucide-react";

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ToolsModal: React.FC<ToolsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const tools = [
    {
      name: "calculator",
      title: "Verified Mathematical Engine",
      icon: Calculator,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      desc: "Evaluates arithmetic, powers (^), square root (sqrt), trigonometry (sin, cos, tan), logarithms (log, ln), and percentage calculations with 100% numerical accuracy without eval().",
      parameters: "expression: string (required), label: string (optional)",
      safety: "Strict lexical token validation. Never executes arbitrary JavaScript.",
      modes: "General, Research, Coding, Data Analyst",
    },
    {
      name: "web_search",
      title: "Real-Time Web Search",
      icon: Search,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      desc: "Connects to live search engines (DuckDuckGo & Wikipedia API) to retrieve current public facts, news, documentation, and research with clean source URLs.",
      parameters: "query: string (required), num_results: number (optional, 1-10)",
      safety: "Server-side search queries with link decoding and clean text sanitization.",
      modes: "General, Research, Coding, Writing, Data Analyst",
    },
    {
      name: "web_fetch",
      title: "SSRF-Protected Web Reader",
      icon: Globe,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      desc: "Retrieves public web pages, strips scripts/ads/CSS, and extracts clean, readable markdown content for deep analysis and citation.",
      parameters: "url: string (required)",
      safety: "SSRF hardened: strictly blocks localhost, 127.0.0.1, 0.0.0.0, 10.x, 192.168.x, 172.16-31.x, 169.254.x (cloud metadata), and internal network domains.",
      modes: "General, Research, Coding, Writing",
    },
    {
      name: "file_reader",
      title: "Document & File Intelligence",
      icon: FileText,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      desc: "Extracts textual content from uploaded PDFs (pdf-parse), Word documents (mammoth DOCX), plain text, CSV, JSON, and code files. Supports keyword queries.",
      parameters: "file_name_or_id: string (optional), search_query: string (optional)",
      safety: "Session-scoped in-memory storage. No unauthorized cross-session access.",
      modes: "General, Research, Coding, Writing, Data Analyst",
    },
    {
      name: "code_assistant",
      title: "Static Code & Security Analyzer",
      icon: Code2,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      desc: "Performs static syntax balance checks, algorithmic time/space Big-O complexity estimation, and detects security risks (XSS, injections, hardcoded secrets).",
      parameters: "code: string (required), language: string, action: string",
      safety: "Purely static analysis. Strictly never executes arbitrary user commands or shells on the server.",
      modes: "General, Coding, Data Analyst",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0d1320] border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">NusaAgent Tool Registry</h2>
              <p className="text-[11px] text-slate-400">5 Server-side Autonomous Execution Tools</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tools list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.name}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${t.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white font-mono">{t.name}</h3>
                      <span className="text-[11px] text-slate-400">{t.title}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                    Verified Real
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{t.desc}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                    <span className="text-slate-400 block font-mono text-[10px]">Parameters:</span>
                    <span className="text-indigo-300 font-mono text-[10.5px] truncate block">{t.parameters}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-white/[0.04]">
                    <span className="text-slate-400 block font-mono text-[10px]">Active In Modes:</span>
                    <span className="text-slate-300 text-[10.5px] truncate block">{t.modes}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
                  <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{t.safety}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.07] bg-black/30 flex items-center justify-between text-xs text-slate-400">
          <span>Gemini function calling dispatches directly to backend handlers.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
