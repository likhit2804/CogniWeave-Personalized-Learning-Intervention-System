from typing import TypedDict, Any


class GraphState(TypedDict):
    profile: dict[str, Any]
    attempts: list[dict[str, Any]]
    prior_interventions: list[str]
    knowledge_base: dict[str, Any]

    # Agent State Mappings
    diagnosis: dict[str, Any]
    selected_intervention: dict[str, Any]
    weekly_plan: list[dict[str, Any]]
    evaluation_plan: dict[str, Any]
    trace: list[dict[str, str]]

    # Planner-Critic Iteration Check
    critic_feedback: str | None
    iteration_count: int
