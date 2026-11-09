import React, { useState, useEffect } from "react";
import {
  Key,
  Eye,
  EyeOff,
  Globe,
  RotateCcw,
  Play,
  Loader2,
  Save,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import {
  ConnectionTestResult,
  ModelInfo,
  ProviderConfig,
  ProviderId,
  ProviderMetadata,
} from "../../types/providers";
import { ModelSelector } from "../models/ModelSelector";
import { getDiagnosticFeedback } from "../../services/connection-test";
import { getProvider } from "../../providers/registry";

interface ProviderConfigFormProps {
  metadata: ProviderMetadata;
  existingConfig?: ProviderConfig;
  onSave: (config: ProviderConfig) => Promise<void>;
  onDelete?: (providerId: ProviderId) => Promise<void>;
  onTest: (config: ProviderConfig) => Promise<ConnectionTestResult>;
  isTesting: boolean;
  testResult: ConnectionTestResult | null;
}

export const ProviderConfigForm: React.FC<ProviderConfigFormProps> = ({
  metadata,
  existingConfig,
  onSave,
  onDelete,
  onTest,
  isTesting,
  testResult,
}) => {
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey || "");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(existingConfig?.baseUrl || metadata.defaultBaseUrl);
  const [selectedModel, setSelectedModel] = useState(
    existingConfig?.selectedModel || metadata.defaultModels[0]?.id || ""
  );
  const [customModel, setCustomModel] = useState(existingConfig?.customModel || "");
  const [isDefault, setIsDefault] = useState(Boolean(existingConfig?.isDefault));

  // Dynamic models state
  const [models, setModels] = useState<ModelInfo[]>(metadata.defaultModels);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Synchronize when provider metadata or existingConfig changes
  useEffect(() => {
    setApiKey(existingConfig?.apiKey || "");
    setBaseUrl(existingConfig?.baseUrl || metadata.defaultBaseUrl);
    setSelectedModel(existingConfig?.selectedModel || metadata.defaultModels[0]?.id || "");
    setCustomModel(existingConfig?.customModel || "");
    setIsDefault(Boolean(existingConfig?.isDefault));
    setSaveMessage(null);
    setShowKey(false);

    // Initial models populate
    loadModels(existingConfig?.apiKey, existingConfig?.baseUrl || metadata.defaultBaseUrl);
  }, [metadata.id, existingConfig]);

  const loadModels = async (key?: string, url?: string) => {
    setIsLoadingModels(true);
    try {
      const provider = getProvider(metadata.id);
      const fetched = await provider.listModels({
        providerId: metadata.id,
        apiKey: key || apiKey,
        baseUrl: url || baseUrl,
        selectedModel,
      });
      if (fetched && fetched.length > 0) {
        setModels(fetched);
      } else {
        setModels(metadata.defaultModels);
      }
    } catch {
      setModels(metadata.defaultModels);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTest = async () => {
    const configToTest: ProviderConfig = {
      providerId: metadata.id,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      selectedModel,
      customModel: customModel.trim(),
      isDefault,
    };
    const res = await onTest(configToTest);
    if (res.success) {
      loadModels(apiKey.trim(), baseUrl.trim());
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSave({
        providerId: metadata.id,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        selectedModel,
        customModel: customModel.trim(),
        isDefault,
      });
      setSaveMessage("Configuration saved securely in IndexedDB with Web Crypto encryption.");
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage(`Failed to save: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const diagnostic = testResult ? getDiagnosticFeedback(metadata.id, testResult) : null;

  return (
    <form onSubmit={handleSave} className="space-y-5 text-slate-200">
      {/* Header Info */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm"
            style={{
              backgroundColor: `${metadata.color}25`,
              color: metadata.color,
              border: `1px solid ${metadata.color}50`,
            }}
          >
            {metadata.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">{metadata.name}</h3>
              {metadata.isLocal && (
                <span className="text-[10px] bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/60">
                  Local / Offline
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{metadata.description}</p>
          </div>
        </div>

        {metadata.apiKeyHelpUrl && (
          <a
            href={metadata.apiKeyHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <span>Get API Key</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* API Key Input */}
      {metadata.requiresApiKey && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              API Key (Stored Locally & Encrypted)
            </label>
            <span className="text-[11px] text-slate-500">AES-GCM 256-bit at rest</span>
          </div>

          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={metadata.apiKeyPlaceholder || "Enter your API key"}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-20 py-2 text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500 transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="text-[10px]">{showKey ? "Hide" : "Show"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Base URL Configuration */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            Base Endpoint URL
          </label>
          {baseUrl !== metadata.defaultBaseUrl && (
            <button
              type="button"
              onClick={() => setBaseUrl(metadata.defaultBaseUrl)}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Reset to default
            </button>
          )}
        </div>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={metadata.defaultBaseUrl}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Local Provider (Ollama) CORS Notice */}
      {metadata.isLocal && (
        <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-lg p-3 text-xs space-y-1 text-cyan-200">
          <div className="flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Local Ollama Connection Guide</span>
          </div>
          <p className="text-[11px] text-cyan-300/80 leading-relaxed">
            By default, browsers enforce CORS restrictions. To allow NusaAgent in your browser to talk
            to your local Ollama instance, run:
          </p>
          <div className="bg-slate-950 rounded px-2.5 py-1 font-mono text-[11px] text-cyan-400 select-all border border-slate-800">
            OLLAMA_ORIGINS="*" ollama serve
          </div>
        </div>
      )}

      {/* Model Selector Section */}
      <ModelSelector
        models={models}
        selectedModelId={selectedModel}
        onSelectModel={(id) => setSelectedModel(id)}
        customModelId={customModel}
        onChangeCustomModel={(id) => setCustomModel(id)}
        isLoadingModels={isLoadingModels}
        onRefreshModels={() => loadModels(apiKey, baseUrl)}
      />

      {/* Default Provider Checkbox */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="isDefaultCheckbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
        />
        <label htmlFor="isDefaultCheckbox" className="text-xs text-slate-300 cursor-pointer">
          Set as default provider for new conversations and autonomous agents
        </label>
      </div>

      {/* Diagnostic & Test Result Feedback Banner */}
      {diagnostic && (
        <div
          className={`rounded-lg p-3.5 border text-xs space-y-2 ${
            diagnostic.status === "connected"
              ? "bg-emerald-950/20 border-emerald-800/50 text-emerald-200"
              : diagnostic.status === "quota_exceeded"
              ? "bg-amber-950/20 border-amber-800/50 text-amber-200"
              : "bg-rose-950/20 border-rose-800/50 text-rose-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              {diagnostic.status === "connected" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{diagnostic.headline}</span>
            </div>
            {testResult?.latencyMs !== undefined && testResult.latencyMs > 0 && (
              <span className="font-mono text-[11px] opacity-80">{testResult.latencyMs}ms</span>
            )}
          </div>

          <p className="text-[11px] opacity-90 leading-relaxed">{diagnostic.detail}</p>

          {diagnostic.troubleshooting && diagnostic.troubleshooting.length > 0 && (
            <div className="pt-1 border-t border-white/10 space-y-1">
              <span className="font-medium text-[11px] opacity-90">Recommendations:</span>
              <ul className="list-disc list-inside text-[11px] opacity-80 space-y-0.5">
                {diagnostic.troubleshooting.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {saveMessage && (
        <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-2.5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Actions: Test, Save, Delete */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <div>
          {onDelete && existingConfig && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to remove ${metadata.name} credentials?`)) {
                  onDelete(metadata.id);
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 px-3 py-2 rounded-lg border border-transparent hover:border-rose-900 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || (metadata.requiresApiKey && !apiKey.trim())}
            className="text-xs px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-slate-300" />
            )}
            <span>{isTesting ? "Testing..." : "Test Connection"}</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? "Saving..." : "Save Configuration"}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
