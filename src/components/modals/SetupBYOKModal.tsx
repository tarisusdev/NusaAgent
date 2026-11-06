import React, { useState } from "react";
import {
  Key,
  Shield,
  Zap,
  ArrowRight,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Lock,
  Server,
  Layers,
} from "lucide-react";
import { ProviderId } from "../../types/providers";
import { PROVIDERS_METADATA } from "../../services/providers/registry";
import { saveStoredProvider, setDefaultProvider } from "../../services/storage";

interface SetupBYOKModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured: () => void;
}

export const SetupBYOKModal: React.FC<SetupBYOKModalProps> = ({
  isOpen,
  onClose,
  onConfigured,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickProviders: ProviderId[] = [
    "gemini",
    "openai",
    "groq",
    "openrouter",
    "anthropic",
    "ollama",
  ];

  const meta = PROVIDERS_METADATA[selectedProvider];

  const handleConnect = async () => {
    if (meta.requiresApiKey && !apiKey.trim()) {
      setError(`Please enter your ${meta.name} API key.`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveStoredProvider({
        providerId: selectedProvider,
        apiKey: apiKey.trim(),
        baseUrl: meta.defaultBaseUrl,
        selectedModel: meta.defaultModels[0]?.id || "",
        isDefault: true,
      });

      await setDefaultProvider(selectedProvider);
      onConfigured();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0c111c] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="p-6 pb-4 text-center border-b border-white/[0.06] bg-gradient-to-b from-indigo-500/10 to-transparent">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-400 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Welcome to NusaAgent BYOK
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            A login-free, autonomous hybrid AI agent platform. Bring your own API key to start with
            100% local privacy and zero shared billing.
          </p>

          <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>No Registration Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Encrypted in IndexedDB</span>
            </div>
          </div>
        </div>

        {/* Provider Selector Cards */}
        <div className="p-6 space-y-4">
          <label className="text-xs font-semibold text-slate-200 block">
            Select Your Preferred AI Provider:
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {quickProviders.map((pid) => {
              const p = PROVIDERS_METADATA[pid];
              const isSelected = selectedProvider === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(pid);
                    setError(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-md shadow-indigo-500/10"
                      : "bg-white/[0.02] border-white/[0.07] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${p.color}`}
                    ></span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <div className="text-xs font-bold text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {pid === "gemini" ? "Free tier available" : pid === "ollama" ? "Local offline" : "Direct API"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Key Input Section */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {meta.requiresApiKey ? `${meta.name} API Key` : `${meta.name} Local Setup`}
                </span>
              </span>

              {meta.apiKeyHelpUrl && (
                <a
                  href={meta.apiKeyHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <span>Get API Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {meta.requiresApiKey ? (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={meta.apiKeyPlaceholder || "Paste your API key here..."}
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed">
                Ollama runs locally on <code className="text-indigo-300 font-mono">http://localhost:11434</code>.
                No API key needed! Ensure Ollama is running on your machine.
              </p>
            )}

            {error && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <span>⚠️ {error}</span>
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-white/[0.07] bg-white/[0.02] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            Explore Interface First
          </button>

          <button
            type="button"
            onClick={handleConnect}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/25"
          >
            <span>Connect & Start NusaAgent</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
