import React, { useState } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Settings,
  Wrench,
  Bot,
  BookOpen,
  Code2,
  PenTool,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Key,
} from "lucide-react";
import { Conversation, AgentModeId } from "../../types";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  currentMode: AgentModeId;
  onSelectMode: (mode: AgentModeId) => void;
  onOpenTools: () => void;
  onOpenSettings: () => void;
  onOpenBYOK: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  sessionId: string;
}

const MODE_ITEMS: Array<{ id: AgentModeId; name: string; icon: any; color: string }> = [
  { id: "general", name: "General Assistant", icon: Bot, color: "text-blue-400" },
  { id: "research", name: "Research Agent", icon: BookOpen, color: "text-emerald-400" },
  { id: "coding", name: "Coding Agent", icon: Code2, color: "text-amber-400" },
  { id: "writing", name: "Writing Agent", icon: PenTool, color: "text-purple-400" },
  { id: "data_analyst", name: "Data Analyst", icon: BarChart3, color: "text-cyan-400" },
];

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  currentMode,
  onSelectMode,
  onOpenTools,
  onOpenSettings,
  onOpenBYOK,
  isCollapsed,
  onToggleCollapse,
  sessionId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      className={`h-full border-r border-white/[0.08] bg-[#090d16] flex flex-col transition-all duration-300 relative z-30 shrink-0 ${
        isCollapsed ? "w-16" : "w-72"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-white/[0.07] px-4 flex items-center justify-between">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                NusaAgent
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                  HYBRID
                </span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium">Autonomous Agent Platform</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-400 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Collapse toggle button */}
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition hidden md:block"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* New Conversation Button */}
      <div className="p-3">
        <button
          onClick={onNewConversation}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition group`}
          title="New Conversation (Ctrl+K)"
        >
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
          {!isCollapsed && (
            <span className="flex items-center justify-between w-full">
              <span>New Conversation</span>
              <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-mono text-indigo-200">
                ⌘K
              </kbd>
            </span>
          )}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Search bar */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition"
              />
            </div>
          </div>

          {/* Modes List */}
          <div className="px-3 py-1.5 border-b border-white/[0.05]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1 block">
              Agent Modes
            </span>
            <div className="space-y-0.5">
              {MODE_ITEMS.map((item) => {
                const Icon = item.icon;
                const isSelected = currentMode === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectMode(item.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${
                      isSelected
                        ? "bg-indigo-500/15 text-indigo-200 font-medium border border-indigo-500/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {!isCollapsed && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 block">
            Recent Tasks ({filteredConversations.length})
          </span>
        )}

        {filteredConversations.length === 0 ? (
          !isCollapsed && (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400">No conversations found</p>
              <p className="text-[11px] text-slate-400 mt-1">Start a task or research session</p>
            </div>
          )
        ) : (
          filteredConversations.map((conv) => {
            const isActive = activeConversationId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${
                  isActive
                    ? "bg-white/[0.08] text-white font-medium border border-white/[0.08]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                }`}
                title={conv.title}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-indigo-400" : "text-slate-500"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{conv.title}</span>}
                </div>

                {!isCollapsed && (
                  <button
                    onClick={(e) => onDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Menu: BYOK, Tools, Settings, Anonymous Session Info */}
      <div className="border-t border-white/[0.07] p-2 space-y-1">
        <button
          onClick={onOpenBYOK}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition font-medium"
          title="BYOK Providers & Keys"
        >
          <Key className="w-4 h-4 text-indigo-400" />
          {!isCollapsed && <span>AI Providers (BYOK)</span>}
        </button>

        <button
          onClick={onOpenTools}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition"
          title="Tool Registry"
        >
          <Wrench className="w-4 h-4 text-slate-400" />
          {!isCollapsed && <span>Tool Registry (5)</span>}
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          {!isCollapsed && <span>Settings</span>}
        </button>

        {!isCollapsed && (
          <div className="pt-2 px-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Login-free &bull; {sessionId.slice(0, 14)}...</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
