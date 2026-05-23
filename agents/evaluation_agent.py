from agents.state import GraphState


class EvaluationAgentNode:
    """LangGraph node that defines evaluation criteria."""

    def __call__(self, state: GraphState) -> dict:
        # 1. Retrieve data from State
        diagnosis = state["diagnosis"]
        concept = diagnosis.get("weakest_concept")

        # 2. Build evaluation plan
        evaluation_plan = {
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

        # 3. Return the key updates to the GraphState
        return {
            "evaluation_plan": evaluation_plan,
            "trace": state["trace"] + [{"agent": "evaluation-agent", "message": "Defined multi-signal evaluation criteria and replanning trigger."}],
        }
