import React, { useState } from "react";
import {
  X,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Terminal,
  Calculator,
  Search,
  Globe,
  FileText,
  Code2,
  Wrench,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Square,
  ShieldCheck,
} from "lucide-react";
import { AgentExecutionState, PlanStepItem, ToolCallItem } from "../../types";

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  executionState: AgentExecutionState;
  onStopAgent: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  isOpen,
  onClose,
  executionState,
  onStopAgent,
}) => {
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case "calculator":
        return <Calculator className="w-3.5 h-3.5 text-amber-400" />;
      case "web_search":
        return <Search className="w-3.5 h-3.5 text-blue-400" />;
      case "web_fetch":
        return <Globe className="w-3.5 h-3.5 text-emerald-400" />;
      case "file_reader":
        return <FileText className="w-3.5 h-3.5 text-purple-400" />;
      case "code_assistant":
        return <Code2 className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const hasActivity = Boolean(
    executionState.isRunning ||
      executionState.objective ||
      (executionState.plan && executionState.plan.steps.length > 0) ||
      executionState.toolEvents.length > 0
  );

  return (
    <aside className="w-80 lg:w-96 border-l border-white/[0.08] bg-[#090d16] flex flex-col h-full shrink-0 z-20 shadow-2xl transition-all">
      {/* Panel Header */}
      <div className="h-14 border-b border-white/[0.07] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Agent Activity
            </h2>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  executionState.isRunning
                    ? "bg-amber-400 animate-ping"
                    : hasActivity
                    ? "bg-emerald-400"
                    : "bg-slate-500"
                }`}
              ></span>
              <span className="text-[10px] text-slate-400 font-medium">
                {executionState.isRunning
                  ? "Orchestration in progress"
                  : hasActivity
                  ? "Task completed"
                  : "Standing by"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {executionState.isRunning && (
            <button
              onClick={onStopAgent}
              className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold transition"
              title="Cancel execution"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Cancel</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
            title="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasActivity ? (
          <>
            {/* Objective Box */}
            {executionState.objective && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Task Objective
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {executionState.objective}
                </p>
              </div>
            )}

            {/* Execution Plan Checklist */}
            {executionState.plan && executionState.plan.steps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Execution Plan ({executionState.plan.steps.length} Steps)
                  </span>
                  {executionState.plan.rationale && (
                    <span className="text-[10px] text-indigo-400 font-mono">
                      Adaptive
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {executionState.plan.steps.map((step, idx) => {
                    const isStepPending = step.status === "pending";
                    const isStepActive = step.status === "in_progress";
                    const isStepDone = step.status === "completed";
                    const isStepFailed = step.status === "failed";

                    return (
                      <div
                        key={step.id || idx}
                        className={`p-2.5 rounded-xl border transition-all text-xs ${
                          isStepActive
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                            : isStepDone
                            ? "bg-emerald-500/5 border-emerald-500/20 text-slate-300"
                            : isStepFailed
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                            : "bg-white/[0.02] border-white/[0.05] text-slate-400"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 shrink-0">
                            {isStepActive ? (
                              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                            ) : isStepDone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : isStepFailed ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex items-center justify-center text-[9px] font-mono text-slate-400">
                                {idx + 1}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold truncate">
                                {step.title}
                              </span>
                              {step.expectedTool && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/40 text-slate-400 shrink-0">
                                  {step.expectedTool}
                                </span>
                              )}
                            </div>
                            {step.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                                {step.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current Reasoning / Thinking State */}
            {executionState.thinkingMessage && executionState.isRunning && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2.5 text-xs text-indigo-300">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span className="font-mono text-[11px]">
                  {executionState.thinkingMessage}
                </span>
              </div>
            )}

            {/* Real-time Tool Events Timeline */}
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Live Tool Invocations ({executionState.toolEvents.length})
              </span>

              {executionState.toolEvents.length === 0 ? (
                <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] text-center text-xs text-slate-400">
                  {executionState.isRunning
                    ? "Formulating tool calls..."
                    : "No external tools were required for this task."}
                </div>
              ) : (
                <div className="space-y-2">
                  {executionState.toolEvents.map((event, idx) => {
                    const isExpanded = Boolean(expandedPayloads[event.id || `${idx}`]);
                    return (
                      <div
                        key={event.id || idx}
                        className="rounded-xl border border-white/[0.07] bg-black/30 overflow-hidden text-xs"
                      >
                        <button
                          onClick={() => togglePayload(event.id || `${idx}`)}
                          className="w-full p-2.5 flex items-center justify-between hover:bg-white/[0.03] transition text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {getToolIcon(event.toolName)}
                            <div className="truncate">
                              <span className="font-mono font-medium text-slate-200">
                                {event.toolName}
                              </span>
                              {event.executionTimeMs !== undefined && (
                                <span className="text-[10px] font-mono text-slate-400 ml-1.5">
                                  {event.executionTimeMs}ms
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                event.success !== false ? "bg-emerald-400" : "bg-rose-400"
                              }`}
                            ></span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </button>

                        {/* Collapsible raw input/output payload inspector */}
                        {isExpanded && (
                          <div className="p-2.5 bg-black/60 border-t border-white/[0.05] space-y-2 font-mono text-[10px]">
                            <div>
                              <span className="text-slate-400 block mb-0.5">Parameters:</span>
                              <pre className="p-2 rounded bg-slate-950 text-indigo-300 overflow-x-auto whitespace-pre-wrap max-h-36">
                                {JSON.stringify(event.args, null, 2)}
                              </pre>
                            </div>
                            {event.result && (
                              <div>
                                <span className="text-slate-400 block mb-0.5">Backend Result:</span>
                                <pre className="p-2 rounded bg-slate-950 text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-48">
                                  {JSON.stringify(event.result, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty / Idle State */
          <div className="py-8 px-2 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mx-auto flex items-center justify-center text-indigo-400 shadow-inner">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Autonomous Execution Engine
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Launch any complex query or workflow in <strong>Agent Mode</strong> to view
                real-time step planning, tool calls, and backend verification.
              </p>
            </div>

            {/* Architecture checklist */}
            <div className="pt-4 border-t border-white/[0.05] space-y-2 text-left">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Engine Capabilities
              </span>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 text-xs text-slate-300">
                <Calculator className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Verified mathematical computation</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 text-xs text-slate-300">
                <Search className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Live DuckDuckGo & Wikipedia search</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 text-xs text-slate-300">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>SSRF-protected safe web scraping</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 text-xs text-slate-300">
                <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                <span>PDF, DOCX & code file extraction</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Execution Summary Footer */}
      {hasActivity && (
        <div className="border-t border-white/[0.07] p-3 bg-black/40 text-xs">
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div>
              <span>Tools invoked:</span>{" "}
              <strong className="text-slate-200">{executionState.toolEvents.length}</strong>
            </div>
            <div>
              <span>Status:</span>{" "}
              <strong
                className={
                  executionState.isRunning
                    ? "text-amber-400"
                    : executionState.error
                    ? "text-rose-400"
                    : "text-emerald-400"
                }
              >
                {executionState.isRunning
                  ? "Running"
                  : executionState.error
                  ? "Error"
                  : "Complete"}
              </strong>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
