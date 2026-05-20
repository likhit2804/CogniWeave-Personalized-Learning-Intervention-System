from agents.base_agent import BaseAgent
from agents.shared_memory import SharedMemory


class EvaluationAgent(BaseAgent):
    name = "evaluation-agent"

    def run(self, memory: SharedMemory, knowledge_base) -> None:
        concept = memory.diagnosis.get("weakest_concept")

        memory.evaluation_plan = {
            "concept": concept,
            "success_signals": [
                "fewer repeated mistakes on similar problems",
                "lower time-to-solve",
                "higher confidence on the concept",
                "ability to solve one fresh problem without hints",
            ],
            "recheck_after": "next focused practice block or mini-checkpoint",
            "replan_trigger": "if the same error pattern appears again after the intervention",
        }
        memory.add_trace(
            self.name,
            "Defined multi-signal evaluation criteria and replanning trigger.",
        )
