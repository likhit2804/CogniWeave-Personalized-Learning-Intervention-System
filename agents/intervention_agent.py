from agents.state import GraphState


class InterventionAgentNode:
    """LangGraph node that selects the best intervention strategy."""

    def __call__(self, state: GraphState) -> dict:
        # 1. Retrieve data from State
        diagnosis = state["diagnosis"]
        kb = state["knowledge_base"]

        concept = diagnosis.get("weakest_concept")
        error_tag = diagnosis.get("top_error_tag")
        misconception = diagnosis.get("misconception")

        # 2. Find matching interventions from knowledge base
        matches = []
        for item in kb.get("interventions", {}).get("rules", []):
            if item["concept_id"] != concept:
                continue
            if misconception and item["misconception_id"] == misconception["id"]:
                matches.append(item)

        selected = matches[0] if matches else {
            "concept": concept,
            "error_tag": error_tag,
            "strategy": "Targeted review",
            "activities": ["Review the concept with one worked example and one independent problem."],
            "why": "Fallback strategy when no exact intervention rule exists.",
        }

        # 3. Return the key updates to the GraphState
        return {
            "selected_intervention": selected,
            "trace": state["trace"] + [{"agent": "intervention-agent", "message": f"Selected intervention strategy '{selected.get('strategy', 'N/A')}'."}],
        }
