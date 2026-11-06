import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Trash2,
  Download,
  Upload,
  Server,
  Zap,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import { ProviderConfig, ProviderId, ConnectionTestResult, ModelInfo } from "../../types/providers";
import {
  getAllProviders,
  getProviderAdapter,
  getProviderMetadata,
} from "../../services/providers/registry";
import {
  getStoredProviders,
  saveStoredProvider,
  deleteStoredProvider,
  setDefaultProvider,
  exportLocalConfiguration,
  importLocalConfiguration,
} from "../../services/storage";

interface BYOKModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderConfigUpdated: () => void;
  initialProviderId?: ProviderId;
}

export const BYOKModal: React.FC<BYOKModalProps> = ({
  isOpen,
  onClose,
  onProviderConfigUpdated,
  initialProviderId = "gemini",
}) => {
  const providers = getAllProviders();
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(initialProviderId);
  const [configuredProviders, setConfiguredProviders] = useState<ProviderConfig[]>([]);

  // Current editing form state
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // Testing & Status states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Export / Import
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProviders();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialProviderId) {
      setSelectedProviderId(initialProviderId);
    }
  }, [initialProviderId]);

  const loadProviders = async () => {
    try {
      const stored = await getStoredProviders();
      setConfiguredProviders(stored);
      populateFormForProvider(selectedProviderId, stored);
    } catch (err) {
      console.error("Failed to load stored provider configurations:", err);
    }
  };

  const populateFormForProvider = (pId: ProviderId, storedList = configuredProviders) => {
    const meta = getProviderMetadata(pId);
    const existing = storedList.find((p) => p.providerId === pId);

    if (existing) {
      setApiKey(existing.apiKey || "");
      setBaseUrl(existing.baseUrl || meta.defaultBaseUrl);
      setSelectedModel(existing.selectedModel || meta.defaultModels[0]?.id || "");
      setCustomModel(existing.customModel || "");
      setIsDefault(Boolean(existing.isDefault));
    } else {
      setApiKey("");
      setBaseUrl(meta.defaultBaseUrl);
      setSelectedModel(meta.defaultModels[0]?.id || "");
      setCustomModel("");
      setIsDefault(storedList.length === 0);
    }

    setTestResult(null);
    setSaveSuccess(false);
    setShowKey(false);

    // Fetch dynamic models if provider supports listing
    loadDynamicModels(pId, existing?.apiKey, existing?.baseUrl || meta.defaultBaseUrl);
  };

  const handleSelectProvider = (pId: ProviderId) => {
    setSelectedProviderId(pId);
    populateFormForProvider(pId);
  };

  const loadDynamicModels = async (pId: ProviderId, key?: string, url?: string) => {
    const adapter = getProviderAdapter(pId);
    if (!adapter.listModels) {
      setDynamicModels([]);
      return;
    }
    setIsLoadingModels(true);
    try {
      const models = await adapter.listModels({
        providerId: pId,
        apiKey: key,
        baseUrl: url,
        selectedModel: "",
      });
      setDynamicModels(models);
    } catch {
      setDynamicModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const adapter = getProviderAdapter(selectedProviderId);
    const configToTest: ProviderConfig = {
      providerId: selectedProviderId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      selectedModel: customModel.trim() || selectedModel,
    };

    try {
      const result = await adapter.testConnection(configToTest);
      setTestResult(result);
      if (result.success && adapter.listModels) {
        loadDynamicModels(selectedProviderId, apiKey.trim(), baseUrl.trim());
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err.message || "Failed to reach provider endpoint.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const finalConfig: ProviderConfig = {
      providerId: selectedProviderId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      selectedModel: selectedModel,
      customModel: customModel.trim(),
      isDefault,
    };

    try {
      await saveStoredProvider(finalConfig);
      if (isDefault) {
        await setDefaultProvider(selectedProviderId);
      }
      setSaveSuccess(true);
      await loadProviders();
      onProviderConfigUpdated();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove configuration and local credentials for ${currentMeta.name}?`)) return;
    await deleteStoredProvider(selectedProviderId);
    await loadProviders();
    populateFormForProvider(selectedProviderId);
    onProviderConfigUpdated();
  };

  const handleExport = async (includeKeys: boolean) => {
    const json = await exportLocalConfiguration(includeKeys);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nusaagent-byok-config${includeKeys ? "-with-keys" : ""}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice("Configuration exported successfully.");
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importLocalConfiguration(text);
      await loadProviders();
      onProviderConfigUpdated();
      setExportNotice(`Imported ${res.importedCount} provider configurations.`);
      setTimeout(() => setExportNotice(null), 3500);
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const currentMeta = getProviderMetadata(selectedProviderId);
  const isCurrentConfigured = configuredProviders.some(
    (p) => p.providerId === selectedProviderId && (p.apiKey || p.baseUrl)
  );

  const availableModels = dynamicModels.length > 0 ? dynamicModels : currentMeta.defaultModels;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl bg-[#0c111c] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Bring Your Own Key (BYOK)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                  Zero Server Storage
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Supply your own AI API keys. Never sent to any NusaAgent server.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Split View */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Providers Selector Sidebar */}
          <div className="w-full md:w-64 border-r border-white/[0.07] bg-black/30 p-3 overflow-y-auto space-y-1 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-2 block">
              Supported Providers ({providers.length})
            </span>

            {providers.map((p) => {
              const isSelected = selectedProviderId === p.id;
              const isConfigured = configuredProviders.some(
                (cp) => cp.providerId === p.id && (cp.apiKey || cp.baseUrl)
              );
              const isDefaultProv = configuredProviders.some(
                (cp) => cp.providerId === p.id && cp.isDefault
              );

              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectProvider(p.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition text-left ${
                    isSelected
                      ? "bg-indigo-600/20 border border-indigo-500/50 text-white font-medium"
                      : "text-slate-300 hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 bg-gradient-to-r ${p.color}`}
                    ></span>
                    <span className="truncate">{p.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isDefaultProv && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                        Default
                      </span>
                    )}
                    {isConfigured && !isDefaultProv && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    {p.isLocal && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/[0.06] text-slate-400">
                        Local
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Quick Export / Import in Sidebar */}
            <div className="pt-4 mt-4 border-t border-white/[0.06] space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 block">
                Backup & Restore
              </span>
              <button
                onClick={() => handleExport(false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Config (Safe)</span>
              </button>
              <label className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Import Config JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Right: Selected Provider Configuration Form */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {exportNotice && (
              <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{exportNotice}</span>
              </div>
            )}

            {/* Provider Header Banner */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{currentMeta.name}</h3>
                  {currentMeta.isLocal ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      Local Self-Hosted
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      Cloud Direct
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{currentMeta.description}</p>
              </div>

              {currentMeta.apiKeyHelpUrl && (
                <a
                  href={currentMeta.apiKeyHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium shrink-0 underline underline-offset-2"
                >
                  <span>Get API Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* API Key Input (if required) */}
            {currentMeta.requiresApiKey && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>API Key</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Encrypted with Web Crypto AES-GCM in IndexedDB
                  </span>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={currentMeta.apiKeyPlaceholder || "Enter your personal API key..."}
                    className="w-full bg-black/40 border border-white/[0.1] rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white transition"
                    title={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Base URL Configuration */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  <span>API Base URL</span>
                </label>
                {baseUrl !== currentMeta.defaultBaseUrl && (
                  <button
                    type="button"
                    onClick={() => setBaseUrl(currentMeta.defaultBaseUrl)}
                    className="text-[10px] text-indigo-400 hover:underline"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={currentMeta.defaultBaseUrl}
                className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Model Selection</span>
                </label>
                {isLoadingModels && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    Fetching provider models...
                  </span>
                )}
              </div>

              {/* Preset Model Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableModels.slice(0, 6).map((m) => {
                  const isModelActive = selectedModel === m.id && !customModel;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setCustomModel("");
                      }}
                      className={`p-2.5 rounded-xl border text-left transition text-xs ${
                        isModelActive
                          ? "bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm"
                          : "bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono font-bold truncate">{m.id}</span>
                        {isModelActive && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        {m.supportsTools && <span className="text-emerald-400">&bull; Tools</span>}
                        {m.supportsVision && <span className="text-sky-400">&bull; Vision</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Manual Custom Model ID Input */}
              <div className="pt-1">
                <label className="text-[11px] text-slate-400 block mb-1">
                  Or specify custom model ID:
                </label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g. gpt-4o-2024-11-20 or custom fine-tune"
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Set as Default Checkbox */}
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded accent-indigo-600 w-4 h-4 cursor-pointer"
              />
              <span>Set as active default provider for new conversations</span>
            </label>

            {/* Connection Test Status Banner */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-200"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    {testResult.success
                      ? `Connected (${testResult.latencyMs}ms)`
                      : "Connection Failed"}
                  </div>
                  <p className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-medium text-slate-200 transition"
                >
                  {isTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{isTesting ? "Testing Ping..." : "Test Connection"}</span>
                </button>

                {isCurrentConfigured && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Remove provider credentials"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white transition shadow-md ${
                  saveSuccess
                    ? "bg-emerald-600 shadow-emerald-600/20"
                    : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                }`}
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Shield className="w-3.5 h-3.5" />
                )}
                <span>{saveSuccess ? "Saved Locally!" : "Save & Encrypt"}</span>
              </button>
            </div>

            {/* Security Explanation Note */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05] text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Security Disclosure</span>
              </div>
              <p>
                API keys are encrypted via Web Crypto (AES-GCM 256-bit) and stored strictly in your
                browser's local IndexedDB. They are transmitted directly to the respective AI provider
                from your browser or local host. Browser-side encryption protects stored credentials on
                disk, but cannot guard against untrusted scripts in the same origin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
