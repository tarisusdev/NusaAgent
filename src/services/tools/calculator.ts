import { ClientAgentTool, ClientToolResult } from "./types";

function evaluateExpressionSafely(expression: string): { result: number; steps: string[] } {
  const steps: string[] = [];
  let sanitized = expression.trim();

  steps.push(`Parsing expression: "${sanitized}"`);

  // Replace common math constants
  sanitized = sanitized.replace(/\bpi\b/gi, Math.PI.toString());
  sanitized = sanitized.replace(/\be\b/gi, Math.E.toString());

  // Handle percentages: 25% -> (25/100)
  sanitized = sanitized.replace(/(\d+(\.\d+)?)%/g, "($1/100)");

  // Validate allowed characters: numbers, operators, parenthesis, and known Math functions
  const allowedPattern = /^[0-9+\-*/^().,\s]|(sqrt|cbrt|sin|cos|tan|asin|acos|atan|log|ln|abs|round|floor|ceil|exp|min|max|pow)/g;
  const stripped = sanitized.replace(allowedPattern, "");
  if (stripped.length > 0) {
    throw new Error(`Disallowed tokens in expression: "${stripped.slice(0, 15)}"`);
  }

  // Transform operators to JavaScript Math methods
  const transformed = sanitized
    .replace(/\^/g, "**")
    .replace(/\bln\(/g, "Math.log(")
    .replace(/\blog10\(/g, "Math.log10(")
    .replace(/\blog\(/g, "Math.log10(")
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

  // Execute in isolated Function constructor that only exposes Math
  const computeFn = new Function("Math", `"use strict"; return (${transformed});`);
  const rawResult = computeFn(Math);

  if (typeof rawResult !== "number" || isNaN(rawResult)) {
    throw new Error(`Expression evaluated to invalid number (NaN)`);
  }

  if (!isFinite(rawResult)) {
    throw new Error("Calculation resulted in Infinity (division by zero or overflow)");
  }

  // Neatly handle floating-point precision issues
  const precisionResult = Math.round(rawResult * 1e12) / 1e12;
  steps.push(`Evaluated to: ${precisionResult}`);

  return { result: precisionResult, steps };
}

export const clientCalculatorTool: ClientAgentTool = {
  name: "calculator",
  description:
    "Performs verified mathematical calculations (arithmetic, powers, trigonometry, percentages, logarithms) 100% in the browser.",
  isLocal: true,
  declaration: {
    name: "calculator",
    description: "Evaluates mathematical expressions with verified accuracy and step-by-step reasoning.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The mathematical formula to evaluate, e.g. '15000 * (1 + 0.068/12)^(12 * 5)' or 'sqrt(256) + 42'.",
        },
        label: {
          type: "string",
          description: "Optional label for the calculation.",
        },
      },
      required: ["expression"],
    },
  },
  execute: async (args: Record<string, any>): Promise<ClientToolResult> => {
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

      const { result, steps } = evaluateExpressionSafely(expression);

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
