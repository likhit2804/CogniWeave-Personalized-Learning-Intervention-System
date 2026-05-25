import { invokeAgentStructured } from "../services/llmClient.js";
import { DIAGNOSER_PROMPT } from "./prompts.js";
import { DiagnosisOutputSchema } from "./agentSchemas.js";

/**
 * Diagnoses the student's weakest concept using an LLM.
 * Modifies and returns the state object.
 */
export async function diagnose(state) {
  const { attempts, knowledge_base: kb, profile, retrieval_context = {} } = state;

  const context = {
    profile,
    attempts,
    misconceptions_catalogue: kb.misconceptions?.items || [],
    prerequisite_bottlenecks: retrieval_context.prerequisite_bottlenecks || [],
  };

  const userContent = `Context:\n${JSON.stringify(context, null, 2)}`;

  const result = await invokeAgentStructured({
    systemPrompt: DIAGNOSER_PROMPT,
    userContent,
    responseSchema: DiagnosisOutputSchema,
  });

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
