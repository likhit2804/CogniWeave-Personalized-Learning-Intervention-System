import { agentLlm, invokeStructured } from "../services/llmClient.js";
import { CRITIC_PROMPT } from "./prompts.js";
import { CriticOutputSchema } from "./agentSchemas.js";

/**
 * Custom critic node to review the planning node outputs using an LLM.
 */
export async function criticize(state) {
  const plan = state.weekly_plan;
  const intervention = state.selected_intervention;
  const profile = state.profile;
  const iterations = state.iteration_count || 0;

  // Don't loop forever - force approve if we hit 2 replans
  if (iterations >= 2) {
    state.critic_feedback = null;
    return state;
  }

  const context = {
    weekly_plan: plan,
    intervention_strategy: intervention,
    available_hours_per_week: profile.available_hours_per_week || 6,
  };

  const configuredModel = {
    ...agentLlm,
    generationConfig: {
      ...agentLlm.generationConfig,
      responseSchema: CriticOutputSchema,
    },
    generateContent: agentLlm.generateContent.bind(agentLlm),
  };

  const userContent = `Context:\n${JSON.stringify(context, null, 2)}`;
  
  const result = await invokeStructured(configuredModel, CRITIC_PROMPT, userContent);

  if (result.approved) {
    state.critic_feedback = null;
    state.trace.push({
      agent: "critic-agent",
      message: "Plan approved.",
    });
  } else {
    const feedback = `${result.feedback} Suggestions: ${(result.suggestions || []).join(", ")}`;
    state.critic_feedback = feedback;
    state.iteration_count = iterations + 1;
    state.trace.push({
      agent: "critic-agent",
      message: `Plan rejected: ${result.feedback}`,
    });
  }

  return state;
}
