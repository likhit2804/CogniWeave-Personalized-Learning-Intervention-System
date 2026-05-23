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

        if matches:
            raw = matches[0]
            # the KB rule uses concept_id but the response schema expects concept
            # also no why field in the KB so we build one from the rule id
            selected = {
                "concept": raw["concept_id"],
                "error_tag": error_tag,
                "strategy": raw["strategy"],
                "activities": raw.get("activities", []),
                "why": f"matched intervention rule '{raw['id']}' for the identified misconception",
            }
        else:
            # no matching rule found, fall back to a generic review strategy
            selected = {
                "concept": concept,
                "error_tag": error_tag,
                "strategy": "Targeted review",
                "activities": ["Review the concept with one worked example and one independent problem."],
                "why": "no exact rule matched in the knowledge base for this concept and error tag",
            }

        # 3. Return the key updates to the GraphState
        return {
            "selected_intervention": selected,
            "trace": state["trace"] + [{"agent": "intervention-agent", "message": f"Selected intervention strategy '{selected.get('strategy', 'N/A')}'."}],
        }
