import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { RightPanel } from "./components/layout/RightPanel";
import { MessageItem } from "./components/chat/MessageItem";
import { MessageComposer } from "./components/chat/MessageComposer";
import { WelcomeHero } from "./components/chat/WelcomeHero";
import { ToolsModal } from "./components/modals/ToolsModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { BYOKModal } from "./components/modals/BYOKModal";
import { SetupBYOKModal } from "./components/modals/SetupBYOKModal";
import { DocumentationModal } from "./components/modals/DocumentationModal";
import {
  Conversation,
  Message,
  AgentModeId,
  AgentSettings,
  AgentExecutionState,
  AttachedFile,
  ToolCallItem,
} from "./types";
import { ProviderConfig } from "./types/providers";
import {
  getOrCreateSessionId,
  getStoredConversations,
  saveStoredConversation,
  deleteStoredConversation,
  getStoredMessages,
  saveStoredMessage,
  getStoredSettings,
  saveStoredSettings,
  clearAllLocalData,
  DEFAULT_SETTINGS,
  getStoredProviders,
  getActiveProviderConfig,
} from "./services/storage";
import { getProviderMetadata } from "./services/providers/registry";
import { providerManager } from "./services/provider-manager";
import { runClientChat, runClientAutonomousAgent } from "./services/agent/clientEngine";

