from agents.base_agent import BaseAgent
from agents.shared_memory import SharedMemory


class InterventionAgent(BaseAgent):
    name = "intervention-agent"

    def run(self, memory: SharedMemory, knowledge_base) -> None:
        concept = memory.diagnosis.get("weakest_concept")
        error_tag = memory.diagnosis.get("top_error_tag")
        matches = knowledge_base.find_interventions(concept, error_tag)

        selected = matches[0] if matches else {
            "concept": concept,
            "error_tag": error_tag,
            "strategy": "Targeted review",
            "activities": ["Review the concept with one worked example and one independent problem."],
            "why": "Fallback strategy when no exact intervention rule exists.",
        }

        memory.selected_intervention = selected
        memory.add_trace(
            self.name,
            f"Selected intervention strategy '{selected['strategy']}'.",
        )
