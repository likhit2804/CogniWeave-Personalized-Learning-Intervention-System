/**
 * We don't actually need Zod schemas to enforce structured output from Gemini directly
 * (Gemini relies on the prompt telling it to return JSON, or we can use JSON schema in the API config).
 * However, we will declare the JSON schema objects here so we can pass them to Gemini's responseSchema.
 */

import { SchemaType } from "@google/generative-ai";

export const DiagnosisOutputSchema = {
  type: SchemaType.OBJECT,
  properties: {
    weakest_concept: { type: SchemaType.STRING },
    top_error_tag: { type: SchemaType.STRING, nullable: true },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
    misconception_label: { type: SchemaType.STRING, nullable: true },
    evidence_summary: { type: SchemaType.STRING },
  },
  required: ["weakest_concept", "confidence", "reasoning", "evidence_summary"],
};

export const InterventionOutputSchema = {
  type: SchemaType.OBJECT,
  properties: {
    strategy: { type: SchemaType.STRING },
    activities: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    why: { type: SchemaType.STRING },
    estimated_sessions: { type: SchemaType.INTEGER },
  },
  required: ["strategy", "activities", "why"],
};

export const TutoringBlockSchema = {
  type: SchemaType.OBJECT,
  properties: {
    day: { type: SchemaType.STRING },
    focus: { type: SchemaType.STRING },
    minutes: { type: SchemaType.INTEGER },
    activity_type: { type: SchemaType.STRING },
  },
  required: ["day", "focus", "minutes", "activity_type"],
};

export const PlannerOutputSchema = {
  type: SchemaType.OBJECT,
  properties: {
    weekly_plan: {
      type: SchemaType.ARRAY,
      items: TutoringBlockSchema,
    },
  },
  required: ["weekly_plan"],
};

export const EvaluationOutputSchema = {
  type: SchemaType.OBJECT,
  properties: {
    success_signals: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    recheck_after: { type: SchemaType.STRING },
    replan_trigger: { type: SchemaType.STRING },
    mastery_threshold: { type: SchemaType.STRING },
  },
  required: ["success_signals", "recheck_after", "replan_trigger", "mastery_threshold"],
};

export const CriticOutputSchema = {
  type: SchemaType.OBJECT,
  properties: {
    approved: { type: SchemaType.BOOLEAN },
    feedback: { type: SchemaType.STRING },
    suggestions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ["approved", "feedback", "suggestions"],
};
