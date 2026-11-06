import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Default models
export const DEFAULT_MODEL = "gemini-3.8-flash";
export const ADVANCED_MODEL = "gemini-4-argon";

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server. Please check your environment variables.");
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export function isApiKeyConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
}
