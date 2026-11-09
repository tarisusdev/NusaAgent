import React, { useState, useEffect } from "react";
import {
  X,
  Shield,
  Key,
  Lock,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  ConnectionTestResult,
  ProviderConfig,
  ProviderId,
} from "../../types/providers";
import { getAllProviders, getProviderMetadata } from "../../providers/registry";
import { ProviderList } from "../providers/ProviderList";
import { ProviderConfigForm } from "../providers/ProviderConfigForm";
import {
  deleteAllCredentials,
  exportBYOKConfiguration,
  CREDENTIAL_SECURITY_INFO,
  setActivePassphrase,
  getActivePassphrase,
} from "../../services/credential-store";
import { providerManager } from "../../services/provider-manager";

interface ProviderSettingsViewProps {
  onClose?: () => void;
  onProviderConfigUpdated?: () => void;
  initialProviderId?: ProviderId;
}

export const ProviderSettingsView: React.FC<ProviderSettingsViewProps> = ({
  onClose,
  onProviderConfigUpdated,
  initialProviderId = "gemini",
}) => {
  const providers = getAllProviders();
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(initialProviderId);
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);

  // Testing states
  const [testingProviderId, setTestingProviderId] = useState<ProviderId | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Security & Passphrase dialog states
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [customPassphraseInput, setCustomPassphraseInput] = useState(getActivePassphrase() || "");
  const [passphraseStatus, setPassphraseStatus] = useState<string | null>(null);

  // Export banner
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    loadConfigurations();
    const unsubscribe = providerManager.subscribe(() => {
      setConfigs(providerManager.getAllConfigs());
    });
    return unsubscribe;
  }, []);

  const loadConfigurations = () => {
    const list = providerManager.getAllConfigs();
    setConfigs(list);
  };

  const handleSelectProvider = (id: ProviderId) => {
    setSelectedProviderId(id);
    setTestResult(null);
  };

  const handleTestConnection = async (config: ProviderConfig): Promise<ConnectionTestResult> => {
    setTestingProviderId(config.providerId);
    try {
      const res = await providerManager.testConnection(config);
      setTestResult(res);
      return res;
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleSaveConfig = async (config: ProviderConfig) => {
    await providerManager.saveConfig(config);
    loadConfigurations();
    onProviderConfigUpdated?.();
  };

  const handleDeleteConfig = async (providerId: ProviderId) => {
    await providerManager.deleteConfig(providerId);
    loadConfigurations();
    onProviderConfigUpdated?.();
  };

  const handleDeleteAll = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete ALL stored credentials? This will wipe all encrypted API keys from browser IndexedDB."
      )
    ) {
      await providerManager.deleteAll();
      loadConfigurations();
      onProviderConfigUpdated?.();
      setExportNotice("All stored credentials have been wiped from browser storage.");
      setTimeout(() => setExportNotice(null), 4000);
    }
  };

  const handleExport = async () => {
    const jsonStr = await exportBYOKConfiguration(false);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nusaagent-byok-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice("Exported configuration (plaintext keys excluded for security).");
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleApplyPassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePassphrase(customPassphraseInput.trim() || undefined);
    providerManager.init(customPassphraseInput.trim() || undefined);
    setPassphraseStatus(
      customPassphraseInput.trim()
        ? "Custom passphrase applied. All credentials encrypted with PBKDF2."
        : "Using default browser-isolated device key."
    );
    setShowPassphraseModal(false);
    setTimeout(() => setPassphraseStatus(null), 4000);
  };

  const currentMeta = getProviderMetadata(selectedProviderId);
  const currentConfig = configs.find((c) => c.providerId === selectedProviderId);

  return (
    <div className="flex flex-col h-full bg-[#0d121d] text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-2xl max-w-5xl w-full mx-auto">
      {/* Top Header */}
      <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Bring Your Own Key (BYOK)</h2>
              <span className="text-[11px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" /> Zero Server Storage
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Configure your preferred AI providers. API keys stay exclusively on your device.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSecurityInfo(!showSecurityInfo)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Security Model</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPassphraseModal(true)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>{getActivePassphrase() ? "Passphrase: Set" : "Passphrase"}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Security Architecture Drawer / Info Notice */}
      {showSecurityInfo && (
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 space-y-2 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              NusaAgent Client-Side Credential Architecture
            </span>
            <button
              onClick={() => setShowSecurityInfo(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                Encryption & Storage
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Credentials are encrypted using {CREDENTIAL_SECURITY_INFO.encryptionStandard} with {CREDENTIAL_SECURITY_INFO.kdf} and persisted exclusively in IndexedDB.
              </p>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Zero Central Logging
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Requests are dispatched directly from your browser to AI provider endpoints. NusaAgent never proxies or logs your keys.
              </p>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-850">
            <span className="font-medium text-slate-300">Storage Limitations: </span>
            {CREDENTIAL_SECURITY_INFO.limitations.join(" ")}
          </div>
        </div>
      )}

      {exportNotice && (
        <div className="bg-blue-950/40 border-b border-blue-800/40 px-6 py-2 text-xs text-blue-300 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span>{exportNotice}</span>
        </div>
      )}

      {passphraseStatus && (
        <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-6 py-2 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{passphraseStatus}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex overflow-hidden min-h-[460px]">
        {/* Left Providers Selector Column */}
        <div className="w-72 bg-slate-950/50 p-4 border-r border-slate-800 shrink-0">
          <ProviderList
            providers={providers}
            configs={configs}
            selectedProviderId={selectedProviderId}
            onSelectProvider={handleSelectProvider}
            onQuickTest={handleTestConnection}
            testingProviderId={testingProviderId}
          />
        </div>

        {/* Right Configuration Form Column */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-900/30">
          <ProviderConfigForm
            metadata={currentMeta}
            existingConfig={currentConfig}
            onSave={handleSaveConfig}
            onDelete={handleDeleteConfig}
            onTest={handleTestConnection}
            isTesting={testingProviderId === selectedProviderId}
            testResult={testResult}
          />
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div className="px-6 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
            title="Download sanitized config JSON"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Configuration</span>
          </button>

          <span className="text-slate-700">|</span>

          <button
            type="button"
            onClick={handleDeleteAll}
            className="text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5"
            title="Permanently remove all credentials from this browser"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete All Credentials</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500">
          NusaAgent Phase 1 · Bring Your Own Key Architecture
        </div>
      </div>

      {/* Passphrase Setting Modal */}
      {showPassphraseModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Custom Credential Passphrase
              </h3>
              <button
                type="button"
                onClick={() => setShowPassphraseModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Optionally supply a master passphrase to derive the AES-GCM encryption key. If left blank, NusaAgent uses a local device-isolated key.
            </p>

            <form onSubmit={handleApplyPassphrase} className="space-y-3">
              <input
                type="password"
                value={customPassphraseInput}
                onChange={(e) => setCustomPassphraseInput(e.target.value)}
                placeholder="Enter custom passphrase (optional)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassphraseModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  Apply Passphrase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
