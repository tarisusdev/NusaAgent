import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiClient, DEFAULT_MODEL } from "../gemini.js";
import { AgentModeConfig } from "./modes.js";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  expectedTool?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface ExecutionPlan {
  objective: string;
  steps: PlanStep[];
  rationale: string;
}

export async function createExecutionPlan(
  objective: string,
  modeConfig: AgentModeConfig,
  availableToolNames: string[],
  fileSummaries?: string[],
  modelName: string = DEFAULT_MODEL
): Promise<ExecutionPlan> {
  const ai = getGeminiClient();

  const prompt = `You are the Task Planner for NusaAgent (${modeConfig.name}).
A user has submitted the following objective:
"${objective}"

Available tools: ${availableToolNames.join(", ")}
${fileSummaries && fileSummaries.length > 0 ? `Uploaded session files:\n${fileSummaries.join("\n")}` : "No uploaded files."}

Your task:
Analyze this objective and construct an optimal, multi-step execution plan (2 to 5 distinct logical steps).
Assign expected tools to steps where appropriate (e.g., calculator for calculations, web_search for search, web_fetch for reading articles, file_reader for documents, code_assistant for code review).

Return valid JSON adhering strictly to this schema:
{
  "objective": "Concise summary of the user's objective",
  "rationale": "Why this multi-step approach was chosen",
  "steps": [
    {
      "id": "step-1",
      "title": "Short title (under 8 words)",
      "description": "What will be investigated, computed, or retrieved in this step",
      "expectedTool": "tool_name or empty"
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objective: { type: Type.STRING },
            rationale: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  expectedTool: { type: Type.STRING },
                },
                required: ["id", "title", "description"],
              },
            },
          },
          required: ["objective", "steps"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const steps: PlanStep[] = (parsed.steps || []).map((s: any, idx: number) => ({
      id: s.id || `step-${idx + 1}`,
      title: s.title || `Step ${idx + 1}`,
      description: s.description || "",
      expectedTool: s.expectedTool || undefined,
      status: "pending" as const,
    }));

    if (steps.length === 0) {
      steps.push({
        id: "step-1",
        title: "Analyze and resolve task",
        description: "Process user prompt and gather relevant information",
        status: "pending",
      });
    }

    return {
      objective: parsed.objective || objective,
      rationale: parsed.rationale || "Systematic step-by-step resolution",
      steps,
    };
  } catch (err) {
    console.warn("Planner fallback due to error:", err);
    // Graceful fallback plan if JSON generation encounters an issue
    return {
      objective,
      rationale: "Direct multi-stage investigation",
      steps: [
        {
          id: "step-1",
          title: "Information Gathering & Analysis",
          description: "Analyze query context and evaluate needed tools",
          status: "pending",
        },
        {
          id: "step-2",
          title: "Execute Actions & Compute Results",
          description: "Invoke appropriate tools and inspect outcomes",
          status: "pending",
        },
        {
          id: "step-3",
          title: "Synthesize Final Findings",
          description: "Combine all verified facts and present comprehensive response",
          status: "pending",
        },
      ],
    };
  }
}
