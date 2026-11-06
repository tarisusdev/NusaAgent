import { ClientAgentTool, ClientToolResult } from "./types";

export const clientCodeAssistantTool: ClientAgentTool = {
  name: "code_assistant",
  description:
    "Performs browser-local static code analysis, security auditing, and algorithmic complexity review. Never executes code.",
  isLocal: true,
  declaration: {
    name: "code_assistant",
    description: "Analyzes code for bugs, security vulnerabilities, and algorithmic time/space complexity.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The source code snippet or function to analyze.",
        },
        language: {
          type: "string",
          description: "Programming language (e.g. 'typescript', 'javascript', 'python', 'json').",
        },
        action: {
          type: "string",
          description: "Analysis focus: 'audit', 'complexity', 'explain', 'optimize'.",
        },
      },
      required: ["code"],
    },
  },
  execute: async (args: Record<string, any>): Promise<ClientToolResult> => {
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

      const lines = code.split("\n");
      const securityIssues: string[] = [];
      const suggestions: string[] = [];

      // Security patterns
      if (/password|secret|api_key|token/i.test(code) && /=['"`][a-zA-Z0-9_\-]{8,}['"`]/.test(code)) {
        securityIssues.push("Hardcoded credential: Found probable hardcoded secret or API key token in source string.");
      }
      if (/\beval\s*\(/.test(code)) {
        securityIssues.push("Critical security risk: Dynamic eval() detected. Prone to arbitrary code injection.");
      }
      if (/\binnerHTML\s*=/.test(code)) {
        securityIssues.push("DOM Security: Assigning to innerHTML without sanitization risks Cross-Site Scripting (XSS).");
      }

      // Delimiter balance check
      const stack: string[] = [];
      const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
      for (const char of code) {
        if (char === "(" || char === "{" || char === "[") stack.push(char);
        else if (char === ")" || char === "}" || char === "]") {
          const last = stack.pop();
          if (!last || pairs[last] !== char) {
            suggestions.push(`Potential syntax error: Unmatched delimiter '${char}'`);
            break;
          }
        }
      }
      if (stack.length > 0) {
        suggestions.push(`Syntax warning: Unclosed delimiter '${stack[stack.length - 1]}'`);
      }

      // Complexity analysis
      const loops = (code.match(/\b(for|while|forEach|map|filter|reduce)\b/g) || []).length;
      let complexity = "O(1) to O(N) — Linear or constant";
      if (loops >= 3) complexity = "O(N^3) or higher — Deeply nested iteration loops detected.";
      else if (loops === 2) complexity = "O(N^2) — Quadratic complexity detected (nested loops).";

      return {
        success: true,
        data: {
          language,
          action,
          lineCount: lines.length,
          estimatedComplexity: complexity,
          securityIssues: securityIssues.length > 0 ? securityIssues : ["No common high-severity hardcoded patterns detected."],
          suggestions: suggestions.length > 0 ? suggestions : ["Code structure appears syntactically balanced."],
          executionNote: "Analyzed statically in browser sandbox without executing untrusted code.",
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Code assistant error: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
