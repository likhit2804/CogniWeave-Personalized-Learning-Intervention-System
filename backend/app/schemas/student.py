from pydantic import BaseModel, Field


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
