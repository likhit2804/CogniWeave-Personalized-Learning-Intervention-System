from dataclasses import dataclass, field
from typing import Any


@dataclass
class SharedMemory:
    """Shared state for a single orchestration run."""

    profile: dict[str, Any]
    attempts: list[dict[str, Any]]
    prior_interventions: list[str]
    knowledge_base: dict[str, Any]
    diagnosis: dict[str, Any] = field(default_factory=dict)
    selected_intervention: dict[str, Any] = field(default_factory=dict)
    weekly_plan: list[dict[str, Any]] = field(default_factory=list)
    evaluation_plan: dict[str, Any] = field(default_factory=dict)
    trace: list[dict[str, str]] = field(default_factory=list)

    def add_trace(self, agent: str, message: str) -> None:
        self.trace.append({"agent": agent, "message": message})

    def to_dict(self) -> dict[str, Any]:
        return {
            "profile": self.profile,
            "diagnosis": self.diagnosis,
            "selected_intervention": self.selected_intervention,
            "weekly_plan": self.weekly_plan,
            "evaluation_plan": self.evaluation_plan,
            "trace": self.trace,
        }
