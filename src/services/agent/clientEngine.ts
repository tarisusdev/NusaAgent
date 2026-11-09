import {
  ChatMessageParam,
  ProviderConfig,
  ToolDefinitionParam,
} from "../../types/providers";
import { getProviderAdapter, getProviderMetadata } from "../providers/registry";
import {
  executeClientTool,
  getClientToolDeclarations,
  getStructuredActionInstructions,
} from "../tools/registry";
import { AgentModeId, PlanStepItem, AttachedFile } from "../../types";

export interface AgentEventEmitter {
  (eventType: string, payload: Record<string, any>): void;
}

const MODE_INSTRUCTIONS: Record<AgentModeId, { name: string; tools: string[]; prompt: string }> = {
  general: {
    name: "General Assistant",
    tools: ["calculator", "web_search", "web_fetch", "file_reader", "code_assistant"],
    prompt:
      "You are NusaAgent, an autonomous AI assistant. Answer accurately, verify mathematical calculations using the calculator tool, search the web when facts are needed, and provide structured markdown.",
  },
  research: {
    name: "Research Agent",
    tools: ["web_search", "web_fetch", "file_reader", "calculator"],
    prompt:
      "You are NusaAgent in Research Agent mode. Prioritize deep web search and web fetch to gather verified facts. Provide clear citations with markdown links [Title](URL) in your final synthesis.",
  },
  coding: {
    name: "Coding Agent",
    tools: ["code_assistant", "web_search", "web_fetch", "file_reader", "calculator"],
    prompt:
      "You are NusaAgent in Coding Agent mode. Act as a principal software engineer. Use code_assistant to audit code for security issues and Big-O complexity. Provide complete, runnable code blocks with language identifiers.",
  },
  writing: {
    name: "Writing Agent",
    tools: ["web_search", "web_fetch", "file_reader"],
    prompt:
      "You are NusaAgent in Writing Agent mode. Craft compelling, well-structured executive documentation, essays, and articles with crisp tone and zero fluff.",
  },
  data_analyst: {
    name: "Data Analyst",
    tools: ["calculator", "file_reader", "code_assistant", "web_search"],
    prompt:
      "You are NusaAgent in Data Analyst mode. NEVER guess numbers. ALWAYS use the calculator tool to compute exact percentages, growth rates, ratios, and statistics. Format findings in clean markdown tables.",
  },
};

/**
 * Detect structured action fallback blocks from plain text for models without native tool calling:
 * ```action
 * { "thought": "...", "action": "calculator", "args": { "expression": "..." } }
 * ```
 */
function extractStructuredAction(text: string): { action: string; args: Record<string, any> } | null {
  const match = text.match(/```(?:action|json)\s*\n([\s\S]*?)\n```/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.action && typeof parsed.action === "string") {
      return {
        action: parsed.action,
        args: parsed.args || {},
      };
    }
  } catch {
    // not a valid structured action
  }
  return null;
}

