import json
from langchain_core.messages import SystemMessage, HumanMessage

from agents.state import GraphState
from agents.llm import llm
from agents.schemas import InterventionOutput
from agents.prompts import INTERVENTION_PROMPT


class InterventionAgentNode:
    """LangGraph node that selects the best intervention strategy using an LLM."""

    def __call__(self, state: GraphState) -> dict:
        # 1. Retrieve data from State
        diagnosis = state["diagnosis"]
        kb = state["knowledge_base"]
        prior_interventions = state.get("prior_interventions", [])

        concept = diagnosis.get("weakest_concept")
        error_tag = diagnosis.get("top_error_tag")
        misconception = diagnosis.get("misconception")

        # 2. Prompt the LLM
        structured_llm = llm.with_structured_output(InterventionOutput)
        
        system_msg = SystemMessage(content=INTERVENTION_PROMPT)
        
        # filter rules by concept so we don't blow up the context window
        available_rules = [r for r in kb.get("interventions", {}).get("rules", []) if r.get("concept_id") == concept]
        
        context = {
            "diagnosed_concept": concept,
            "top_error_tag": error_tag,
            "misconception": misconception,
            "available_rules": available_rules,
            "prior_interventions": prior_interventions
        }
        human_msg = HumanMessage(content=f"Context:\n{json.dumps(context, indent=2)}")
        
        result = structured_llm.invoke([system_msg, human_msg])

        # 3. Format the result for the state
        selected = {
            "concept": concept,
            "error_tag": error_tag,
            "strategy": result.strategy,
            "activities": result.activities,
            "why": result.why,
            "estimated_sessions": result.estimated_sessions,
        }

        # 4. Return the key updates to the GraphState
        return {
            "selected_intervention": selected,
            "trace": state["trace"] + [{"agent": "intervention-agent", "message": f"Selected intervention strategy '{result.strategy}'."}],
        }
