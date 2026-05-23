import json
from langchain_core.messages import SystemMessage, HumanMessage

from agents.state import GraphState
from agents.llm import llm
from agents.schemas import EvaluationOutput
from agents.prompts import EVALUATOR_PROMPT


class EvaluationAgentNode:
    """LangGraph node that defines evaluation criteria using an LLM."""

    def __call__(self, state: GraphState) -> dict:
        # 1. Retrieve data from State
        diagnosis = state["diagnosis"]
        kb = state["knowledge_base"]
        
        concept = diagnosis.get("weakest_concept")
        misconception = diagnosis.get("misconception")

        # 2. Prompt the LLM
        structured_llm = llm.with_structured_output(EvaluationOutput)
        
        system_msg = SystemMessage(content=EVALUATOR_PROMPT)
        
        context = {
            "diagnosed_concept": concept,
            "misconception": misconception,
            "evaluation_rules": kb.get("evaluation_rules", {}).get(concept, [])
        }
        human_msg = HumanMessage(content=f"Context:\n{json.dumps(context, indent=2)}")
        
        result = structured_llm.invoke([system_msg, human_msg])

        # 3. Format the result
        evaluation_plan = {
            "concept": concept,
            "success_signals": result.success_signals,
            "recheck_after": result.recheck_after,
            "replan_trigger": result.replan_trigger,
            "mastery_threshold": result.mastery_threshold,
        }

        # 4. Return the key updates to the GraphState
        return {
            "evaluation_plan": evaluation_plan,
            "trace": state["trace"] + [{"agent": "evaluation-agent", "message": "Defined multi-signal evaluation criteria via LLM."}],
        }
