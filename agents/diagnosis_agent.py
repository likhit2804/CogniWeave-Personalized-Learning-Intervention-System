from collections import Counter

from agents.state import GraphState


class DiagnosisAgentNode:
    """LangGraph node that diagnoses the student's weakest concept."""

    def __call__(self, state: GraphState) -> dict:
        # 1. Retrieve data from State
        attempts = state["attempts"]
        kb = state["knowledge_base"]

        # 2. Deterministic diagnosis logic (can be replaced with LLM call later)
        incorrect_attempts = [a for a in attempts if not a["correct"]]
        concept_counts = Counter(a["concept"] for a in incorrect_attempts)
        error_counts = Counter(
            error_tag
            for a in incorrect_attempts
            for error_tag in a.get("error_tags", [])
        )

        top_concept = concept_counts.most_common(1)[0][0] if concept_counts else "unknown"
        top_error = error_counts.most_common(1)[0][0] if error_counts else None

        # Find misconception from knowledge base
        misconception = None
        for item in kb.get("misconceptions", {}).get("items", []):
            if item["concept_id"] == top_concept and top_error in item.get("error_tags", []):
                misconception = item
                break

        # 3. Return the key updates to the GraphState
        return {
            "diagnosis": {
                "weakest_concept": top_concept,
                "top_error_tag": top_error,
                "misconception": misconception,
                "evidence": {
                    "incorrect_attempts": len(incorrect_attempts),
                    "concept_frequency": dict(concept_counts),
                    "error_frequency": dict(error_counts),
                },
            },
            "trace": state["trace"] + [{"agent": "diagnosis-agent", "message": f"Detected weakest concept '{top_concept}' with top error '{top_error}'."}],
        }