export async function runClientChat(params: {
  message: string;
  modeId: AgentModeId;
  history?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  attachedFiles?: AttachedFile[];
  providerConfig: ProviderConfig;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onToolCall?: (toolCall: any) => void;
  onToolResult?: (toolResult: any) => void;
  onError: (error: string) => void;
  onDone: () => void;
}): Promise<void> {
  const {
    message,
    modeId,
    history = [],
    attachedFiles = [],
    providerConfig,
    signal,
    onChunk,
    onToolCall,
    onToolResult,
    onError,
    onDone,
  } = params;

  const adapter = getProviderAdapter(providerConfig.providerId);
  const metadata = getProviderMetadata(providerConfig.providerId);
  const mode = MODE_INSTRUCTIONS[modeId] || MODE_INSTRUCTIONS.general;
  const toolDeclarations = getClientToolDeclarations(mode.tools);

  // Build context
  const fileContexts = attachedFiles
    .filter((f) => f.summary)
    .map((f) => `[Attached File: ${f.name}]\n${f.summary?.slice(0, 5000)}`)
    .join("\n\n");

  const fullUserPrompt = fileContexts ? `${fileContexts}\n\n${message}` : message;

  // Format messages
  const systemPrompt = metadata.supportsToolCalling
    ? mode.prompt
    : `${mode.prompt}\n\n${getStructuredActionInstructions(mode.tools)}`;

  const messages: ChatMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-8).map((h) => ({
      role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: h.content,
    })),
    { role: "user", content: fullUserPrompt },
  ];

  let accumulatedResponseText = "";
  let proposedToolCall: { id: string; name: string; arguments: Record<string, any> } | null = null;

  try {
    await adapter.chatStream(
      messages,
      metadata.supportsToolCalling ? toolDeclarations : [],
      providerConfig,
      {
        onChunk: (chunk) => {
          accumulatedResponseText += chunk;
          onChunk(chunk);
        },
        onToolCall: (tc) => {
          proposedToolCall = tc;
        },
        onError: (err) => {
          onError(err);
        },
      },
      signal
    );

    if (signal?.aborted) {
      onDone();
      return;
    }

    // Check for structured action fallback if no native tool call was proposed
    if (!proposedToolCall && !metadata.supportsToolCalling) {
      const fallbackAction = extractStructuredAction(accumulatedResponseText);
      if (fallbackAction) {
        proposedToolCall = {
          id: `call_${Date.now()}`,
          name: fallbackAction.action,
          arguments: fallbackAction.args,
        };
      }
    }

    // If tool was called, execute tool and do follow-up turn
    if (proposedToolCall) {
      const tc = proposedToolCall as { id: string; name: string; arguments: Record<string, any> };
      onToolCall?.(tc);

      const toolResult = await executeClientTool(tc.name, tc.arguments, { files: attachedFiles });

      onToolResult?.({
        toolName: tc.name,
        result: toolResult.data || toolResult.error,
        success: toolResult.success,
        executionTimeMs: toolResult.executionTimeMs,
      });

      if (signal?.aborted) {
        onDone();
        return;
      }

      // Add tool turn and request final answer
      messages.push({
        role: "assistant",
        content: accumulatedResponseText,
        toolCalls: [
          {
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          },
        ],
      });

      messages.push({
        role: "tool",
        toolCallId: tc.id,
        name: tc.name,
        content: JSON.stringify(toolResult.success ? toolResult.data : { error: toolResult.error }),
      });

      // Stream follow-up synthesis
      await adapter.chatStream(
        messages,
        [],
        providerConfig,
        {
          onChunk: (chunk) => {
            onChunk(chunk);
          },
          onError: (err) => {
            onError(err);
          },
        },
        signal
      );
    }

    onDone();
  } catch (err: any) {
    if (signal?.aborted) {
      onDone();
      return;
    }
    onError(err.message || "Chat request failed.");
  }
}

/**
 * Autonomous Agent Mode:
 * Multi-step goal planning, tool execution loop, and executive report.
 */
