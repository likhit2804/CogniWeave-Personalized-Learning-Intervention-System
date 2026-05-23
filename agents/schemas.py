from pydantic import BaseModel, Field


# these are the structured output contracts for each agent
# we pass these into llm.with_structured_output() so the LLM is forced
# to return exactly this shape - no free-form text


class DiagnosisOutput(BaseModel):
    weakest_concept: str
    top_error_tag: str | None = None
    # 0.0 = guessing, 1.0 = very certain based on the evidence
    confidence: float
    reasoning: str
    misconception_label: str | None = None
    evidence_summary: str


class InterventionOutput(BaseModel):
    strategy: str
    # flat list for now, easier to feed into the planner context
    activities: list[str]
    why: str
    estimated_sessions: int = 2


class TutoringBlock(BaseModel):
    day: str
    focus: str
    minutes: int
    # one of: review, practice, checkpoint, mixed
    activity_type: str


class PlannerOutput(BaseModel):
    weekly_plan: list[TutoringBlock]


class EvaluationOutput(BaseModel):
    success_signals: list[str]
    recheck_after: str
    replan_trigger: str
    # concrete bar the student needs to clear, e.g. "3 correct in a row without hints"
    mastery_threshold: str


class CriticOutput(BaseModel):
    approved: bool
    feedback: str
    # specific things the planner should fix if not approved
    suggestions: list[str] = Field(default_factory=list)
