from unittest.mock import patch, MagicMock
from backend.app.schemas.student import StudentProfile, StudentSnapshot, QuestionAttempt
from backend.app.services.orchestrator_service import OrchestratorService
import pytest

@patch("agents.diagnosis_agent.llm")
@patch("agents.intervention_agent.llm")
@patch("agents.planning_agent.llm")
@patch("agents.evaluation_agent.llm")
@patch("backend.app.services.orchestrator_service.llm")
def test_orchestrator_flow_with_mocked_llm(
    mock_critic,
    mock_eval,
    mock_plan,
    mock_intervene,
    mock_diagnose
):
    from agents.schemas import DiagnosisOutput, InterventionOutput, PlannerOutput, TutoringBlock, EvaluationOutput, CriticOutput
    
    # Setup mocks to return runnables that return real pydantic objects when invoked
    mock_diagnose.with_structured_output.return_value.invoke.return_value = DiagnosisOutput(
        weakest_concept="joins",
        top_error_tag="wrong_join_key",
        confidence=0.9,
        reasoning="Failed join questions repeatedly.",
        misconception_label="foreign_key_confusion",
        evidence_summary="3 failed attempts"
    )
    
    mock_intervene.with_structured_output.return_value.invoke.return_value = InterventionOutput(
        strategy="review_basics",
        activities=["Watch a video on JOINs", "Do basic practice"],
        why="The student struggles with JOIN syntax."
    )
    
    mock_activity = TutoringBlock(day="Monday", focus="Joins", minutes=30, activity_type="review")
    mock_plan.with_structured_output.return_value.invoke.return_value = PlannerOutput(weekly_plan=[mock_activity, mock_activity, mock_activity])
    
    mock_eval.with_structured_output.return_value.invoke.return_value = EvaluationOutput(
        success_signals=["Can write an inner join"],
        recheck_after="1 week",
        replan_trigger="Fails 2 more JOIN questions",
        mastery_threshold="3 correct in a row without hints"
    )
    
    mock_critic.with_structured_output.return_value.invoke.return_value = CriticOutput(approved=True, feedback="Looks good")

    snapshot = StudentSnapshot(
        profile=StudentProfile(
            student_id="stu_001",
            subject="sql_query_reasoning",
            goals=["Improve Joins"],
            available_hours_per_week=6,
        ),
        attempts=[
            QuestionAttempt(
                problem_id="sql_002",
                concept="joins",
                correct=False,
                error_tags=["wrong_join_key"],
            )
        ],
    )

    result = OrchestratorService().run(snapshot)

    # Assertions
    assert result["diagnosis"]["weakest_concept"] == "joins"
    assert result["selected_intervention"]["strategy"] == "review_basics"
    assert len(result["weekly_plan"]) == 3
    assert "Can write an inner join" in result["evaluation_plan"]["success_signals"]
    assert result["critic_iterations"] == 0
