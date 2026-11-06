export type AgentModeId = "general" | "research" | "coding" | "writing" | "data_analyst";

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  isImage?: boolean;
  pageCount?: number;
  summary?: string;
  uploadedAt?: number;
}

export interface ToolCallItem {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result?: any;
  success?: boolean;
  executionTimeMs?: number;
  timestamp: number;
}

export interface PlanStepItem {
  id: string;
  title: string;
  description: string;
  expectedTool?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface AgentExecutionState {
  taskId?: string;
  isRunning: boolean;
  objective?: string;
  mode?: string;
  plan?: {
    objective: string;
    rationale: string;
    steps: PlanStepItem[];
  };
  currentStepIndex?: number;
  thinkingMessage?: string;
  toolEvents: ToolCallItem[];
  startTime?: number;
  durationMs?: number;
  toolsUsed: string[];
  error?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  mode?: AgentModeId;
  isAgentRun?: boolean;
  taskId?: string;
  files?: AttachedFile[];
  toolCalls?: ToolCallItem[];
  plan?: {
    objective: string;
    rationale: string;
    steps: PlanStepItem[];
  };
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  sessionId: string;
  title: string;
  mode: AgentModeId;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessageSnippet?: string;
}

export interface AgentSettings {
  modelName: string;
  maxIterations: number;
  temperature: number;
  autoScroll: boolean;
}
