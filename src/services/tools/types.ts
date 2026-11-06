import { ToolDefinitionParam } from "../../types/providers";

export interface ClientToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs: number;
}

export interface ClientAgentTool {
  name: string;
  description: string;
  isLocal: boolean; // browser-local vs network-assisted
  declaration: ToolDefinitionParam;
  execute: (args: Record<string, any>, context?: any) => Promise<ClientToolResult>;
}
