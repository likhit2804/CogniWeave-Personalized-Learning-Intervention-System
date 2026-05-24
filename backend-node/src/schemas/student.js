import { z } from "zod";

export const DeadlineSchema = z.object({
  label: z.string(),
  days_left: z.number().int(),
});

export const QuestionAttemptSchema = z.object({
  problem_id: z.string(),
  concept: z.string(),
  correct: z.boolean(),
  error_tags: z.array(z.string()).default([]),
  time_seconds: z.number().int().nullable().optional(),
  hints_used: z.number().int().default(0),
  retries: z.number().int().default(0),
});

export const MCQProblemSchema = z.object({
  id: z.string(),
  title: z.string(),
  concept_ids: z.array(z.string()).default([]),
  difficulty: z.string(),
  question_text: z.string(),
  options: z.record(z.string()),
  correct_option: z.string(),
  expected_error_tags: z.array(z.string()).default([]),
});

export const MCQSubmissionSchema = z.object({
  student_id: z.string(),
  problem_id: z.string(),
  selected_option: z.string(),
});

export const AssessmentStartRequestSchema = z.object({
  topic_id: z.string(),
  student_id: z.string().trim().optional(),
  goals: z.array(z.string()).default([]),
  available_hours_per_week: z.number().int().default(6),
});

export const AssessmentAnswerRequestSchema = z.object({
  session_id: z.string(),
  problem_id: z.string(),
  selected_option: z.string(),
  time_seconds: z.number().int().nullable().optional(),
});

export const AssessmentPlanRequestSchema = z.object({
  session_id: z.string(),
  student_id: z.string().trim().optional(),
  goals: z.array(z.string()).optional(),
  available_hours_per_week: z.number().int().optional(),
});

export const StudentProfileSchema = z.object({
  student_id: z.string(),
  subject: z.string(),
  goals: z.array(z.string()).default([]),
  available_hours_per_week: z.number().int().default(6),
  confidence_by_concept: z.record(z.number()).default({}),
  upcoming_deadlines: z.array(DeadlineSchema).default([]),
});

export const StudentSnapshotSchema = z.object({
  profile: StudentProfileSchema,
  attempts: z.array(QuestionAttemptSchema).default([]),
  prior_interventions: z.array(z.string()).default([]),
});

// --------------- Response Models ---------------

export const DiagnosisResultSchema = z.object({
  weakest_concept: z.string(),
  top_error_tag: z.string().nullable().optional(),
  misconception: z.any().nullable().optional(),
  evidence: z.any().default({}),
  confidence: z.number().default(1.0),
  reasoning: z.string().default(""),
  misconception_label: z.string().nullable().optional(),
  evidence_summary: z.string().default(""),
});

export const InterventionResultSchema = z.object({
  concept: z.string(),
  error_tag: z.string().nullable().optional(),
  strategy: z.string(),
  activities: z.array(z.string()).default([]),
  why: z.string().default(""),
  estimated_sessions: z.number().int().default(2),
});

export const WeeklyScheduleItemSchema = z.object({
  day: z.string(),
  focus: z.string(),
  minutes: z.number().int(),
  activity_type: z.string().default("review"),
});

export const EvaluationPlanSchema = z.object({
  concept: z.string(),
  success_signals: z.array(z.string()).default([]),
  recheck_after: z.string().default(""),
  replan_trigger: z.string().default(""),
  mastery_threshold: z.string().default(""),
});

export const TraceLogItemSchema = z.object({
  agent: z.string(),
  message: z.string(),
});

export const OrchestrationResponseSchema = z.object({
  profile: z.any(),
  diagnosis: DiagnosisResultSchema,
  selected_intervention: InterventionResultSchema,
  weekly_plan: z.array(WeeklyScheduleItemSchema),
  evaluation_plan: EvaluationPlanSchema,
  trace: z.array(TraceLogItemSchema),
  critic_iterations: z.number().int().default(0),
});
