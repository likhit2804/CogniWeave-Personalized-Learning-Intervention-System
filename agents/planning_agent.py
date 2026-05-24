import json
from langchain_core.messages import SystemMessage, HumanMessage

from agents.state import GraphState
from agents.llm import llm
from agents.schemas import PlannerOutput
from agents.prompts import PLANNER_PROMPT


class PlanningAgentNode:
    """LangGraph node that builds a weekly study plan using an LLM."""

    def __call__(self, state: GraphState) -> dict:
        # 1. Retrieve data from State
        profile = state["profile"]
        intervention = state["selected_intervention"]
        critic_feedback = state.get("critic_feedback")

        # 2. Prompt the LLM
        structured_llm = llm.with_structured_output(PlannerOutput)
        
        system_msg = SystemMessage(content=PLANNER_PROMPT)
        
        context = {
            "available_hours_per_week": profile.get("available_hours_per_week", 6),
            "upcoming_deadlines": profile.get("upcoming_deadlines", []),
            "selected_intervention": intervention,
            "critic_feedback": critic_feedback
        }
        human_msg = HumanMessage(content=f"Context:\n{json.dumps(context, indent=2)}")
        
        result = structured_llm.invoke([system_msg, human_msg])

        # 3. Format the result for the state
        # the schema uses TutoringBlock, but our app state uses dicts
        plan = [block.model_dump() for block in result.weekly_plan]

        # 4. Return the key updates to the GraphState
        return {
            "weekly_plan": plan,
            "trace": state["trace"] + [{"agent": "planning-agent", "message": f"Built a {len(plan)}-session weekly plan."}],
        }
