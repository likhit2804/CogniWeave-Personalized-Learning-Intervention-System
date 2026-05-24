/**
 * LLM client — wraps the Google Generative AI SDK for structured JSON output.
 *
 * Replaces both agents/llm.py (shared instance) and
 * backend/app/services/llm_client.py (factory function).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import settings from "../config.js";

const genAI = new GoogleGenerativeAI(settings.geminiApiKey || "mock-key-for-tests");

/**
 * Returns a GenerativeModel configured with the given temperature.
 */
export function getLlm(temperature = 0.2) {
  return genAI.getGenerativeModel({
    model: settings.llmModel,
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  });
}

/**
 * Shared model instance for agents (temperature 0, like agents/llm.py).
 */
export const agentLlm = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0,
    responseMimeType: "application/json",
  },
});

/**
 * Call the LLM with a system prompt + user content and parse JSON response.
 *
 * @param {import("@google/generative-ai").GenerativeModel} model
 * @param {string} systemPrompt - System instruction text
 * @param {string} userContent  - User message text
 * @returns {Promise<object>} Parsed JSON from the LLM response
 */
export async function invokeStructured(model, systemPrompt, userContent) {
  const result = await model.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: "user", parts: [{ text: userContent }] }],
  });

  const text = result.response.text();

  // Strip markdown fences if the model wraps them
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1];
  }

  return JSON.parse(cleaned);
}
