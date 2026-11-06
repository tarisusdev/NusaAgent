import React from "react";
import {
  Sparkles,
  Calculator,
  Globe,
  FileText,
  Code2,
  TrendingUp,
  ArrowRight,
  Shield,
  Layers,
  Cpu,
} from "lucide-react";
import { AgentModeId } from "../../types";

interface WelcomeHeroProps {
  currentMode: AgentModeId;
  onSelectPrompt: (prompt: string, isAgent: boolean) => void;
  onOpenBYOK?: () => void;
  activeProviderName?: string;
}

interface PromptSuggestion {
  title: string;
  desc: string;
  prompt: string;
  icon: any;
  isAgent: boolean;
  tag: string;
}

const MODE_PROMPTS: Record<AgentModeId, PromptSuggestion[]> = {
  general: [
    {
      title: "Real Compound Interest",
      desc: "Calculate $15,000 at 6.8% compounding monthly for 5 years",
      prompt: "Calculate the future value and interest breakdown of $15,000 invested at 6.8% annual interest compounding monthly over 5 years. Use the calculator tool for exact precision.",
      icon: Calculator,
      isAgent: false,
      tag: "Calculator Tool",
    },
    {
      title: "Autonomous Web Research",
      desc: "Investigate latest advancements in WebAssembly & AI inference",
      prompt: "Research the current state of in-browser WebAssembly AI inference in 2026. Search the web, read top technical pages, and provide a cited synthesis.",
      icon: Globe,
      isAgent: true,
      tag: "Autonomous Agent",
    },
    {
      title: "File Intelligence & Q&A",
      desc: "Upload contracts, research papers, or CSVs for deep extraction",
      prompt: "I am uploading a document. Please read its entire content, extract the key quantitative metrics, and summarize the primary conclusions.",
      icon: FileText,
      isAgent: true,
      tag: "File Intelligence",
    },
  ],
  research: [
    {
      title: "Deep Technology Brief",
      desc: "Comprehensive web search with citations and source analysis",
      prompt: "Perform deep research on current commercial deployments of quantum annealing vs gate-based quantum computers. Find verified sources, read technical articles, and list full citations with URLs.",
      icon: Globe,
      isAgent: true,
      tag: "Deep Search",
    },
    {
      title: "Market & Academic Fact-Finding",
      desc: "Synthesize contrasting viewpoints and recent developments",
      prompt: "Investigate latest regulatory frameworks for autonomous AI agents in 2026. Gather perspectives from multiple official sources.",
      icon: FileText,
      isAgent: true,
      tag: "Research Agent",
    },
  ],
  coding: [
    {
      title: "Static Security & Bug Audit",
      desc: "Detect injection vulnerabilities, secrets, and high Big-O complexity",
      prompt: "Audit this JavaScript/TypeScript function for security hazards, prototype pollution, memory leaks, and time complexity: \n```javascript\nfunction processUserData(input) {\n  let cache = {};\n  for (let i = 0; i < input.length; i++) {\n    for (let j = 0; j < input[i].tags.length; j++) {\n      eval('cache[' + input[i].tags[j] + '] = ' + input[i].score);\n    }\n  }\n  return cache;\n}\n```",
      icon: Code2,
      isAgent: true,
      tag: "Code Assistant",
    },
    {
      title: "System Architecture Design",
      desc: "Draft a high-throughput event-driven microservices architecture",
      prompt: "Design a fault-tolerant real-time agent execution pipeline in TypeScript using Node.js, SSE streaming, and message queuing. Provide production code samples.",
      icon: Layers,
      isAgent: false,
      tag: "Architecture",
    },
  ],
  writing: [
    {
      title: "Executive Strategic Whitepaper",
      desc: "Structure and draft an authoritative executive briefing",
      prompt: "Draft a crisp, persuasive 3-section executive briefing for a Chief Technology Officer on transitioning from single-turn chatbots to autonomous multi-step tool-executing AI agents.",
      icon: FileText,
      isAgent: true,
      tag: "Executive Memo",
    },
    {
      title: "Technical Documentation Refactoring",
      desc: "Refine tone, remove ambiguity, and structure developer guides",
      prompt: "Create comprehensive API reference documentation for an enterprise Rate Limiter and Session Isolation module, including request headers, error codes, and curl examples.",
      icon: Sparkles,
      isAgent: false,
      tag: "Documentation",
    },
  ],
  data_analyst: [
    {
      title: "SaaS Financial Metrics Modeling",
      desc: "Compute ARR, Churn impact, CAC payback, and LTV exact values",
      prompt: "Model the unit economics for a SaaS company with 1,250 customers paying $89/month, 2.2% monthly churn, and $420 CAC. Calculate ARR, Net Retention, LTV, and CAC Payback Period using exact math.",
      icon: TrendingUp,
      isAgent: true,
      tag: "Financial Model",
    },
    {
      title: "Statistical & Probability Analysis",
      desc: "Perform verified probability and distribution calculations",
      prompt: "Calculate the exact binomial probability of getting at least 7 heads out of 10 fair coin tosses. Show the mathematical steps and final percentage.",
      icon: Calculator,
      isAgent: false,
      tag: "Exact Math",
    },
  ],
};

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  currentMode,
  onSelectPrompt,
  onOpenBYOK,
  activeProviderName,
}) => {
  const suggestions = MODE_PROMPTS[currentMode] || MODE_PROMPTS.general;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center justify-center text-center">
      {/* Insignia badge & BYOK status */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Hybrid Autonomous Agent Platform</span>
        </div>

        {activeProviderName ? (
          <button
            onClick={onOpenBYOK}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Connected: {activeProviderName}</span>
          </button>
        ) : (
          <button
            onClick={onOpenBYOK}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold hover:bg-amber-500/25 transition animate-pulse"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Connect Your AI Key (BYOK)</span>
          </button>
        )}
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
        What shall NusaAgent execute for you today?
      </h1>

      <p className="text-sm sm:text-base text-slate-400 max-w-xl mb-8 leading-relaxed">
        Autonomous multi-step planning, verified live web research, accurate calculation,
        code auditing, and document intelligence — powered by your own AI provider keys.
      </p>

      {/* Suggested task cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
        {suggestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(item.prompt, item.isAgent)}
              className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-indigo-500/40 transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 font-semibold border border-white/[0.05]">
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-indigo-200 transition mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs text-indigo-400 group-hover:text-indigo-300 font-medium">
                <span>{item.isAgent ? "Launch Agent Task" : "Run in Chat"}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Live capability pill strip */}
      <div className="mt-8 pt-6 border-t border-white/[0.05] w-full flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Anonymous Session Isolation</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <span>Live SSRF-Protected Web Fetch</span>
        </div>
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-400" />
          <span>Verified Math Engine</span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-violet-400" />
          <span>Multi-Turn Function Calling</span>
        </div>
      </div>
    </div>
  );
};
