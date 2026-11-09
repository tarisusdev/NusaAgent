import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Play,
  Loader2,
  Check,
  Star,
  Settings,
  Shield,
  Layers,
} from "lucide-react";
import { ConnectionStatus, ProviderConfig, ProviderMetadata } from "../../types/providers";

interface ProviderCardProps {
  metadata: ProviderMetadata;
  config?: ProviderConfig;
  isActive: boolean;
  onSelect: () => void;
  onQuickTest?: () => void;
  isTesting?: boolean;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  metadata,
  config,
  isActive,
  onSelect,
  onQuickTest,
  isTesting = false,
}) => {
  const isConfigured = Boolean(
    config && (!metadata.requiresApiKey || (config.apiKey && config.apiKey.length > 0))
  );

  const status: ConnectionStatus = config?.connectionStatus || (isConfigured ? "connected" : "unconfigured");

  const getStatusBadge = () => {
    if (isTesting) {
      return (
        <span className="flex items-center gap-1 text-[11px] text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Testing...</span>
        </span>
      );
    }

    switch (status) {
      case "connected":
        return (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected</span>
            {config?.lastLatencyMs !== undefined && (
              <span className="text-[10px] text-emerald-300/70 font-mono">
                · {config.lastLatencyMs}ms
              </span>
            )}
          </span>
        );
      case "invalid_key":
        return (
          <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Invalid Key</span>
          </span>
        );
      case "quota_exceeded":
        return (
          <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Quota Exceeded</span>
          </span>
        );
      case "network_error":
        return (
          <span className="flex items-center gap-1 text-[11px] text-yellow-400 bg-yellow-950/40 px-2 py-0.5 rounded border border-yellow-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span>Network / CORS</span>
          </span>
        );
      case "unsupported_endpoint":
        return (
          <span className="flex items-center gap-1 text-[11px] text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span>404 Endpoint</span>
          </span>
        );
      case "unavailable":
        return (
          <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Unavailable</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>Not Configured</span>
          </span>
        );
    }
  };

  const selectedModel = config?.customModel || config?.selectedModel || metadata.defaultModels[0]?.id;

  return (
    <div
      onClick={onSelect}
      className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
        isActive
          ? "bg-slate-900 border-blue-500 shadow-md shadow-blue-500/10"
          : "bg-slate-950/70 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
            style={{
              backgroundColor: `${metadata.color}20`,
              color: metadata.color,
              border: `1px solid ${metadata.color}40`,
            }}
          >
            {metadata.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-200 text-sm group-hover:text-white transition-colors">
                {metadata.name}
              </span>
              {config?.isDefault && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30 flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-blue-400 text-blue-400" /> Default
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-1">{metadata.description}</p>
          </div>
        </div>

        {getStatusBadge()}
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate max-w-[200px]">
          <Layers className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="font-mono text-slate-300 truncate">{selectedModel}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {onQuickTest && isConfigured && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickTest();
              }}
              disabled={isTesting}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 border border-slate-700 disabled:opacity-50"
              title="Quick connection test"
            >
              <Play className="w-2.5 h-2.5 fill-slate-300" />
              <span>Test</span>
            </button>
          )}

          <div
            className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors ${
              isActive
                ? "bg-blue-600 border-blue-500 text-white"
                : "border-slate-700 bg-slate-900 group-hover:border-slate-600"
            }`}
          >
            {isActive && <Check className="w-2.5 h-2.5" />}
          </div>
        </div>
      </div>
    </div>
  );
};