export async function runClientAutonomousAgent(params: {
  taskId: string;
  objective: string;
  modeId: AgentModeId;
  attachedFiles?: AttachedFile[];
  providerConfig: ProviderConfig;
  maxIterations?: number;
  signal?: AbortSignal;
  emit: AgentEventEmitter;
}): Promise<void> {
  const {
    taskId,
    objective,
    modeId,
    attachedFiles = [],
    providerConfig,
    maxIterations = 6,
    signal,
    emit,
  } = params;

  const startTime = Date.now();
  const adapter = getProviderAdapter(providerConfig.providerId);
  const metadata = getProviderMetadata(providerConfig.providerId);
  const mode = MODE_INSTRUCTIONS[modeId] || MODE_INSTRUCTIONS.general;
  const toolDeclarations = getClientToolDeclarations(mode.tools);

  emit("agent_start", {
    taskId,
    objective,
    mode: mode.name,
    provider: metadata.name,
    model: providerConfig.customModel || providerConfig.selectedModel,
    timestamp: startTime,
  });

  emit("status", { message: "Analyzing objective and formulating execution plan..." });

  // 1. Adaptive Task Planning Phase
  const lowerObj = objective.toLowerCase();
  let planSteps: PlanStepItem[];

  if (modeId === "research" || /research|search|latest|news|what is|find out|investigate/.test(lowerObj)) {
    planSteps = [
      {
        id: "step-1",
        title: "Search Web Information & Fact-Finding",
        description: "Query live web and news sources for recent verified findings",
        expectedTool: "web_search",
        status: "pending",
      },
      {
        id: "step-2",
        title: "Retrieve & Verify Source Content",
        description: "Extract readable text from authoritative pages with SSRF protection",
        expectedTool: "web_fetch",
        status: "pending",
      },
      {
        id: "step-3",
        title: "Synthesize Findings & Compile Citations",
        description: "Assemble comprehensive cited report with verifiable source URLs",
        status: "pending",
      },
    ];
  } else if (modeId === "coding" || /code|function|bug|audit|javascript|typescript|python|react/.test(lowerObj)) {
    planSteps = [
      {
        id: "step-1",
        title: "Static Security & Vulnerability Audit",
        description: "Inspect code patterns for injection sinks, hardcoded secrets, and syntax",
        expectedTool: "code_assistant",
        status: "pending",
      },
      {
        id: "step-2",
        title: "Algorithmic Complexity & Architecture Review",
        description: "Evaluate loop efficiency, Big-O bounds, and system modularity",
        status: "pending",
      },
      {
        id: "step-3",
        title: "Synthesize Engineering Recommendations",
        description: "Deliver production-ready drop-in code and architecture analysis",
        status: "pending",
      },
    ];
  } else if (modeId === "data_analyst" || /calculate|interest|math|formula|compound|percentage|sum|mean/.test(lowerObj)) {
    planSteps = [
      {
        id: "step-1",
        title: "Extract Numerical Parameters & Formulations",
        description: "Identify values, rates, durations, and mathematical relationships",
        status: "pending",
      },
      {
        id: "step-2",
        title: "Execute Verified Calculations",
        description: "Compute exact figures and step-by-step breakdown using the calculator engine",
        expectedTool: "calculator",
        status: "pending",
      },
      {
        id: "step-3",
        title: "Synthesize Quantitative Breakdown",
        description: "Format metrics into clear markdown tables and executive summary",
        status: "pending",
      },
    ];
  } else if (attachedFiles.length > 0 || /file|document|pdf|docx|contract|report/.test(lowerObj)) {
    planSteps = [
      {
        id: "step-1",
        title: "Extract Document Content & Metadata",
        description: "Read uploaded session files and parse full text representations",
        expectedTool: "file_reader",
        status: "pending",
      },
      {
        id: "step-2",
        title: "Inspect Key Insights & Data Points",
        description: "Evaluate core clauses, metrics, and quantitative findings",
        status: "pending",
      },
      {
        id: "step-3",
        title: "Synthesize Executive Summary",
        description: "Deliver structured analysis with key takeaways and conclusions",
        status: "pending",
      },
    ];
  } else {
    planSteps = [
      {
        id: "step-1",
        title: "Objective Scoping & Prerequisite Discovery",
        description: "Analyze goal and evaluate necessary facts or tools",
        status: "pending",
      },
      {
        id: "step-2",
        title: "Autonomous Tool Execution & Verification",
        description: "Invoke appropriate tools and verify real outputs",
        status: "pending",
      },
      {
        id: "step-3",
        title: "Compile Structured Executive Output",
        description: "Assemble comprehensive verified findings with citations",
        status: "pending",
      },
    ];
  }

  emit("plan_created", {
    plan: {
      objective,
      rationale: `Adaptive ${mode.name} execution plan tailored to objective parameters`,
      steps: planSteps,
    },
    objective,
  });

  const toolsUsed: string[] = [];
  let currentStepIdx = 0;
  let iteration = 0;
  let isDone = false;

  const systemPrompt = `${mode.prompt}
You are currently executing this user objective in AUTONOMOUS AGENT MODE:
"${objective}"

Instructions:
1. Progress step by step.
2. Call tools to compute numbers, search web sources, fetch documentation, or inspect files.
3. Once all actions are completed, synthesize a complete, highly structured Executive Report.
${!metadata.supportsToolCalling ? `\n${getStructuredActionInstructions(mode.tools)}` : ""}`;

  const conversation: ChatMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Please execute this objective: "${objective}"` },
  ];

  while (iteration < maxIterations && !isDone && !signal?.aborted) {
    iteration++;

    if (currentStepIdx < planSteps.length) {
      planSteps[currentStepIdx].status = "in_progress";
      emit("step_update", {
        stepIndex: currentStepIdx,
        step: planSteps[currentStepIdx],
      });
    }

    emit("thinking", {
      iteration,
      message: `Autonomous reasoning cycle ${iteration}/${maxIterations}...`,
    });

    let cycleChunkAccumulator = "";
    let cycleToolCall: { id: string; name: string; arguments: Record<string, any> } | null = null;

    await adapter.chatStream(
      conversation,
      metadata.supportsToolCalling ? toolDeclarations : [],
      providerConfig,
      {
        onChunk: (chunk) => {
          cycleChunkAccumulator += chunk;
        },
        onToolCall: (tc) => {
          cycleToolCall = tc;
        },
        onError: (err) => {
          emit("agent_error", { taskId, message: err });
        },
      },
      signal
    );

    if (signal?.aborted) break;

    // Check fallback structured action if no native tool call
    if (!cycleToolCall && !metadata.supportsToolCalling) {
      const fallback = extractStructuredAction(cycleChunkAccumulator);
      if (fallback) {
        cycleToolCall = {
          id: `call_${Date.now()}`,
          name: fallback.action,
          arguments: fallback.args,
        };
      }
    }

    if (cycleToolCall) {
      // Model executed a tool
      const tc = cycleToolCall as { id: string; name: string; arguments: Record<string, any> };
      if (!toolsUsed.includes(tc.name)) {
        toolsUsed.push(tc.name);
      }

      emit("tool_call", {
        stepIndex: currentStepIdx,
        toolName: tc.name,
        args: tc.arguments,
        callId: tc.id,
      });

      const toolResult = await executeClientTool(tc.name, tc.arguments, { files: attachedFiles });

      emit("tool_result", {
        stepIndex: currentStepIdx,
        toolName: tc.name,
        success: toolResult.success,
        result: toolResult.data || toolResult.error,
        executionTimeMs: toolResult.executionTimeMs,
      });

      // Update current step to completed
      if (currentStepIdx < planSteps.length) {
        planSteps[currentStepIdx].status = "completed";
        emit("step_update", {
          stepIndex: currentStepIdx,
          step: planSteps[currentStepIdx],
        });
        currentStepIdx++;
      }

      // Add to conversation history
      conversation.push({
        role: "assistant",
        content: cycleChunkAccumulator,
        toolCalls: [
          {
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          },
        ],
      });

      conversation.push({
        role: "tool",
        toolCallId: tc.id,
        name: tc.name,
        content: JSON.stringify(toolResult.success ? toolResult.data : { error: toolResult.error }),
      });
    } else {
      // Model produced final text without calling more tools!
      isDone = true;

      for (let i = currentStepIdx; i < planSteps.length; i++) {
        planSteps[i].status = "completed";
        emit("step_update", {
          stepIndex: i,
          step: planSteps[i],
        });
      }

      // Stream the final report
      emit("final_report_start", { title: "Executive Report" });

      const chunkSize = 40;
      for (let i = 0; i < cycleChunkAccumulator.length; i += chunkSize) {
        if (signal?.aborted) break;
        emit("final_chunk", { text: cycleChunkAccumulator.slice(i, i + chunkSize) });
        await new Promise((r) => setTimeout(r, 15));
      }

      emit("agent_completed", {
        taskId,
        objective,
        totalSteps: planSteps.length,
        toolsUsed,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });
      return;
    }
  }

  if (signal?.aborted) {
    emit("cancelled", { taskId, message: "Execution cancelled by user." });
    return;
  }

  // If reached loop limit, ask for summary
  conversation.push({
    role: "user",
    content: "Please synthesize all calculations and tool findings into your final report.",
  });

  emit("final_report_start", { title: "Executive Report" });

  await adapter.chatStream(
    conversation,
    [],
    providerConfig,
    {
      onChunk: (chunk) => {
        emit("final_chunk", { text: chunk });
      },
      onError: (err) => {
        emit("agent_error", { taskId, message: err });
      },
    },
    signal
  );

  emit("agent_completed", {
    taskId,
    objective,
    totalSteps: planSteps.length,
    toolsUsed,
    executionTimeMs: Date.now() - startTime,
    success: true,
  });
}
