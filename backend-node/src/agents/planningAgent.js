import { invokeAgentStructured } from "../services/llmClient.js";
import { PLANNER_PROMPT } from "./prompts.js";
import { PlannerOutputSchema } from "./agentSchemas.js";

/**
 * Builds a weekly study plan using an LLM.
 */
export async function plan(state) {
  const { profile, selected_intervention, critic_feedback } = state;

  const context = {
    available_hours_per_week: profile.available_hours_per_week || 6,
    upcoming_deadlines: profile.upcoming_deadlines || [],
    selected_intervention,
    critic_feedback,
  };

  const userContent = `Context:\n${JSON.stringify(context, null, 2)}`;

  const result = await invokeAgentStructured({
    systemPrompt: PLANNER_PROMPT,
    userContent,
    responseSchema: PlannerOutputSchema,
  });

  state.weekly_plan = result.weekly_plan || [];
  state.trace.push({
    agent: "planning-agent",
    message: `Built a ${state.weekly_plan.length}-session weekly plan.`,
  });

  return state;
}
