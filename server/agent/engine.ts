import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { getGeminiClient, DEFAULT_MODEL } from "../gemini.js";
import { getModeConfig } from "./modes.js";
import { createExecutionPlan, ExecutionPlan, PlanStep } from "./planner.js";
import { getToolDeclarations, executeTool } from "../tools/registry.js";
import { getSessionFileById, getSessionFiles } from "../services/file-store.js";

export interface AgentEventEmitter {
  (eventType: string, payload: Record<string, any>): void;
}

export interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export async function runDirectChat(params: {
  sessionId: string;
  message: string;
  modeId: string;
  history?: ChatMessage[];
  fileIds?: string[];
  modelName?: string;
  signal?: AbortSignal;
  emit: AgentEventEmitter;
}): Promise<void> {
  const { sessionId, message, modeId, history = [], fileIds = [], modelName = DEFAULT_MODEL, signal, emit } = params;
  const ai = getGeminiClient();
  const mode = getModeConfig(modeId);
  const toolDeclarations = getToolDeclarations(mode.allowedTools);

  // Retrieve files and context
  const fileContexts: string[] = [];
  const imageParts: any[] = [];

  for (const fid of fileIds) {
    const file = getSessionFileById(sessionId, fid);
    if (file) {
      if (file.isImage && file.base64Data) {
        imageParts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.base64Data,
          },
        });
      } else if (file.extractedText) {
        fileContexts.push(`[File: ${file.originalName}]\n${file.extractedText.slice(0, 15000)}`);
      }
    }
  }

  // Build message contents for Gemini
  const contents: any[] = [];

  // Convert history
  for (const h of history.slice(-8)) {
    contents.push({
      role: h.role === "assistant" ? "model" : h.role,
      parts: [{ text: h.content }],
    });
  }

  // Current user turn with file context
  const userParts: any[] = [];
  if (fileContexts.length > 0) {
    userParts.push({ text: `Attached Document Context:\n${fileContexts.join("\n\n")}\n\n` });
  }
  for (const img of imageParts) {
    userParts.push(img);
  }
  userParts.push({ text: message });

  contents.push({
    role: "user",
    parts: userParts,
  });

  // Call Gemini with tools
  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: {
      systemInstruction: mode.systemInstruction,
      tools: [{ functionDeclarations: toolDeclarations }],
    },
  });

  if (signal?.aborted) return;

  const functionCalls = response.functionCalls;

  if (functionCalls && functionCalls.length > 0) {
    // Model proposed tool calls
    const toolResults: any[] = [];

    for (const call of functionCalls) {
      if (signal?.aborted) return;
      const toolName = call.name || "unknown";

      emit("tool_call", {
        toolName,
        args: call.args,
        callId: call.id || `call_${Date.now()}`,
      });

      const result = await executeTool(toolName, (call.args || {}) as Record<string, any>, {
        sessionId,
        signal,
      });

      emit("tool_result", {
        toolName,
        result: result.data || result.error,
        success: result.success,
        executionTimeMs: result.executionTimeMs,
      });

      toolResults.push({
        id: call.id,
        name: toolName,
        response: result.success ? result.data : { error: result.error },
      });
    }

    if (signal?.aborted) return;

    // Follow-up call with tool results
    const followUpContents = [
      ...contents,
      response.candidates?.[0]?.content,
      {
        role: "user",
        parts: toolResults.map((tr) => ({
          functionResponse: {
            id: tr.id,
            name: tr.name,
            response: tr.response,
          },
        })),
      },
    ];

    const streamResponse = await ai.models.generateContentStream({
      model: modelName,
      contents: followUpContents,
      config: {
        systemInstruction: mode.systemInstruction,
      },
    });

    for await (const chunk of streamResponse) {
      if (signal?.aborted) break;
      const text = (chunk as GenerateContentResponse).text;
      if (text) {
        emit("chunk", { text });
      }
    }
  } else {
    // If no tool call was needed, stream the generated response
    // If initial non-streaming had text, send it
    const directText = response.text || "";
    if (directText) {
      // Chunk it for smooth UI presentation
      const chunkSize = 40;
      for (let i = 0; i < directText.length; i += chunkSize) {
        if (signal?.aborted) break;
        emit("chunk", { text: directText.slice(i, i + chunkSize) });
        // Minimal delay to simulate natural stream cadence
        await new Promise((r) => setTimeout(r, 12));
      }
    }
  }

  emit("done", { complete: true });
}

