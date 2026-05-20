from agents.diagnosis_agent import DiagnosisAgent
from agents.evaluation_agent import EvaluationAgent
from agents.intervention_agent import InterventionAgent
from agents.planning_agent import PlanningAgent
from agents.shared_memory import SharedMemory
from backend.app.schemas.student import StudentSnapshot
from backend.app.services.knowledge_base import KnowledgeBase


class OrchestratorService:
    """Coordinates the agent pipeline for a single student snapshot."""

    def __init__(self) -> None:
        self.agents = [
            DiagnosisAgent(),
            InterventionAgent(),
            PlanningAgent(),
            EvaluationAgent(),
        ]

    def run(self, snapshot: StudentSnapshot) -> dict:
        knowledge_base = KnowledgeBase(topic_id=snapshot.profile.subject)
        memory = SharedMemory(
            profile=snapshot.profile.model_dump(),
            attempts=[attempt.model_dump() for attempt in snapshot.attempts],
            prior_interventions=snapshot.prior_interventions,
            knowledge_base={
                "manifest": knowledge_base.manifest,
                "concepts": knowledge_base.concepts,
                "misconceptions": knowledge_base.misconceptions,
                "interventions": knowledge_base.interventions,
                "problems": knowledge_base.problems,
                "evaluation_rules": knowledge_base.evaluation_rules,
            },
        )

        for agent in self.agents:
            agent.run(memory, knowledge_base)

        return memory.to_dict()
