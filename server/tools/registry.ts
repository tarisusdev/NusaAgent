import { AgentTool, ToolExecutionContext, ToolResult } from "./types.js";
import { calculatorTool } from "./calculator.js";
import { webSearchTool } from "./web-search.js";
import { webFetchTool } from "./web-fetch.js";
import { fileReaderTool } from "./file-reader.js";
import { codeAssistantTool } from "./code-assistant.js";

const toolList: AgentTool[] = [
  calculatorTool,
  webSearchTool,
  webFetchTool,
  fileReaderTool,
  codeAssistantTool,
];

const toolMap = new Map<string, AgentTool>();
for (const tool of toolList) {
  toolMap.set(tool.name, tool);
}

export function getAllTools(): AgentTool[] {
  return [...toolList];
}

export function getToolByName(name: string): AgentTool | undefined {
  return toolMap.get(name);
}

export function getToolDeclarations(allowedToolNames?: string[]) {
  const tools = allowedToolNames
    ? toolList.filter((t) => allowedToolNames.includes(t.name))
    : toolList;

  return tools.map((t) => t.declaration);
}

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const tool = toolMap.get(toolName);
  if (!tool) {
    return {
      success: false,
      error: `Tool '${toolName}' not found in NusaAgent registry.`,
      executionTimeMs: 0,
    };
  }

  // Check cancellation signal before execution
  if (context.signal?.aborted) {
    return {
      success: false,
      error: "Execution was cancelled by the user.",
      executionTimeMs: 0,
    };
  }

  return await tool.execute(args, context);
}
