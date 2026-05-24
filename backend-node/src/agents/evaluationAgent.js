import { invokeAgentStructured } from "../services/llmClient.js";
import { EVALUATOR_PROMPT } from "./prompts.js";
import { EvaluationOutputSchema } from "./agentSchemas.js";

/**
 * Defines evaluation criteria using an LLM.
 */
export async function evaluate(state) {
  const { diagnosis, knowledge_base: kb } = state;

  const concept = diagnosis.weakest_concept;
  const misconception = diagnosis.misconception;

  const context = {
    diagnosed_concept: concept,
    misconception,
    evaluation_rules: (kb.evaluation_rules?.rules || []).filter((r) => r.concept_id === concept),
  };

  const userContent = `Context:\n${JSON.stringify(context, null, 2)}`;

  const result = await invokeAgentStructured({
    systemPrompt: EVALUATOR_PROMPT,
    userContent,
    responseSchema: EvaluationOutputSchema,
  });

  state.evaluation_plan = {
    concept,
    success_signals: result.success_signals,
    recheck_after: result.recheck_after,
    replan_trigger: result.replan_trigger,
    mastery_threshold: result.mastery_threshold,
  };

  state.trace.push({
    agent: "evaluation-agent",
    message: "Defined multi-signal evaluation criteria via LLM.",
  });

  return state;
}
