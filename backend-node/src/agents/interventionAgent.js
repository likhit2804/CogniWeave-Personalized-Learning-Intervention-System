import { invokeAgentStructured } from "../services/llmClient.js";
import { INTERVENTION_PROMPT } from "./prompts.js";
import { InterventionOutputSchema } from "./agentSchemas.js";

/**
 * Selects the best intervention strategy using an LLM.
 */
export async function intervene(state) {
  const { diagnosis, knowledge_base: kb, prior_interventions = [], retrieval_context = {} } = state;

  const concept = diagnosis.weakest_concept;
  const error_tag = diagnosis.top_error_tag;
  const misconception = diagnosis.misconception;

  // filter rules by concept
  const available_rules = (kb.interventions?.rules || []).filter(
    (r) => r.concept_id === concept
  );

  const context = {
    diagnosed_concept: concept,
    top_error_tag: error_tag,
    misconception,
    available_rules,
    graph_context: retrieval_context.graph_context || [],
    prior_interventions,
  };

  const userContent = `Context:\n${JSON.stringify(context, null, 2)}`;

  const result = await invokeAgentStructured({
    systemPrompt: INTERVENTION_PROMPT,
    userContent,
    responseSchema: InterventionOutputSchema,
  });

  state.selected_intervention = {
    concept,
    error_tag,
    strategy: result.strategy,
    activities: result.activities,
    why: result.why,
    estimated_sessions: result.estimated_sessions || 2,
  };
  state.trace.push({
    agent: "intervention-agent",
    message: `Selected intervention strategy '${result.strategy}'.`,
  });

  return state;
}
