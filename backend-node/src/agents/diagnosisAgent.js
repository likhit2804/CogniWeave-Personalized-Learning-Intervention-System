import { agentLlm, invokeStructured } from "../services/llmClient.js";
import { DIAGNOSER_PROMPT } from "./prompts.js";
import { DiagnosisOutputSchema } from "./agentSchemas.js";

/**
 * Diagnoses the student's weakest concept using an LLM.
 * Modifies and returns the state object.
 */
export async function diagnose(state) {
  const { attempts, knowledge_base: kb, profile } = state;

  const context = {
    profile,
    attempts,
    misconceptions_catalogue: kb.misconceptions?.items || [],
  };

  // Configure LLM to return data according to our schema
  const model = agentLlm;
  // Gemini SDK allows setting responseSchema on the generationConfig
  // but for simplicity and safety across versions, we just ensure the prompt specifies JSON
  // We'll update the config specifically for this call
  const configuredModel = {
    ...model,
    generationConfig: {
      ...model.generationConfig,
      responseSchema: DiagnosisOutputSchema,
    },
    generateContent: model.generateContent.bind(model),
  };

  const userContent = `Context:\n${JSON.stringify(context, null, 2)}`;
  
  const result = await invokeStructured(configuredModel, DIAGNOSER_PROMPT, userContent);

  // Find misconception from KB based on LLM label
  let misconception = null;
  if (result.misconception_label) {
    for (const item of kb.misconceptions?.items || []) {
      if (item.id === result.misconception_label || item.label === result.misconception_label) {
        misconception = item;
        break;
      }
    }
  }

  // Mutate state
  state.diagnosis = {
    weakest_concept: result.weakest_concept,
    top_error_tag: result.top_error_tag,
    misconception,
    evidence: {
      confidence: result.confidence,
      reasoning: result.reasoning,
      evidence_summary: result.evidence_summary,
    },
  };
  state.trace.push({
    agent: "diagnosis-agent",
    message: `Detected weakest concept '${result.weakest_concept}' (confidence: ${result.confidence}).`,
  });

  return state;
}
