import React, { useState } from "react";
import {
  X,
  Settings,
  Key,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  Sliders,
  Shield,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { AgentSettings } from "../../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AgentSettings;
  onSaveSettings: (settings: AgentSettings) => void;
  sessionId: string;
  onClearAllData: () => void;
  onOpenBYOK: () => void;
  onOpenDocs?: () => void;
  activeProviderName?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  sessionId,
  onClearAllData,
  onOpenBYOK,
  onOpenDocs,
  activeProviderName = "Not Configured",
}) => {
  if (!isOpen) return null;

  const [maxIterations, setMaxIterations] = useState(settings.maxIterations);
  const [autoScroll, setAutoScroll] = useState(settings.autoScroll);
  const [copiedSession, setCopiedSession] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleCopySession = () => {
    navigator.clipboard.writeText(sessionId);
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 2000);
  };

  const handleSave = () => {
    onSaveSettings({
      ...settings,
      maxIterations,
      autoScroll,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-[#0d1320] border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Platform Settings</h2>
              <p className="text-[11px] text-slate-400">Configure BYOK providers, autonomous loops & session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* BYOK Providers Quick Shortcut */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-violet-950/60 border border-indigo-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">AI Provider Keys (BYOK)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
                {activeProviderName}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Configure or switch between Google Gemini, OpenAI, OpenRouter, Groq, Anthropic, Mistral, Ollama, and LM Studio.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBYOK();
              }}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition"
            >
              <span>Manage BYOK Providers & Keys</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Documentation Link */}
          {onOpenDocs && (
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Architecture & Documentation</div>
                  <div className="text-[11px] text-slate-400">Security whitepaper, BYOK guides & Ollama CORS</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDocs();
                }}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-slate-200 transition"
              >
                Read Docs
              </button>
            </div>
          )}

          {/* Max Autonomous Iterations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Max Agent Tool Iterations</span>
              </label>
              <span className="text-xs font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                {maxIterations} loops
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="10"
              step="1"
              value={maxIterations}
              onChange={(e) => setMaxIterations(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Maximum tool execution cycles the autonomous agent will perform per task.
            </p>
          </div>

          {/* Auto Scroll Toggle */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-200 cursor-pointer">
            <span>Auto-scroll to latest streaming message</span>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded accent-indigo-600 w-4 h-4 cursor-pointer"
            />
          </label>

          {/* Anonymous Session Details */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Anonymous Session ID</span>
              <button
                type="button"
                onClick={handleCopySession}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition"
              >
                {copiedSession ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-2 rounded-lg bg-black/50 border border-white/[0.04] font-mono text-[11px] text-slate-300 truncate">
              {sessionId}
            </div>
            <p className="text-[10px] text-slate-400">
              Used strictly for session isolation and rate limiting. No registration or password required.
            </p>
          </div>

          {/* Destructive Zone: Clear all conversations */}
          <div className="pt-2 border-t border-white/[0.06]">
            {!showClearConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 transition text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Reset Database & Clear All Chats</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Are you sure? This will delete all local conversations and cached credentials.</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllData();
                      setShowClearConfirm(false);
                      onClose();
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-slate-300 text-xs transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.07] bg-black/30 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
