import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  User,
  Wrench,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calculator,
  Search,
  Globe,
  Code,
  Terminal,
} from "lucide-react";
import { Message, ToolCallItem } from "../../types";

interface MessageItemProps {
  message: Message;
  onRegenerate?: () => void;
  isLatestAssistant?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onRegenerate,
  isLatestAssistant,
}) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleTool = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
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
        return <Code className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div
      className={`py-6 px-4 md:px-8 border-b border-white/[0.04] transition-colors ${
        isUser ? "bg-transparent" : "bg-[#0c111c]/60"
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-4 items-start">
        {/* Avatar */}
        <div className="shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/[0.1] flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 border border-indigo-400/30 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          {/* Header metadata */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">
                {isUser ? "You" : "NusaAgent"}
              </span>
              {message.isAgentRun && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/20">
                  AUTONOMOUS TASK
                </span>
              )}
              {message.mode && (
                <span className="text-[10px] text-slate-400 capitalize">
                  &bull; {message.mode.replace("_", " ")}
                </span>
              )}
            </div>

            {/* Actions for assistant */}
            {!isUser && !message.isStreaming && (
              <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition">
                <button
                  onClick={handleCopy}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                  title="Copy response"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {onRegenerate && isLatestAssistant && (
                  <button
                    onClick={onRegenerate}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                    title="Regenerate response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Attached Files (if user message) */}
          {message.files && message.files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.files.map((file) => (
                <div
                  key={file.id}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-slate-300"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="truncate max-w-[180px]">{file.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tool Calls Executed by Assistant */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-2 mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Backend Tools Executed ({message.toolCalls.length})
              </span>
              <div className="grid grid-cols-1 gap-2">
                {message.toolCalls.map((tc, idx) => {
                  const isExpanded = Boolean(expandedTools[tc.id || `${idx}`]);
                  return (
                    <div
                      key={tc.id || idx}
                      className="border border-white/[0.08] rounded-xl bg-black/30 overflow-hidden text-xs"
                    >
                      <button
                        onClick={() => toggleTool(tc.id || `${idx}`)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/[0.03] transition"
                      >
                        <div className="flex items-center gap-2">
                          {getToolIcon(tc.toolName)}
                          <span className="font-mono font-medium text-slate-200">
                            {tc.toolName}
                          </span>
                          {tc.executionTimeMs !== undefined && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {tc.executionTimeMs}ms
                            </span>
                          )}
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="text-[11px]">
                            {isExpanded ? "Hide Details" : "Inspect Payload"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 py-2.5 bg-black/50 border-t border-white/[0.05] space-y-2 font-mono text-[11px]">
                          <div>
                            <span className="text-slate-400 block mb-0.5">Arguments:</span>
                            <pre className="p-2 rounded bg-slate-950 text-indigo-200 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(tc.args, null, 2)}
                            </pre>
                          </div>
                          {tc.result && (
                            <div>
                              <span className="text-slate-400 block mb-0.5">Execution Result:</span>
                              <pre className="p-2 rounded bg-slate-950 text-emerald-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                                {JSON.stringify(tc.result, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Markdown Content */}
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match && !String(children).includes("\n");

                  if (isInline) {
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded bg-white/[0.08] text-indigo-300 font-mono text-[12px]"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  const codeContent = String(children).replace(/\n$/, "");
                  return (
                    <CodeBlock language={match ? match[1] : "text"} code={codeContent} />
                  );
                },
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 inline-flex items-center gap-1 font-medium"
                    >
                      <span>{children}</span>
                      <ExternalLink className="w-3 h-3 inline shrink-0 opacity-70" />
                    </a>
                  );
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-4 border border-white/[0.08] rounded-xl">
                      <table className="min-w-full divide-y divide-white/[0.08] text-xs">
                        {children}
                      </table>
                    </div>
                  );
                },
                th({ children }) {
                  return (
                    <th className="px-3 py-2 text-left font-semibold text-slate-200 bg-white/[0.04]">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="px-3 py-2 text-slate-300 border-t border-white/[0.04]">
                      {children}
                    </td>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Streaming cursor */}
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-indigo-400 animate-pulse align-middle"></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Syntax-highlighted and copyable code block
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-white/[0.08] bg-[#080c14] overflow-hidden text-xs">
      {/* Code block toolbar */}
      <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between text-slate-400">
        <span className="font-mono text-[11px] text-slate-300">{language}</span>
        <button
          onClick={copyCode}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/[0.08] hover:text-white transition text-[11px]"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="p-3.5 overflow-x-auto text-slate-200 font-mono leading-normal text-[12px]">
        <code>{code}</code>
      </pre>
    </div>
  );
};
