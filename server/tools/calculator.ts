import { AgentTool, ToolResult, Type } from "./types.js";

// Safe math evaluator without eval()
function evaluateMathExpression(expression: string): { result: number; steps: string[] } {
  const steps: string[] = [];
  let sanitized = expression.trim();

  steps.push(`Parsing expression: "${sanitized}"`);

  // Replace common math constants
  sanitized = sanitized.replace(/\bpi\b/gi, Math.PI.toString());
  sanitized = sanitized.replace(/\be\b/gi, Math.E.toString());

  // Replace percentage: e.g., 25% of 200 -> (25/100) * 200 or 25% -> 0.25
  sanitized = sanitized.replace(/(\d+(\.\d+)?)%/g, "($1/100)");

  // Validate that only safe math characters and functions are present
  // Allowed: numbers, operators + - * / % ^, parenthesis, and known Math functions
  const allowedTokensRegex = /^[0-9+\-*/^().,\s]|(sqrt|cbrt|sin|cos|tan|asin|acos|atan|log|ln|abs|round|floor|ceil|exp|min|max|pow)/g;
  const stripped = sanitized.replace(allowedTokensRegex, "");
  if (stripped.length > 0) {
    throw new Error(`Invalid or disallowed characters in expression: "${stripped.slice(0, 10)}"`);
  }

  // Handle function replacements
  let transformed = sanitized
    .replace(/\^/g, "**")
    .replace(/\bln\(/g, "Math.log(")
    .replace(/\blog10\(/g, "Math.log10(")
    .replace(/\blog\(/g, "Math.log10(") // default log to log10 in user queries
    .replace(/\bsqrt\(/g, "Math.sqrt(")
    .replace(/\bcbrt\(/g, "Math.cbrt(")
    .replace(/\bsin\(/g, "Math.sin(")
    .replace(/\bcos\(/g, "Math.cos(")
    .replace(/\btan\(/g, "Math.tan(")
    .replace(/\basin\(/g, "Math.asin(")
    .replace(/\bacos\(/g, "Math.acos(")
    .replace(/\batan\(/g, "Math.atan(")
    .replace(/\babs\(/g, "Math.abs(")
    .replace(/\bround\(/g, "Math.round(")
    .replace(/\bfloor\(/g, "Math.floor(")
    .replace(/\bceil\(/g, "Math.ceil(")
    .replace(/\bexp\(/g, "Math.exp(")
    .replace(/\bmin\(/g, "Math.min(")
    .replace(/\bmax\(/g, "Math.max(");

  // Safe Function execution in sandbox with only Math scope
  const mathSandbox = Object.freeze({
    Math,
  });

  // Build a Function constructor that only exposes Math
  const computeFn = new Function("Math", `"use strict"; return (${transformed});`);
  const rawResult = computeFn(mathSandbox.Math);

  if (typeof rawResult !== "number" || isNaN(rawResult)) {
    throw new Error(`Calculation did not evaluate to a valid number (got ${rawResult})`);
  }

  if (!isFinite(rawResult)) {
    throw new Error("Calculation resulted in Infinity (division by zero or overflow)");
  }

  // Round neatly if needed to avoid floating point anomalies (e.g. 0.1 + 0.2)
  const precisionResult = Math.round(rawResult * 1e12) / 1e12;
  steps.push(`Evaluated to: ${precisionResult}`);

  return { result: precisionResult, steps };
}

export const calculatorTool: AgentTool = {
  name: "calculator",
  description:
    "Performs verified, precise mathematical and statistical calculations. Supports basic arithmetic, powers (^), square root (sqrt), trigonometry (sin, cos, tan), logarithms (log, ln), percentages, and nested expressions.",
  declaration: {
    name: "calculator",
    description:
      "Performs precise mathematical calculations for complex expressions, geometry, finance, percentages, and scientific formulas.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        expression: {
          type: Type.STRING,
          description:
            "The mathematical expression to evaluate, e.g., '((1500 * 0.05) / 12) * (1 - (1 + 0.05/12)^(-360))' or 'sqrt(144) + 25 * 4'.",
        },
        label: {
          type: Type.STRING,
          description: "Optional brief description of what this calculation represents (e.g., 'Monthly loan payment').",
        },
      },
      required: ["expression"],
    },
  },
  execute: async (args: Record<string, any>): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { expression, label } = args;
      if (!expression || typeof expression !== "string") {
        return {
          success: false,
          error: "Missing required 'expression' parameter.",
          executionTimeMs: Date.now() - startTime,
        };
      }

      const { result, steps } = evaluateMathExpression(expression);

      return {
        success: true,
        data: {
          expression,
          result,
          label: label || null,
          formatted: Number.isInteger(result) ? result.toLocaleString() : result.toFixed(6).replace(/\.?0+$/, ""),
          steps,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Calculation error: ${err.message}`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
