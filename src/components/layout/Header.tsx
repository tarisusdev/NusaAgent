import React from "react";
import {
  Sparkles,
  Bot,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  Cpu,
  Zap,
  BookOpen,
  Code2,
  PenTool,
  BarChart3,
  Key,
} from "lucide-react";
import { AgentModeId } from "../../types";
import { ProviderConfig } from "../../types/providers";
import { getProviderMetadata } from "../../services/providers/registry";

interface HeaderProps {
  currentMode: AgentModeId;
  onSelectMode: (mode: AgentModeId) => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onToggleSidebar: () => void;
  isAgentRunning: boolean;
  activeProviderConfig: ProviderConfig | null;
  onOpenBYOK: () => void;
}

const MODES: Array<{ id: AgentModeId; name: string; icon: any }> = [
  { id: "general", name: "General", icon: Bot },
  { id: "research", name: "Research", icon: BookOpen },
  { id: "coding", name: "Coding", icon: Code2 },
  { id: "writing", name: "Writing", icon: PenTool },
  { id: "data_analyst", name: "Data Analyst", icon: BarChart3 },
];

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onSelectMode,
  isRightPanelOpen,
  onToggleRightPanel,
  onToggleSidebar,
  isAgentRunning,
  activeProviderConfig,
  onOpenBYOK,
}) => {
  const providerMeta = activeProviderConfig
    ? getProviderMetadata(activeProviderConfig.providerId)
    : null;
  const currentModel =
    activeProviderConfig?.customModel ||
    activeProviderConfig?.selectedModel ||
    "No Provider";
  const isConfigured = Boolean(
    activeProviderConfig && (activeProviderConfig.apiKey || !providerMeta?.requiresApiKey)
  );

  return (
    <header className="h-14 border-b border-white/[0.07] bg-[#0d121d]/80 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0">
      {/* Left section: mobile hamburger & mode selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition md:hidden"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mode switcher pills */}
        <div className="flex items-center bg-black/40 border border-white/[0.08] p-1 rounded-xl gap-1">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600/90 text-white shadow-sm shadow-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span className="hidden sm:inline">{mode.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right section: BYOK Provider pill & right panel toggle */}
      <div className="flex items-center gap-2.5">
        {/* Active Provider & Model Badge (Click to open BYOK Settings) */}
        <button
          onClick={onOpenBYOK}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition shadow-sm ${
            isConfigured
              ? "bg-white/[0.04] border-white/[0.09] text-slate-200 hover:bg-white/[0.08]"
              : "bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20 animate-pulse"
          }`}
          title="Configure BYOK Providers & API Keys"
        >
          <Key className={`w-3.5 h-3.5 ${isConfigured ? "text-indigo-400" : "text-amber-400"}`} />
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="font-semibold text-white">
              {providerMeta ? providerMeta.name : "Setup Provider"}
            </span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-slate-300 truncate max-w-[120px] hidden sm:inline">
              {currentModel}
            </span>
          </div>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConfigured ? "bg-emerald-400" : "bg-amber-400"
            }`}
          ></span>
        </button>

        {/* Right activity panel trigger */}
        <button
          onClick={onToggleRightPanel}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
            isRightPanelOpen
              ? "bg-indigo-950/60 border-indigo-500/40 text-indigo-300"
              : "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white"
          }`}
          title="Toggle Agent Activity Inspector"
        >
          <div className="relative">
            <Zap
              className={`w-3.5 h-3.5 ${
                isAgentRunning ? "text-amber-400 animate-bounce" : "text-indigo-400"
              }`}
            />
            {isAgentRunning && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </div>
          <span className="hidden sm:inline">
            {isAgentRunning ? "Agent Active" : "Activity Panel"}
          </span>
          {isRightPanelOpen ? (
            <PanelRightClose className="w-3.5 h-3.5 opacity-70" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5 opacity-70" />
          )}
        </button>
      </div>
    </header>
  );
};
