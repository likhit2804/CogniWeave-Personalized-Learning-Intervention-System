"""Tests for the LangGraph orchestration pipeline."""

import sys
from pathlib import Path

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.schemas.student import (
    StudentProfile,
    StudentSnapshot,
    QuestionAttempt,
    OrchestrationResponse,
)
from backend.app.services.orchestrator_service import OrchestratorService
import pytest

from unittest.mock import patch

@patch("agents.diagnosis_agent.llm")
@patch("agents.intervention_agent.llm")
@patch("agents.planning_agent.llm")
@patch("agents.evaluation_agent.llm")
@patch("backend.app.services.orchestrator_service.llm")
def test_orchestrator_returns_valid_response(mock_critic, mock_eval, mock_plan, mock_intervene, mock_diagnose):
    """End-to-end test: run the pipeline and verify the response matches the Pydantic schema."""
    from agents.schemas import DiagnosisOutput, InterventionOutput, PlannerOutput, TutoringBlock, EvaluationOutput, CriticOutput
    
    mock_diagnose.with_structured_output.return_value.invoke.return_value = DiagnosisOutput(
        weakest_concept="joins", top_error_tag="wrong_join_key", confidence=0.9,
        reasoning="Failed join questions.", misconception_label="fk_confusion", evidence_summary="1 failed"
    )
    mock_intervene.with_structured_output.return_value.invoke.return_value = InterventionOutput(
        strategy="review_basics", activities=["Watch video", "Do practice"], why="Struggles with JOIN"
    )
    mock_activity = TutoringBlock(day="Monday", focus="Joins", minutes=30, activity_type="review")
    mock_plan.with_structured_output.return_value.invoke.return_value = PlannerOutput(weekly_plan=[mock_activity, mock_activity, mock_activity])
    mock_eval.with_structured_output.return_value.invoke.return_value = EvaluationOutput(
        success_signals=["Can write an inner join"], recheck_after="1 week",
        replan_trigger="Fails 2 more", mastery_threshold="3 correct"
    )
    mock_critic.with_structured_output.return_value.invoke.return_value = CriticOutput(approved=True, feedback="Looks good")

    snapshot = StudentSnapshot(
        profile=StudentProfile(
            student_id="stu_test_001",
            subject="sql_query_reasoning",
            goals=["Improve Joins"],
            available_hours_per_week=6,
        ),
        attempts=[
            QuestionAttempt(problem_id="sql_002", concept="joins", correct=False, error_tags=["wrong_join_key"])
        ],
    )

    result = OrchestratorService().run(snapshot)

    assert isinstance(result, OrchestrationResponse)
    assert result.diagnosis.weakest_concept == "joins"
    assert result.selected_intervention.strategy == "review_basics"
    assert len(result.weekly_plan) == 3
    assert result.critic_iterations == 0


@patch("agents.diagnosis_agent.llm")
@patch("agents.intervention_agent.llm")
@patch("agents.planning_agent.llm")
@patch("agents.evaluation_agent.llm")
@patch("backend.app.services.orchestrator_service.llm")
def test_orchestrator_critic_loop_fires(mock_critic, mock_eval, mock_plan, mock_intervene, mock_diagnose):
    """Verify the planner-critic loop works by checking plan has sufficient items."""
    from agents.schemas import DiagnosisOutput, InterventionOutput, PlannerOutput, TutoringBlock, EvaluationOutput, CriticOutput
    
    mock_diagnose.with_structured_output.return_value.invoke.return_value = DiagnosisOutput(
        weakest_concept="joins", top_error_tag="wrong_join_key", confidence=0.9, reasoning="Failed.", misconception_label="fk_confusion", evidence_summary="2 failed"
    )
    mock_intervene.with_structured_output.return_value.invoke.return_value = InterventionOutput(
        strategy="review_basics", activities=["Watch video"], why="Struggles"
    )
    mock_activity = TutoringBlock(day="Monday", focus="Joins", minutes=30, activity_type="review")
    mock_plan.with_structured_output.return_value.invoke.return_value = PlannerOutput(weekly_plan=[mock_activity, mock_activity, mock_activity])
    mock_eval.with_structured_output.return_value.invoke.return_value = EvaluationOutput(
        success_signals=["Can write inner join"], recheck_after="1 week", replan_trigger="Fails", mastery_threshold="3 correct"
    )
    # Critic initially rejects, then approves
    mock_critic.with_structured_output.return_value.invoke.side_effect = [
        CriticOutput(approved=False, feedback="Too short", suggestions=["Add more"]),
        CriticOutput(approved=True, feedback="Looks good")
    ]

    snapshot = StudentSnapshot(
        profile=StudentProfile(student_id="stu_test_002", subject="sql_query_reasoning", goals=["Improve SQL"], available_hours_per_week=3),
        attempts=[QuestionAttempt(problem_id="sql_002", concept="joins", correct=False, error_tags=["wrong_join_key"])]
    )

    result = OrchestratorService().run(snapshot)

    assert len(result.weekly_plan) >= 3
    assert result.critic_iterations > 0


@patch("agents.diagnosis_agent.llm")
@patch("agents.intervention_agent.llm")
@patch("agents.planning_agent.llm")
@patch("agents.evaluation_agent.llm")
@patch("backend.app.services.orchestrator_service.llm")
def test_orchestrator_multiple_attempts(mock_critic, mock_eval, mock_plan, mock_intervene, mock_diagnose):
    """Test with multiple incorrect attempts across different concepts."""
    from agents.schemas import DiagnosisOutput, InterventionOutput, PlannerOutput, TutoringBlock, EvaluationOutput, CriticOutput
    
    mock_diagnose.with_structured_output.return_value.invoke.return_value = DiagnosisOutput(
        weakest_concept="joins", top_error_tag="wrong_join_key", confidence=0.9, reasoning="Failed.", misconception_label="fk_confusion", evidence_summary="2 failed"
    )
    mock_intervene.with_structured_output.return_value.invoke.return_value = InterventionOutput(
        strategy="review_basics", activities=["Watch video"], why="Struggles"
    )
    mock_activity = TutoringBlock(day="Monday", focus="Joins", minutes=30, activity_type="review")
    mock_plan.with_structured_output.return_value.invoke.return_value = PlannerOutput(weekly_plan=[mock_activity, mock_activity, mock_activity])
    mock_eval.with_structured_output.return_value.invoke.return_value = EvaluationOutput(
        success_signals=["Can write inner join"], recheck_after="1 week", replan_trigger="Fails", mastery_threshold="3 correct"
    )
    mock_critic.with_structured_output.return_value.invoke.return_value = CriticOutput(approved=True, feedback="Looks good")

    snapshot = StudentSnapshot(
        profile=StudentProfile(student_id="stu_test_003", subject="sql_query_reasoning", goals=["Master SQL"], available_hours_per_week=8),
        attempts=[
            QuestionAttempt(problem_id="sql_002", concept="joins", correct=False, error_tags=["wrong_join_key"]),
            QuestionAttempt(problem_id="sql_003", concept="joins", correct=False, error_tags=["wrong_join_key", "cartesian_like_output"]),
            QuestionAttempt(problem_id="sql_001", concept="group_by", correct=True, error_tags=[]),
        ],
    )

    result = OrchestratorService().run(snapshot)

    assert result.diagnosis.weakest_concept == "joins"