export default function App() {
  const [sessionId, setSessionId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMode, setCurrentMode] = useState<AgentModeId>("general");
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);

  // BYOK Provider state
  const [activeProviderConfig, setActiveProviderConfig] = useState<ProviderConfig | null>(null);
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // Layout UI states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  // Execution states
  const [isGenerating, setIsGenerating] = useState(false);
  const [executionState, setExecutionState] = useState<AgentExecutionState>({
    isRunning: false,
    toolEvents: [],
    toolsUsed: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize session, providers, and load conversations
  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);

    async function init() {
      try {
        const storedSettings = await getStoredSettings();
        setSettings(storedSettings);

        // Initialize BYOK providerManager
        await providerManager.init();
        const activeProv = providerManager.getActiveConfig();
        setActiveProviderConfig(activeProv);

        // Check if any provider is configured
        const allProviders = providerManager.getAllConfigs();
        const hasConfigured = allProviders.some((p) => p.apiKey || p.providerId === "ollama");
        if (!hasConfigured) {
          setIsSetupModalOpen(true);
        }

        const convs = await getStoredConversations(id);
        setConversations(convs);

        if (convs.length > 0) {
          setActiveConversationId(convs[0].id);
          setCurrentMode(convs[0].mode || "general");
          const msgs = await getStoredMessages(convs[0].id);
          setMessages(msgs);
        } else {
          createNewConversation("general");
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }

    init();

    const unsubscribe = providerManager.subscribe(() => {
      setActiveProviderConfig(providerManager.getActiveConfig());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refreshActiveProvider = async () => {
    await providerManager.init();
    setActiveProviderConfig(providerManager.getActiveConfig());
  };

  // 2. Load messages whenever active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;

    getStoredMessages(activeConversationId).then((msgs) => {
      setMessages(msgs);
    });

    const activeConv = conversations.find((c) => c.id === activeConversationId);
    if (activeConv && activeConv.mode !== currentMode) {
      setCurrentMode(activeConv.mode);
    }
  }, [activeConversationId]);

  // 3. Auto-scroll to bottom of messages
  useEffect(() => {
    if (settings.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, executionState]);

  // 4. Keyboard shortcut: Ctrl+K / Cmd+K for new conversation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        createNewConversation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentMode, sessionId]);

  // Create a new conversation
  const createNewConversation = async (mode: AgentModeId = currentMode) => {
    const newId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newConv: Conversation = {
      id: newId,
      sessionId: sessionId || getOrCreateSessionId(),
      title: "New Task",
      mode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };

    await saveStoredConversation(newConv);
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
    setMessages([]);
    setExecutionState({
      isRunning: false,
      toolEvents: [],
      toolsUsed: [],
    });
  };

  // Delete conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteStoredConversation(convId);
    const updated = conversations.filter((c) => c.id !== convId);
    setConversations(updated);

    if (activeConversationId === convId) {
      if (updated.length > 0) {
        setActiveConversationId(updated[0].id);
      } else {
        createNewConversation();
      }
    }
  };

  // Switch agent mode
  const handleSelectMode = (mode: AgentModeId) => {
    setCurrentMode(mode);
    if (activeConversationId) {
      const active = conversations.find((c) => c.id === activeConversationId);
      if (active) {
        const updated = { ...active, mode, updatedAt: Date.now() };
        saveStoredConversation(updated);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? updated : c))
        );
      }
    }
  };

  // Stop generation / cancel active task
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setExecutionState((prev) => ({ ...prev, isRunning: false }));
  };

  // Core execution handler for sending prompts
  const handleSendMessage = async (
    text: string,
    isAgentMode: boolean,
    attachedFiles: AttachedFile[] = []
  ) => {
    if (!activeConversationId || isGenerating) return;

    // Check if active provider is configured
    if (!activeProviderConfig) {
      setIsBYOKModalOpen(true);
      return;
    }

    const providerMeta = getProviderMetadata(activeProviderConfig.providerId);
    if (providerMeta.requiresApiKey && !activeProviderConfig.apiKey) {
      setIsBYOKModalOpen(true);
      return;
    }

    let convId = activeConversationId;
    let currentConv = conversations.find((c) => c.id === convId);

    // If conversation title is default "New Task", rename it based on first message
    if (currentConv && currentConv.title === "New Task" && text.trim().length > 0) {
      const truncatedTitle = text.slice(0, 36) + (text.length > 36 ? "..." : "");
      const updatedConv = { ...currentConv, title: truncatedTitle, updatedAt: Date.now() };
      await saveStoredConversation(updatedConv);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? updatedConv : c))
      );
    }

    const userMessageId = `msg_${Date.now()}_u`;
    const userMessage: Message = {
      id: userMessageId,
      conversationId: convId,
      role: "user",
      content: text,
      timestamp: Date.now(),
      mode: currentMode,
      files: attachedFiles,
    };

    await saveStoredMessage(userMessage);
    setMessages((prev) => [...prev, userMessage]);

    const assistantMessageId = `msg_${Date.now()}_a`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      conversationId: convId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      mode: currentMode,
      isAgentRun: isAgentMode,
      toolCalls: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsGenerating(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (isAgentMode) {
      // --- AUTONOMOUS AGENT MODE ---
      setIsRightPanelOpen(true);
      const taskId = `task_${Date.now()}`;

      setExecutionState({
        taskId,
        isRunning: true,
        objective: text,
        mode: currentMode,
        toolEvents: [],
        toolsUsed: [],
        startTime: Date.now(),
      });

      const activeToolCalls: ToolCallItem[] = [];

      await runClientAutonomousAgent({
        taskId,
        objective: text,
        modeId: currentMode,
        attachedFiles,
        providerConfig: activeProviderConfig,
        maxIterations: settings.maxIterations,
        signal: abortController.signal,
        emit: (type: string, data: any) => {
          if (type === "plan_created") {
            setExecutionState((prev) => ({
              ...prev,
              plan: data.plan,
            }));
          } else if (type === "step_update") {
            setExecutionState((prev) => {
              if (!prev.plan) return prev;
              const steps = [...prev.plan.steps];
              if (steps[data.stepIndex]) {
                steps[data.stepIndex] = data.step;
              }
              return { ...prev, plan: { ...prev.plan, steps } };
            });
          } else if (type === "thinking") {
            setExecutionState((prev) => ({
              ...prev,
              thinkingMessage: data.message,
            }));
          } else if (type === "tool_call") {
            const toolItem: ToolCallItem = {
              id: data.callId || `tc_${Date.now()}`,
              toolName: data.toolName,
              args: data.args,
              timestamp: Date.now(),
            };
            activeToolCalls.push(toolItem);

            setExecutionState((prev) => ({
              ...prev,
              toolEvents: [...prev.toolEvents, toolItem],
              toolsUsed: Array.from(new Set([...prev.toolsUsed, data.toolName])),
            }));

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, toolCalls: [...activeToolCalls] }
                  : m
              )
            );
          } else if (type === "tool_result") {
            setExecutionState((prev) => {
              const updated = prev.toolEvents.map((t) =>
                t.toolName === data.toolName && !t.result
                  ? {
                      ...t,
                      result: data.result,
                      success: data.success,
                      executionTimeMs: data.executionTimeMs,
                    }
                  : t
              );
              return { ...prev, toolEvents: updated };
            });

            const last = activeToolCalls[activeToolCalls.length - 1];
            if (last) {
              last.result = data.result;
              last.success = data.success;
              last.executionTimeMs = data.executionTimeMs;
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, toolCalls: [...activeToolCalls] }
                  : m
              )
            );
          } else if (type === "final_chunk") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + data.text }
                  : m
              )
            );
          } else if (type === "agent_completed") {
            setExecutionState((prev) => ({
              ...prev,
              isRunning: false,
              durationMs: data.executionTimeMs,
            }));
          } else if (type === "agent_error") {
            setExecutionState((prev) => ({
              ...prev,
              isRunning: false,
              error: data.message,
            }));
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content || `⚠️ Error: ${data.message}`, isStreaming: false }
                  : m
              )
            );
          }
        },
      });

      setIsGenerating(false);
      setExecutionState((prev) => ({ ...prev, isRunning: false }));
      setMessages((prev) => {
        const final = prev.map((m) =>
          m.id === assistantMessageId ? { ...m, isStreaming: false } : m
        );
        const savedMsg = final.find((m) => m.id === assistantMessageId);
        if (savedMsg) saveStoredMessage(savedMsg);
        return final;
      });
    } else {
      // --- CHAT MODE ---
      const activeToolCalls: ToolCallItem[] = [];

      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await runClientChat({
        message: text,
        modeId: currentMode,
        history: chatHistory,
        attachedFiles,
        providerConfig: activeProviderConfig,
        signal: abortController.signal,
        onChunk: (chunk: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        },
        onToolCall: (tc: any) => {
          const item: ToolCallItem = {
            id: tc.id || `tc_${Date.now()}`,
            toolName: tc.name,
            args: tc.arguments,
            timestamp: Date.now(),
          };
          activeToolCalls.push(item);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, toolCalls: [...activeToolCalls] }
                : m
            )
          );
        },
        onToolResult: (tr: any) => {
          const last = activeToolCalls[activeToolCalls.length - 1];
          if (last) {
            last.result = tr.result;
            last.success = tr.success;
            last.executionTimeMs = tr.executionTimeMs;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, toolCalls: [...activeToolCalls] }
                : m
            )
          );
        },
        onError: (errMsg: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: m.content || `⚠️ Error: ${errMsg}`,
                    isStreaming: false,
                  }
                : m
            )
          );
        },
        onDone: () => {
          setIsGenerating(false);
          setMessages((prev) => {
            const final = prev.map((m) =>
              m.id === assistantMessageId ? { ...m, isStreaming: false } : m
            );
            const saved = final.find((m) => m.id === assistantMessageId);
            if (saved) saveStoredMessage(saved);
            return final;
          });
        },
      });
    }
  };

  const handleRegenerate = () => {
    if (messages.length < 2 || isGenerating) return;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      setMessages((prev) => prev.slice(0, prev.length - 1));
      handleSendMessage(
        lastUserMessage.content,
        lastUserMessage.isAgentRun || false,
        lastUserMessage.files || []
      );
    }
  };

  const activeProviderName = activeProviderConfig
    ? getProviderMetadata(activeProviderConfig.providerId).name
    : undefined;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0f17] text-slate-100">
      {/* Left Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewConversation={() => createNewConversation()}
        onDeleteConversation={handleDeleteConversation}
        currentMode={currentMode}
        onSelectMode={handleSelectMode}
        onOpenTools={() => setIsToolsModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenBYOK={() => setIsBYOKModalOpen(true)}
        onOpenDocs={() => setIsDocsModalOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        sessionId={sessionId}
      />

      {/* Center Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Workspace Top Header */}
        <Header
          currentMode={currentMode}
          onSelectMode={handleSelectMode}
          isRightPanelOpen={isRightPanelOpen}
          onToggleRightPanel={() => setIsRightPanelOpen((prev) => !prev)}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          isAgentRunning={executionState.isRunning}
          activeProviderConfig={activeProviderConfig}
          onOpenBYOK={() => setIsBYOKModalOpen(true)}
        />

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {messages.length === 0 ? (
            <WelcomeHero
              currentMode={currentMode}
              onSelectPrompt={(prompt, isAgent) =>
                handleSendMessage(prompt, isAgent, [])
              }
              onOpenBYOK={() => setIsBYOKModalOpen(true)}
              activeProviderName={activeProviderName}
            />
          ) : (
            <div className="py-2">
              {messages.map((msg, idx) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onRegenerate={handleRegenerate}
                  isLatestAssistant={
                    idx === messages.length - 1 && msg.role === "assistant"
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer Footer */}
        <MessageComposer
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          onStopGeneration={handleStop}
          initialAgentMode={false}
        />
      </div>

      {/* Right Panel: Agent Activity & Execution Inspector */}
      <RightPanel
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        executionState={executionState}
        onStopAgent={handleStop}
      />

      {/* BYOK Provider Configuration Modal */}
      <BYOKModal
        isOpen={isBYOKModalOpen}
        onClose={() => setIsBYOKModalOpen(false)}
        onProviderConfigUpdated={refreshActiveProvider}
        initialProviderId={activeProviderConfig?.providerId || "gemini"}
      />

      {/* First-Time Setup BYOK Onboarding Modal */}
      <SetupBYOKModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onConfigured={refreshActiveProvider}
      />

      {/* Tool Registry Modal */}
      <ToolsModal
        isOpen={isToolsModalOpen}
        onClose={() => setIsToolsModalOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          saveStoredSettings(newSettings);
        }}
        sessionId={sessionId}
        onOpenBYOK={() => setIsBYOKModalOpen(true)}
        onOpenDocs={() => setIsDocsModalOpen(true)}
        activeProviderName={activeProviderName}
        onClearAllData={async () => {
          await clearAllLocalData();
          setConversations([]);
          setMessages([]);
          setActiveProviderConfig(null);
          createNewConversation();
        }}
      />

      {/* Documentation & Architecture Modal */}
      <DocumentationModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
        onOpenBYOK={() => setIsBYOKModalOpen(true)}
      />
    </div>
  );
}
