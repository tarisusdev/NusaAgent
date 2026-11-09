import React, { useState } from "react";
import { Search, Shield, Zap } from "lucide-react";
import { ProviderConfig, ProviderId, ProviderMetadata } from "../../types/providers";
import { ProviderCard } from "./ProviderCard";

interface ProviderListProps {
  providers: ProviderMetadata[];
  configs: ProviderConfig[];
  selectedProviderId: ProviderId;
  onSelectProvider: (id: ProviderId) => void;
  onQuickTest?: (config: ProviderConfig) => void;
  testingProviderId?: ProviderId | null;
}

export const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  configs,
  selectedProviderId,
  onSelectProvider,
  onQuickTest,
  testingProviderId,
}) => {
  const [search, setSearch] = useState("");

  const filtered = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Available AI Providers
        </span>
        <span className="text-[11px] text-slate-400">
          {configs.filter((c) => c.apiKey || !providers.find((p) => p.id === c.providerId)?.requiresApiKey).length} / {providers.length} configured
        </span>
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter providers..."
          className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filtered.map((meta) => {
          const config = configs.find((c) => c.providerId === meta.id);
          return (
            <ProviderCard
              key={meta.id}
              metadata={meta}
              config={config}
              isActive={selectedProviderId === meta.id}
              onSelect={() => onSelectProvider(meta.id)}
              onQuickTest={
                onQuickTest && config
                  ? () => onQuickTest(config)
                  : undefined
              }
              isTesting={testingProviderId === meta.id}
            />
          );
        })}
      </div>
    </div>
  );
};
