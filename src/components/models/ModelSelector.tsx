import React, { useState, useMemo } from "react";
import {
  Search,
  Check,
  Sparkles,
  RefreshCw,
  Cpu,
  Eye,
  Wrench,
  Zap,
  Layers,
  Edit3,
} from "lucide-react";
import { ModelInfo, ProviderCapabilities } from "../../types/providers";

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  customModelId?: string;
  onChangeCustomModel?: (customId: string) => void;
  isLoadingModels?: boolean;
  onRefreshModels?: () => void;
  providerCapabilities?: ProviderCapabilities;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  customModelId = "",
  onChangeCustomModel,
  isLoadingModels = false,
  onRefreshModels,
  providerCapabilities,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isManualMode, setIsManualMode] = useState(Boolean(customModelId));

  const formatContext = (tokens?: number) => {
    if (!tokens) return null;
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M ctx`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k ctx`;
    return `${tokens} ctx`;
  };

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const q = searchQuery.toLowerCase().trim();
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [models, searchQuery]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          Model Selection & Capabilities
        </label>
        <div className="flex items-center gap-2">
          {onRefreshModels && (
            <button
              type="button"
              onClick={onRefreshModels}
              disabled={isLoadingModels}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 hover:border-slate-600 disabled:opacity-50"
              title="Refresh models from provider endpoint"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingModels ? "animate-spin text-blue-400" : ""}`} />
              <span>{isLoadingModels ? "Loading..." : "Refresh"}</span>
            </button>
          )}

          {onChangeCustomModel && (
            <button
              type="button"
              onClick={() => {
                const next = !isManualMode;
                setIsManualMode(next);
                if (!next) {
                  onChangeCustomModel("");
                }
              }}
              className={`text-xs px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                isManualMode
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700"
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Manual Model ID</span>
            </button>
          )}
        </div>
      </div>

      {isManualMode ? (
        <div className="bg-slate-900/90 border border-blue-500/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-blue-400 font-medium">
            <span>Manual Model Override</span>
            <span className="text-[11px] text-slate-400">Overrides dropdown selection</span>
          </div>
          <input
            type="text"
            value={customModelId}
            onChange={(e) => onChangeCustomModel?.(e.target.value)}
            placeholder="e.g. gpt-4o-2024-11-20 or anthropic/claude-3.5-sonnet:beta"
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-[11px] text-slate-400">
            Enter any exact provider model string. NusaAgent will route requests directly to this model ID.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Search box */}
          {models.length > 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700"
              />
            </div>
          )}

          {/* Model Card Selector List */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {filteredModels.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500">
                No matching models found. Try searching or enter a manual model ID.
              </div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = selectedModelId === m.id && !customModelId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelectModel(m.id);
                      if (onChangeCustomModel) onChangeCustomModel("");
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-blue-950/30 border-blue-500/50 shadow-sm shadow-blue-500/10"
                        : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-medium truncate ${
                            isSelected ? "text-blue-300" : "text-slate-200"
                          }`}
                        >
                          {m.name}
                        </span>
                        {m.isPopular && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Popular
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono truncate">{m.id}</div>

                      {m.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1">{m.description}</p>
                      )}

                      {/* Capabilities pills */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-amber-400" /> Streaming
                        </span>

                        {m.supportsTools !== false && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1">
                            <Wrench className="w-2.5 h-2.5 text-emerald-400" /> Tools
                          </span>
                        )}

                        {m.supportsVision && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1">
                            <Eye className="w-2.5 h-2.5 text-violet-400" /> Vision
                          </span>
                        )}

                        {m.contextLength && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5 text-blue-400" /> {formatContext(m.contextLength)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-0.5">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors ${
                          isSelected
                            ? "bg-blue-600 border-blue-500 text-white"
                            : "border-slate-700 bg-slate-950"
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
