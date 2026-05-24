/**
 * LLM client — wraps the Google Generative AI SDK for structured JSON output.
 *
 * Replaces both agents/llm.py (shared instance) and
 * backend/app/services/llm_client.py (factory function).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import settings from "../config.js";

const genAI = new GoogleGenerativeAI(settings.geminiApiKey || "mock-key-for-tests");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueModels(primaryModel, fallbackModels = settings.llmFallbackModels) {
  return [primaryModel, ...fallbackModels].filter(
    (modelName, index, arr) => modelName && arr.indexOf(modelName) === index
  );
}

function getErrorMessage(error) {
  return String(error?.message || "").toLowerCase();
}

function isTransientGeminiError(error) {
  const message = getErrorMessage(error);
  return (
    error?.status === 429 ||
    error?.status === 503 ||
    message.includes("fetch failed") ||
    message.includes("service unavailable") ||
    message.includes("temporarily unavailable")
  );
}

function isUnsupportedModelError(error) {
  const message = getErrorMessage(error);
  return (
    error?.status === 404 ||
    message.includes("model not found") ||
    message.includes("unsupported model") ||
    (message.includes("models/") && message.includes("not found"))
  );
}

function shouldTryFallbackModel(error) {
  return isTransientGeminiError(error) || isUnsupportedModelError(error);
}

/**
 * Returns a GenerativeModel configured with the given temperature.
 */
export function getLlm(
  temperature = 0.2,
  modelName = settings.llmModel,
  responseSchema = null
) {
  const generationConfig = {
    temperature,
    responseMimeType: "application/json",
  };
  if (responseSchema) {
    generationConfig.responseSchema = responseSchema;
  }

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}

/**
 * Shared model instance for agents (temperature 0, like agents/llm.py).
 */
export const agentLlm = genAI.getGenerativeModel({
  model: settings.agentModel,
  generationConfig: {
    temperature: 0,
    responseMimeType: "application/json",
  },
});

export function normalizeLlmError(error, modelName = settings.llmModel) {
  const retryInfo = error?.errorDetails?.find(
    (detail) => detail?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
  );
  const retryDelay = retryInfo?.retryDelay || null;
  const retrySeconds = retryDelay ? parseInt(retryDelay.replace(/s$/, ""), 10) : null;
  const isQuotaError = error?.status === 429;
  const isDemandSpike = error?.status === 503;
  const isTransientFailure = isTransientGeminiError(error);
  const isMissingModel = isUnsupportedModelError(error);
  const attemptedModels = Array.isArray(error?.attemptedModels) && error.attemptedModels.length
    ? error.attemptedModels
    : [error?.model || modelName].filter(Boolean);
  const attemptedSummary = attemptedModels.length > 1
    ? ` Tried models: ${attemptedModels.join(", ")}.`
    : "";

  if (isQuotaError) {
    return {
      status: 429,
      detail: `Quota exceeded for ${modelName}. Try again in ${retrySeconds ?? "a little while"} seconds or switch to a model with available RPM.${attemptedSummary}`,
      model: error?.model || modelName,
      attempted_models: attemptedModels,
      retry_after_seconds: Number.isFinite(retrySeconds) ? retrySeconds : null,
    };
  }

  if (isDemandSpike) {
    return {
      status: 503,
      detail: `The Gemini API is under high demand right now for ${error?.model || modelName}. Please retry shortly.${attemptedSummary}`,
      model: error?.model || modelName,
      attempted_models: attemptedModels,
      retry_after_seconds: Number.isFinite(retrySeconds) ? retrySeconds : null,
    };
  }

  if (isMissingModel) {
    return {
      status: 503,
      detail: `The configured Gemini model ${error?.model || modelName} is unavailable here. Try one of the fallback models instead.${attemptedSummary}`,
      model: error?.model || modelName,
      attempted_models: attemptedModels,
    };
  }

  if (isTransientFailure) {
    return {
      status: 503,
      detail: `Could not reach Gemini successfully for ${error?.model || modelName}. Please retry in a moment.${attemptedSummary}`,
      model: error?.model || modelName,
      attempted_models: attemptedModels,
      retry_after_seconds: Number.isFinite(retrySeconds) ? retrySeconds : null,
    };
  }

  return {
    status: error?.status || 500,
    detail: error?.message || "LLM request failed.",
    model: error?.model || modelName,
    attempted_models: attemptedModels,
  };
}

export async function invokeStructuredWithFallback({
  systemPrompt,
  userContent,
  temperature = 0.2,
  primaryModel = settings.llmModel,
  fallbackModels = settings.llmFallbackModels,
  max503Retries = settings.llm503Retries,
  responseSchema = null,
}) {
  const modelsToTry = uniqueModels(primaryModel, fallbackModels);
  const attemptedModels = [];
  let lastError = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= max503Retries + 1; attempt += 1) {
      try {
        attemptedModels.push(modelName);
        const model = getLlm(temperature, modelName, responseSchema);
        return await invokeStructured(model, systemPrompt, userContent);
      } catch (error) {
        lastError = error;

        if (error?.status === 503 && attempt <= max503Retries) {
          await sleep(settings.llmRetryBaseMs * attempt);
          continue;
        }

        if (shouldTryFallbackModel(error)) {
          break;
        }

        throw normalizeLlmError(
          {
            ...error,
            model: modelName,
            attemptedModels: uniqueModels(primaryModel, attemptedModels),
          },
          modelName
        );
      }
    }
  }

  throw normalizeLlmError(
    {
      ...(lastError || new Error("LLM request failed.")),
      status: lastError?.status || 503,
      model: lastError?.model || modelsToTry[modelsToTry.length - 1] || primaryModel,
      attemptedModels: uniqueModels(primaryModel, attemptedModels),
    },
    primaryModel
  );
}

export async function invokeAgentStructured({
  systemPrompt,
  userContent,
  responseSchema,
  fallbackModels = settings.llmFallbackModels,
  max503Retries = settings.llm503Retries,
}) {
  return invokeStructuredWithFallback({
    systemPrompt,
    userContent,
    responseSchema,
    temperature: 0,
    primaryModel: settings.agentModel,
    fallbackModels,
    max503Retries,
  });
}

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