export async function runAutonomousAgent(params: {
  sessionId: string;
  taskId: string;
  objective: string;
  modeId: string;
  fileIds?: string[];
  modelName?: string;
  signal?: AbortSignal;
  emit: AgentEventEmitter;
}): Promise<void> {
  const { sessionId, taskId, objective, modeId, fileIds = [], modelName = DEFAULT_MODEL, signal, emit } = params;
  const startTime = Date.now();
  const mode = getModeConfig(modeId);
  const toolDeclarations = getToolDeclarations(mode.allowedTools);

  emit("agent_start", {
    taskId,
    objective,
    mode: mode.name,
    timestamp: startTime,
  });

  // 1. Gather file intelligence
  const sessionFiles = getSessionFiles(sessionId);
  const fileSummaries = sessionFiles.map(
    (f) => `- ${f.originalName} (${f.mimeType}, ${(f.sizeBytes / 1024).toFixed(1)} KB): ${f.summary || "Attached document"}`
  );

  emit("status", { message: "Analyzing task objective and formulating execution strategy..." });

  // 2. Planning Phase
  const plan: ExecutionPlan = await createExecutionPlan(
    objective,
    mode,
    mode.allowedTools,
    fileSummaries,
    modelName
  );

  if (signal?.aborted) return;

  emit("plan_created", {
    plan,
    objective: plan.objective,
    rationale: plan.rationale,
  });

  // 3. Execution Phase
  const ai = getGeminiClient();
  const maxIterations = 6;
  let iteration = 0;
  const executionLogs: any[] = [];
  const toolsUsed: string[] = [];

  // Working state conversation with agent
  const agentHistory: any[] = [
    {
      role: "user",
      parts: [
        {
          text: `You are NusaAgent in Autonomous Mode (${mode.name}).
Your primary objective: "${objective}"

Execution Plan:
${plan.steps.map((s, i) => `${i + 1}. [${s.title}]: ${s.description}`).join("\n")}

Instructions:
1. Progress methodically through each step.
2. Select and invoke appropriate tools to perform real actions (web searches, calculation, reading documents, auditing code).
3. Inspect and verify tool results before taking next action.
4. When all necessary steps have been resolved, provide a structured, comprehensive, and professional Final Report.
Start by executing the first step.`,
        },
      ],
    },
  ];

  let currentStepIndex = 0;
  let isCompleted = false;

  while (iteration < maxIterations && !isCompleted && !signal?.aborted) {
    iteration++;

    // Mark current step as in progress
    if (currentStepIndex < plan.steps.length) {
      plan.steps[currentStepIndex].status = "in_progress";
      emit("step_update", {
        stepIndex: currentStepIndex,
        step: plan.steps[currentStepIndex],
      });
    }

    emit("thinking", {
      iteration,
      message: `Reasoning step ${iteration}/${maxIterations}...`,
    });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: agentHistory,
      config: {
        systemInstruction: `${mode.systemInstruction}\nYou are currently autonomously executing this user goal: "${objective}". Use tools to gather facts and execute tasks, and produce a stellar final report when complete.`,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    if (signal?.aborted) return;

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      // Model selected tools to execute
      const modelContent = response.candidates?.[0]?.content;
      agentHistory.push(modelContent);

      const toolResponses: any[] = [];

      for (const call of functionCalls) {
        if (signal?.aborted) return;
        const toolName = call.name || "unknown";

        if (!toolsUsed.includes(toolName)) {
          toolsUsed.push(toolName);
        }

        emit("tool_call", {
          stepIndex: currentStepIndex,
          toolName,
          args: call.args,
          callId: call.id,
        });

        const executionContext = {
          sessionId,
          taskId,
          signal,
        };

        const result = await executeTool(toolName, (call.args || {}) as Record<string, any>, executionContext);

        emit("tool_result", {
          stepIndex: currentStepIndex,
          toolName,
          success: result.success,
          result: result.data || result.error,
          executionTimeMs: result.executionTimeMs,
        });

        executionLogs.push({
          step: currentStepIndex,
          tool: toolName,
          args: call.args,
          result: result.data || result.error,
          success: result.success,
        });

        toolResponses.push({
          functionResponse: {
            id: call.id,
            name: toolName,
            response: result.success ? result.data : { error: result.error },
          },
        });
      }

      // Add tool responses back to history
      agentHistory.push({
        role: "user",
        parts: toolResponses,
      });

      // Mark current plan step as completed
      if (currentStepIndex < plan.steps.length) {
        plan.steps[currentStepIndex].status = "completed";
        emit("step_update", {
          stepIndex: currentStepIndex,
          step: plan.steps[currentStepIndex],
        });
        currentStepIndex++;
      }
    } else {
      // Model produced text without calling tools -> Task completed!
      isCompleted = true;
      const finalReport = response.text || "";

      // Mark any remaining steps as completed
      for (let i = currentStepIndex; i < plan.steps.length; i++) {
        plan.steps[i].status = "completed";
        emit("step_update", {
          stepIndex: i,
          step: plan.steps[i],
        });
      }

      emit("final_report_start", { title: "Executive Report" });

      // Stream the final report smoothly to client
      const chunkSize = 50;
      for (let i = 0; i < finalReport.length; i += chunkSize) {
        if (signal?.aborted) break;
        emit("final_chunk", { text: finalReport.slice(i, i + chunkSize) });
        await new Promise((r) => setTimeout(r, 15));
      }

      const totalTime = Date.now() - startTime;
      emit("agent_completed", {
        taskId,
        objective,
        totalSteps: plan.steps.length,
        toolsUsed,
        executionTimeMs: totalTime,
        success: true,
      });
      return;
    }
  }

  if (signal?.aborted) {
    emit("cancelled", { taskId, message: "Agent execution was cancelled by user." });
    return;
  }

  // If iteration limit reached without explicit completion, request summary
  emit("thinking", { iteration, message: "Synthesizing final findings..." });
  const finalPromptResponse = await ai.models.generateContent({
    model: modelName,
    contents: [
      ...agentHistory,
      {
        role: "user",
        parts: [
          {
            text: "Synthesize all the findings, calculations, and tool results gathered above into a final, comprehensive, structured report.",
          },
        ],
      },
    ],
    config: {
      systemInstruction: mode.systemInstruction,
    },
  });

  const finalReport = finalPromptResponse.text || "Task execution finished.";
  emit("final_report_start", { title: "Executive Report" });

  const chunkSize = 50;
  for (let i = 0; i < finalReport.length; i += chunkSize) {
    if (signal?.aborted) break;
    emit("final_chunk", { text: finalReport.slice(i, i + chunkSize) });
    await new Promise((r) => setTimeout(r, 15));
  }

  emit("agent_completed", {
    taskId,
    objective,
    totalSteps: plan.steps.length,
    toolsUsed,
    executionTimeMs: Date.now() - startTime,
    success: true,
  });
}
