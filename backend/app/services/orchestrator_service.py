from langgraph.graph import StateGraph, END
from agents.state import GraphState
from agents.diagnosis_agent import DiagnosisAgentNode
from agents.intervention_agent import InterventionAgentNode
from agents.planning_agent import PlanningAgentNode
from agents.evaluation_agent import EvaluationAgentNode
from backend.app.schemas.student import StudentSnapshot
from backend.app.services.knowledge_base import KnowledgeBase

# 1. Instantiate Graph nodes
diagnosis_node = DiagnosisAgentNode()
intervention_node = InterventionAgentNode()
planning_node = PlanningAgentNode()
evaluation_node = EvaluationAgentNode()


def critic_node(state: GraphState) -> dict:
    """A custom critic node to review the planning node outputs before completing."""
    plan = state["weekly_plan"]
    iterations = state.get("iteration_count", 0)

    if len(plan) < 3 and iterations < 2:
        return {
            "critic_feedback": "Plan is too sparse. Add more focus blocks.",
            "iteration_count": iterations + 1,
        }
    return {
        "critic_feedback": None,
    }


def route_triage(state: GraphState) -> str:
    """Conditional routing logic for the planner-critic loop."""
    if state["critic_feedback"] is not None:
        return "replan"
    return "finish"


# 2. Build and Compile the State Machine
workflow = StateGraph(GraphState)

# Add Nodes
workflow.add_node("diagnose", diagnosis_node)
workflow.add_node("intervene", intervention_node)
workflow.add_node("plan", planning_node)
workflow.add_node("evaluate", evaluation_node)
workflow.add_node("criticize", critic_node)

# Wire Nodes
workflow.set_entry_point("diagnose")
workflow.add_edge("diagnose", "intervene")
workflow.add_edge("intervene", "plan")
workflow.add_edge("plan", "evaluate")
workflow.add_edge("evaluate", "criticize")

# Add Loop
workflow.add_conditional_edges(
    "criticize",
    route_triage,
    {
        "replan": "plan",   # Loop back to planning node
        "finish": END,
    },
)

app_graph = workflow.compile()


class OrchestratorService:
    """Coordinates the LangGraph agent pipeline for a single student snapshot."""

    def run(self, snapshot: StudentSnapshot) -> dict:
        knowledge_base = KnowledgeBase(topic_id=snapshot.profile.subject)

        # 1. Create Initial State
        initial_state: GraphState = {
            "profile": snapshot.profile.model_dump(),
            "attempts": [attempt.model_dump() for attempt in snapshot.attempts],
            "prior_interventions": snapshot.prior_interventions,
            "knowledge_base": {
                "manifest": knowledge_base.manifest,
                "concepts": knowledge_base.concepts,
                "misconceptions": knowledge_base.misconceptions,
                "interventions": knowledge_base.interventions,
                "problems": knowledge_base.problems,
                "evaluation_rules": knowledge_base.evaluation_rules,
            },
            "diagnosis": {},
            "selected_intervention": {},
            "weekly_plan": [],
            "evaluation_plan": {},
            "trace": [],
            "critic_feedback": None,
            "iteration_count": 0,
        }

        # 2. Run LangGraph Engine
        final_state = app_graph.invoke(initial_state)
        return final_state
