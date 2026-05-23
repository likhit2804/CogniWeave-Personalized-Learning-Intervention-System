from pydantic import BaseModel, Field
from typing import Any


class Deadline(BaseModel):
    label: str
    days_left: int


class QuestionAttempt(BaseModel):
    problem_id: str
    concept: str
    correct: bool
    error_tags: list[str] = Field(default_factory=list)
    time_seconds: int | None = None
    hints_used: int = 0
    retries: int = 0


class MCQProblem(BaseModel):
    id: str
    title: str
    concept_ids: list[str] = Field(default_factory=list)
    difficulty: str
    question_text: str
    options: dict[str, str]
    correct_option: str
    expected_error_tags: list[str] = Field(default_factory=list)


class MCQSubmission(BaseModel):
    student_id: str
    problem_id: str
    selected_option: str


class StudentProfile(BaseModel):
    student_id: str
    subject: str
    goals: list[str] = Field(default_factory=list)
    available_hours_per_week: int = 6
    confidence_by_concept: dict[str, float] = Field(default_factory=dict)
    upcoming_deadlines: list[Deadline] = Field(default_factory=list)


class StudentSnapshot(BaseModel):
    profile: StudentProfile
    attempts: list[QuestionAttempt] = Field(default_factory=list)
    prior_interventions: list[str] = Field(default_factory=list)


class DiagnosisResult(BaseModel):
    weakest_concept: str
    top_error_tag: str | None = None
    confidence: float = 1.0
    reasoning: str = ""
    misconception_label: str | None = None
    evidence_summary: str = ""


class InterventionResult(BaseModel):
    strategy: str
    activities: list[str] = Field(default_factory=list)
    why: str
    estimated_sessions: int = 2


class WeeklyScheduleItem(BaseModel):
    day: str
    focus: str
    minutes: int
    activity_type: str = "review"


class EvaluationPlan(BaseModel):
    success_signals: list[str]
    recheck_after: str
    replan_trigger: str
    mastery_threshold: str = ""


class TraceLogItem(BaseModel):
    agent: str
    message: str


class OrchestrationResponse(BaseModel):
    profile: dict[str, Any]
    diagnosis: DiagnosisResult
    selected_intervention: InterventionResult
    weekly_plan: list[WeeklyScheduleItem]
    evaluation_plan: EvaluationPlan
    trace: list[TraceLogItem]
    # tells the client how many times the planner-critic loop ran
    # 0 means the first plan was accepted straight away
    critic_iterations: int = 0