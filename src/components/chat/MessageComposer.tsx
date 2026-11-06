import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Square,
  Paperclip,
  X,
  FileText,
  ImageIcon,
  Zap,
  MessageSquare,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AttachedFile } from "../../types";
import { uploadSessionFiles } from "../../services/api";

interface MessageComposerProps {
  onSendMessage: (text: string, isAgent: boolean, files: AttachedFile[]) => void;
  isGenerating: boolean;
  onStopGeneration: () => void;
  disabled?: boolean;
  initialAgentMode?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  isGenerating,
  onStopGeneration,
  disabled,
  initialAgentMode = false,
}) => {
  const [text, setText] = useState("");
  const [isAgentMode, setIsAgentMode] = useState(initialAgentMode);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  // Sync external mode changes if needed
  useEffect(() => {
    setIsAgentMode(initialAgentMode);
  }, [initialAgentMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && attachedFiles.length === 0) || isGenerating || isUploading) return;
    onSendMessage(text.trim(), isAgentMode, attachedFiles);
    setText("");
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const fileArray = Array.from(files);
      const uploaded = await uploadSessionFiles(fileArray);
      setAttachedFiles((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file(s).");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileSelect(e.dataTransfer.files);
    }
  };

  const isSendDisabled = (!text.trim() && attachedFiles.length === 0) || isGenerating || isUploading || disabled;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative max-w-3xl mx-auto w-full px-4 pb-4 pt-2 transition-all ${
        isDragging ? "ring-2 ring-indigo-500 rounded-2xl bg-indigo-500/5" : ""
      }`}
    >
      {/* Drag and drop overlay indicator */}
      {isDragging && (
        <div className="absolute inset-x-4 top-2 bottom-4 bg-indigo-950/80 backdrop-blur-sm border-2 border-dashed border-indigo-400 rounded-2xl z-30 flex flex-col items-center justify-center pointer-events-none">
          <FileText className="w-8 h-8 text-indigo-300 animate-bounce mb-2" />
          <p className="text-sm font-semibold text-white">Drop documents or images to attach</p>
          <p className="text-xs text-indigo-300">PDF, Word DOCX, TXT, CSV, JSON, PNG, JPG</p>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1320] shadow-xl shadow-black/40 overflow-hidden focus-within:border-indigo-500/50 transition">
        {/* Attached Files Strip */}
        {attachedFiles.length > 0 && (
          <div className="px-3 pt-3 pb-1 flex flex-wrap gap-2 border-b border-white/[0.04]">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-slate-200"
              >
                {file.isImage ? (
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(file.size / 1024).toFixed(0)}KB
                </span>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-0.5 rounded text-slate-400 hover:text-rose-400 transition"
                  title="Remove file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload Error Banner */}
        {uploadError && (
          <div className="px-3 py-1.5 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{uploadError}</span>
            </div>
            <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isAgentMode
              ? "Describe your objective for the autonomous agent (e.g. research a topic, calculate loan schedules, analyze attached code)..."
              : "Message NusaAgent... (Press Enter to send, Shift+Enter for newline)"
          }
          rows={1}
          disabled={disabled || isGenerating}
          className="w-full bg-transparent px-4 py-3 text-sm text-slate-100 placeholder-slate-400 focus:outline-none resize-none min-h-[52px] max-h-[200px]"
        />

        {/* Bottom Toolbar */}
        <div className="px-3 py-2 bg-white/[0.02] border-t border-white/[0.04] flex items-center justify-between">
          {/* Left: Mode switch & File attach */}
          <div className="flex items-center gap-2">
            {/* Mode Toggle Button */}
            <div className="flex items-center bg-black/40 border border-white/[0.08] p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setIsAgentMode(false)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition ${
                  !isAgentMode
                    ? "bg-white/[0.1] text-white font-medium shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Direct answers with tool assistance"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAgentMode(true)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition ${
                  isAgentMode
                    ? "bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Autonomous task execution, planning, and multi-step tool loops"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Agent Mode</span>
              </button>
            </div>

            {/* Attach File Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileSelect(e.target.files)}
              multiple
              accept=".pdf,.docx,.txt,.csv,.json,.js,.ts,.py,.md,.png,.jpg,.jpeg,.webp"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isGenerating}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition flex items-center gap-1 text-xs"
              title="Attach documents (PDF, DOCX, TXT, CSV) or images"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Attach</span>
            </button>
          </div>

          {/* Right: Character count & Send / Stop Button */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
              {text.length > 0 && `${text.length} chars`}
            </span>

            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold shadow-md shadow-rose-500/10 transition animate-pulse"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={isSendDisabled}
                className={`p-2 rounded-xl transition ${
                  isSendDisabled
                    ? "bg-white/[0.05] text-slate-400 cursor-not-allowed"
                    : isAgentMode
                    ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md shadow-amber-500/20 hover:from-amber-500 hover:to-amber-400"
                    : "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-indigo-400"
                }`}
                title="Send task"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
