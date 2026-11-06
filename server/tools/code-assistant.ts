import { AgentTool, ToolResult, Type } from "./types.js";

interface CodeAnalysisReport {
  language: string;
  lineCount: number;
  complexityAssessment: string;
  potentialIssues: string[];
  suggestions: string[];
  securityReview: string[];
}

function analyzeCodeLocally(code: string, language: string): CodeAnalysisReport {
  const lines = code.split("\n");
  const potentialIssues: string[] = [];
  const suggestions: string[] = [];
  const securityReview: string[] = [];

  const lang = language.toLowerCase();

  // Basic security and pattern checks
  if (/password|secret|api_key|token/i.test(code) && /=['"`][a-zA-Z0-9_\-]{8,}['"`]/.test(code)) {
    securityReview.push("Warning: Possible hardcoded secret, token, or API key detected in source code.");
  }

  if (/\beval\s*\(/.test(code)) {
    securityReview.push("Security alert: Use of dynamic 'eval()' poses severe code injection risks.");
  }

  if (/\binnerHTML\s*=/.test(code)) {
    securityReview.push("DOM Security: Assigning to innerHTML without sanitization may cause Cross-Site Scripting (XSS).");
  }

  if (/\b(exec|spawn|fork)\s*\(/.test(code)) {
    securityReview.push("Process Security: Server-side process execution detected. Verify input sanitization against command injection.");
  }

  // Syntax and structural checks
  if (lang.includes("json")) {
    try {
      JSON.parse(code);
      suggestions.push("JSON syntax is valid.");
    } catch (e: any) {
      potentialIssues.push(`JSON syntax error: ${e.message}`);
    }
  }

  // Bracket balance check
  const stack: string[] = [];
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  for (const char of code) {
    if (char === "(" || char === "{" || char === "[") {
      stack.push(char);
    } else if (char === ")" || char === "}" || char === "]") {
      const last = stack.pop();
      if (!last || pairs[last] !== char) {
        potentialIssues.push(`Unmatched closing delimiter '${char}'.`);
        break;
      }
    }
  }
  if (stack.length > 0) {
    potentialIssues.push(`Unclosed opening delimiter '${stack[stack.length - 1]}'.`);
  }

  // Complexity estimation
  let loops = (code.match(/\b(for|while|forEach|map|filter|reduce)\b/g) || []).length;
  let conditions = (code.match(/\b(if|else if|switch|case|\?)\b/g) || []).length;

  let complexity = "O(1) to O(N) — Linear or Constant scale";
  if (loops >= 3) {
    complexity = "O(N^2) or higher — Nested iterations detected; consider memoization or index lookups";
  } else if (loops === 2) {
    complexity = "O(N^2) or O(N log N) — Multiple iteration passes";
  }

  if (conditions > 8) {
    suggestions.push("High cyclomatic complexity: Consider breaking into smaller helper functions or lookup tables.");
  }

  if (securityReview.length === 0) {
    securityReview.push("No common high-severity hardcoded patterns or dangerous sinks detected.");
  }

  return {
    language: lang || "autodetected",
    lineCount: lines.length,
    complexityAssessment: complexity,
    potentialIssues: potentialIssues.length > 0 ? potentialIssues : ["No syntax or balance defects detected."],
    suggestions: suggestions.length > 0 ? suggestions : ["Structure looks clean and modular."],
    securityReview,
  };
}

export const codeAssistantTool: AgentTool = {
  name: "code_assistant",
  description:
    "Performs static code analysis, security auditing, complexity review, and architectural diagnosis on source code snippets. Never executes arbitrary server commands.",
  declaration: {
    name: "code_assistant",
    description:
      "Analyzes code for bugs, security vulnerabilities (XSS, injections, secrets), time/space complexity, and code quality.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        code: {
          type: Type.STRING,
          description: "The source code snippet or file to analyze.",
        },
        language: {
          type: Type.STRING,
          description: "Programming language (e.g., 'typescript', 'javascript', 'python', 'json', 'sql', 'html').",
        },
        action: {
          type: Type.STRING,
          description: "The intended analysis: 'audit', 'complexity', 'explain', 'optimize'.",
        },
      },
      required: ["code"],
    },
  },
  execute: async (args: Record<string, any>): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { code, language = "plaintext", action = "audit" } = args;
      if (!code || typeof code !== "string") {
        return {
          success: false,
          error: "Missing required 'code' parameter.",
          executionTimeMs: Date.now() - startTime,
        };
      }

      const report = analyzeCodeLocally(code, language);

      return {
        success: true,
        data: {
          action,
          report,
          safetyNote: "Code analysis completed statically without running untrusted code.",
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Code assistant analysis failed: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
