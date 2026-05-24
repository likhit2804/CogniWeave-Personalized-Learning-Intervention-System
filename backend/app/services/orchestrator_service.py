from langgraph.graph import StateGraph, END
from agents.state import GraphState
from agents.diagnosis_agent import DiagnosisAgentNode
from agents.intervention_agent import InterventionAgentNode
from agents.planning_agent import PlanningAgentNode
from agents.evaluation_agent import EvaluationAgentNode
from backend.app.schemas.student import (
    StudentSnapshot,
    OrchestrationResponse,
    DiagnosisResult,
    InterventionResult,
    WeeklyScheduleItem,
    EvaluationPlan,
    TraceLogItem,
)
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


def _map_to_response(final_state: dict) -> OrchestrationResponse:
    """Map raw GraphState dict to the validated OrchestrationResponse."""
    # Diagnosis maps cleanly
    diagnosis = DiagnosisResult(**final_state["diagnosis"])

    # Intervention needs key remapping: KB uses concept_id, schema uses concept
    raw_intervention = final_state["selected_intervention"]
    intervention = InterventionResult(
        concept=raw_intervention.get("concept") or raw_intervention.get("concept_id", "unknown"),
        error_tag=raw_intervention.get("error_tag") or raw_intervention.get("misconception_id"),
        strategy=raw_intervention.get("strategy", "Targeted review"),
        activities=raw_intervention.get("activities", []),
        why=raw_intervention.get("why", f"Matched misconception '{raw_intervention.get('misconception_id', 'N/A')}'"),
    )

    # Weekly plan
    weekly_plan = [WeeklyScheduleItem(**item) for item in final_state["weekly_plan"]]

    # Evaluation plan
    evaluation_plan = EvaluationPlan(**final_state["evaluation_plan"])

    # Trace
    trace = [TraceLogItem(**item) for item in final_state["trace"]]

    return OrchestrationResponse(
        profile=final_state["profile"],
        diagnosis=diagnosis,
        selected_intervention=intervention,
        weekly_plan=weekly_plan,
        evaluation_plan=evaluation_plan,
        trace=trace,
    )


class OrchestratorService:
    """Coordinates the LangGraph agent pipeline for a single student snapshot."""

    def run(self, snapshot: StudentSnapshot) -> OrchestrationResponse:
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

        # 3. Map to validated response model
        response = _map_to_response(final_state)

        # 4. Persist to database (best-effort, don't break the pipeline)
        self._persist(snapshot, response)

        return response

    @staticmethod
    def _persist(snapshot: StudentSnapshot, response: OrchestrationResponse) -> None:
        """Best-effort persistence of orchestration results to SQLite."""
        try:
            from backend.app.services.database import (
                upsert_student,
                record_attempt,
                record_intervention,
            )

            # Save student profile
            upsert_student(
                student_id=snapshot.profile.student_id,
                subject=snapshot.profile.subject,
                available_hours=snapshot.profile.available_hours_per_week,
            )

            # Save each attempt
            for attempt in snapshot.attempts:
                record_attempt(
                    student_id=snapshot.profile.student_id,
                    problem_id=attempt.problem_id,
                    concept=attempt.concept,
                    correct=attempt.correct,
                    error_tags=attempt.error_tags,
                    time_seconds=attempt.time_seconds,
                    hints_used=attempt.hints_used,
                    retries=attempt.retries,
                )

            # Save the intervention
            record_intervention(
                student_id=snapshot.profile.student_id,
                concept=response.selected_intervention.concept,
                strategy=response.selected_intervention.strategy,
            )

        except Exception:
            import logging
            logging.getLogger(__name__).warning(
                "Failed to persist orchestration results to database.", exc_info=True,
            )

