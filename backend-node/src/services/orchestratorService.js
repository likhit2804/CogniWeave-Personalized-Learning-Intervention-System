import { KnowledgeBase } from "./knowledgeBase.js";
import { diagnose } from "../agents/diagnosisAgent.js";
import { intervene } from "../agents/interventionAgent.js";
import { plan } from "../agents/planningAgent.js";
import { evaluate } from "../agents/evaluationAgent.js";
import { criticize } from "../agents/criticAgent.js";
import {
  upsertStudent,
  recordAttempt,
  recordIntervention,
  updateMastery,
} from "./database.js";
import { upsertLearnerState, recordAttemptEvent } from "./mongoService.js";
import { buildQuestionGenerationContext } from "./retrievalService.js";

function _mapToResponse(finalState) {
  const diagnosis = finalState.diagnosis;
  const rawIntervention = finalState.selected_intervention;
  
  const intervention = {
    concept: rawIntervention.concept || rawIntervention.concept_id || "unknown",
    error_tag: rawIntervention.error_tag || rawIntervention.misconception_id || null,
    strategy: rawIntervention.strategy || "Targeted review",
    activities: rawIntervention.activities || [],
    why: rawIntervention.why || `Matched misconception '${rawIntervention.misconception_id || "N/A"}'`,
    estimated_sessions: rawIntervention.estimated_sessions || 2,
  };

  return {
    profile: finalState.profile,
    diagnosis,
    selected_intervention: intervention,
    weekly_plan: finalState.weekly_plan || [],
    evaluation_plan: finalState.evaluation_plan || {},
    trace: finalState.trace || [],
    critic_iterations: finalState.iteration_count || 0,
  };
}

export class OrchestratorService {
  /**
   * Coordinates the agent pipeline for a single student snapshot.
   */
  async run(snapshot) {
    if (!snapshot.attempts || snapshot.attempts.length === 0) {
      throw {
        status: 409,
        detail: "A fresh learner needs an initial assessment before the planner can diagnose anything.",
        requires_initial_assessment: true,
      };
    }

    const kb = new KnowledgeBase(snapshot.profile.subject);
    const fallbackConcepts = [...new Set((snapshot.attempts || []).map((a) => a.concept).filter(Boolean))];
    const retrievalContext = await buildQuestionGenerationContext(
      snapshot.profile.student_id,
      fallbackConcepts
    );

    // 1. Create Initial State
    let state = {
      profile: snapshot.profile,
      attempts: snapshot.attempts || [],
      prior_interventions: snapshot.prior_interventions || [],
      knowledge_base: {
        manifest: kb.manifest,
        concepts: kb.concepts,
        misconceptions: kb.misconceptions,
        interventions: kb.interventions,
        problems: kb.problems,
        evaluation_rules: kb.evaluationRules,
      },
      diagnosis: {},
      selected_intervention: {},
      weekly_plan: [],
      evaluation_plan: {},
      retrieval_context: retrievalContext,
      trace: [],
      critic_feedback: null,
      iteration_count: 0,
    };

    // 2. Run Engine (Replacing LangGraph with a standard loop)
    state = await diagnose(state);
    state = await intervene(state);

    while (true) {
      state = await plan(state);
      state = await evaluate(state);
      state = await criticize(state);
      
      if (state.critic_feedback === null) {
        break; // Plan approved or iteration limit reached
      }
      // Replan branch: loops back to plan() since critic_feedback is set
    }

    // 3. Map to validated response model
    const response = _mapToResponse(state);
    response.retrieval_context = retrievalContext;

    // 4. Persist to database (best-effort)
    await this._persist(snapshot, response);

    return response;
  }

  async _persist(snapshot, response) {
    try {
      const { profile, attempts = [] } = snapshot;
      
      // Save student profile
      upsertStudent(
        profile.student_id,
        profile.subject,
        profile.available_hours_per_week || 6
      );

      // Save each attempt
      for (const attempt of attempts) {
        recordAttempt({
          studentId: profile.student_id,
          problemId: attempt.problem_id,
          concept: attempt.concept,
          correct: attempt.correct,
          errorTags: attempt.error_tags,
          timeSeconds: attempt.time_seconds,
          hintsUsed: attempt.hints_used,
          retries: attempt.retries,
        });
      }

      const mastery = profile.confidence_by_concept || {};
      for (const [concept, confidence] of Object.entries(mastery)) {
        updateMastery(profile.student_id, concept, confidence);
      }
      const weakConcepts = Object.entries(mastery)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5)
        .map(([concept]) => concept);
      await upsertLearnerState({
        studentId: profile.student_id,
        profile,
        confidenceByConcept: mastery,
        weakConcepts,
      });

      // Save the intervention
      if (response.selected_intervention) {
        recordIntervention({
          studentId: profile.student_id,
          concept: response.selected_intervention.concept,
          strategy: response.selected_intervention.strategy,
        });
      }

      for (const attempt of attempts) {
        await recordAttemptEvent({
          student_id: profile.student_id,
          problem_id: attempt.problem_id,
          concept: attempt.concept,
          correct: Boolean(attempt.correct),
          error_tags: attempt.error_tags || [],
          time_seconds: attempt.time_seconds ?? null,
        });
      }
    } catch (error) {
      console.warn("Failed to persist orchestration results to database:", error);
    }
  }
}
