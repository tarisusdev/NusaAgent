import { FunctionDeclaration, Type } from "@google/genai";

export { Type };

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs: number;
}

export interface AgentTool {
  name: string;
  description: string;
  declaration: FunctionDeclaration;
  execute: (args: Record<string, any>, context?: ToolExecutionContext) => Promise<ToolResult>;
}

export interface ToolExecutionContext {
  sessionId: string;
  taskId?: string;
  signal?: AbortSignal;
}
