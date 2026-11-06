import { ToolDefinitionParam } from "../../types/providers";
import { ClientAgentTool, ClientToolResult } from "./types";
import { clientCalculatorTool } from "./calculator";
import { clientCodeAssistantTool } from "./codeAssistant";
import { clientFileReaderTool } from "./fileReader";
import { clientWebSearchTool } from "./webSearch";
import { clientWebFetchTool } from "./webFetch";

const clientTools: ClientAgentTool[] = [
  clientCalculatorTool,
  clientWebSearchTool,
  clientWebFetchTool,
  clientFileReaderTool,
  clientCodeAssistantTool,
];

const toolMap = new Map<string, ClientAgentTool>();
for (const tool of clientTools) {
  toolMap.set(tool.name, tool);
}

export function getAllClientTools(): ClientAgentTool[] {
  return [...clientTools];
}

export function getClientToolByName(name: string): ClientAgentTool | undefined {
  return toolMap.get(name);
}

export function getClientToolDeclarations(allowedNames?: string[]): ToolDefinitionParam[] {
  const list = allowedNames
    ? clientTools.filter((t) => allowedNames.includes(t.name))
    : clientTools;
  return list.map((t) => t.declaration);
}

export async function executeClientTool(
  toolName: string,
  args: Record<string, any>,
  context?: any
): Promise<ClientToolResult> {
  const tool = toolMap.get(toolName);
  if (!tool) {
    return {
      success: false,
      error: `Tool '${toolName}' not found in NusaAgent client registry.`,
      executionTimeMs: 0,
    };
  }

  return await tool.execute(args, context);
}

/**
 * Structured Action Protocol Instructions for models without native tool calling support.
 */
export function getStructuredActionInstructions(allowedToolNames?: string[]): string {
  const tools = allowedToolNames
    ? clientTools.filter((t) => allowedToolNames.includes(t.name))
    : clientTools;

  const toolsDocs = tools
    .map(
      (t) =>
        `- \`${t.name}\`: ${t.description}\n  Schema: ${JSON.stringify(t.declaration.parameters)}`
    )
    .join("\n\n");

  return `You have access to the following real execution tools:

${toolsDocs}

If you need to invoke a tool, respond with ONLY a structured action JSON block enclosed in \`\`\`action\`\`\`:
\`\`\`action
{
  "thought": "Brief explanation of why this tool is needed",
  "action": "tool_name",
  "args": { ...arguments adhering strictly to the tool schema }
}
\`\`\`

When the tool result is provided back to you, inspect the result and continue your reasoning or provide your final synthesized response.`;
}
