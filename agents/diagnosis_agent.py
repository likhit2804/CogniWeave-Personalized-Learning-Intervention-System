from collections import Counter

from agents.base_agent import BaseAgent
from agents.shared_memory import SharedMemory


class DiagnosisAgent(BaseAgent):
    name = "diagnosis-agent"

    def run(self, memory: SharedMemory, knowledge_base) -> None:
        incorrect_attempts = [attempt for attempt in memory.attempts if not attempt["correct"]]
        concept_counts = Counter(attempt["concept"] for attempt in incorrect_attempts)
        error_counts = Counter(
            error_tag
            for attempt in incorrect_attempts
            for error_tag in attempt.get("error_tags", [])
        )

        top_concept = concept_counts.most_common(1)[0][0] if concept_counts else "unknown"
        top_error = error_counts.most_common(1)[0][0] if error_counts else None
        misconception = knowledge_base.find_misconception(top_concept, top_error)

        memory.diagnosis = {
            "weakest_concept": top_concept,
            "top_error_tag": top_error,
            "misconception": misconception,
            "evidence": {
                "incorrect_attempts": len(incorrect_attempts),
                "concept_frequency": dict(concept_counts),
                "error_frequency": dict(error_counts),
            },
        }
        memory.add_trace(
            self.name,
            f"Detected weakest concept '{top_concept}' with top error '{top_error}'.",
        )
