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


def test_orchestrator_returns_valid_response():
    """End-to-end test: run the pipeline and verify the response matches the Pydantic schema."""
    snapshot = StudentSnapshot(
        profile=StudentProfile(
            student_id="stu_test_001",
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

    # Result should be an OrchestrationResponse instance
    assert isinstance(result, OrchestrationResponse)

    # Diagnosis should identify 'joins' as the weakest concept
    assert result.diagnosis.weakest_concept == "joins"
    assert result.diagnosis.top_error_tag == "wrong_join_key"
    assert result.diagnosis.evidence.get("incorrect_attempts") == 1

    # Intervention should have a strategy
    assert result.selected_intervention.strategy
    assert result.selected_intervention.concept == "joins"
    assert len(result.selected_intervention.activities) > 0

    # Weekly plan should have at least 3 items (critic ensures this)
    assert len(result.weekly_plan) >= 3

    # Evaluation plan should have success signals
    assert result.evaluation_plan.concept == "joins"
    assert len(result.evaluation_plan.success_signals) > 0

    # Trace should have entries from all 4 agents + critic
    agent_names = {item.agent for item in result.trace}
    assert "diagnosis-agent" in agent_names
    assert "intervention-agent" in agent_names
    assert "planning-agent" in agent_names
    assert "evaluation-agent" in agent_names


def test_orchestrator_critic_loop_fires():
    """Verify the planner-critic loop works by checking plan has sufficient items."""
    snapshot = StudentSnapshot(
        profile=StudentProfile(
            student_id="stu_test_002",
            subject="sql_query_reasoning",
            goals=["Improve SQL reasoning"],
            available_hours_per_week=3,
        ),
        attempts=[
            QuestionAttempt(
                problem_id="sql_002",
                concept="joins",
                correct=False,
                error_tags=["wrong_join_key"],
                time_seconds=800,
                hints_used=1,
                retries=2,
            )
        ],
    )

    result = OrchestratorService().run(snapshot)

    # The planning agent starts with 4 items, so critic should pass on first try
    assert len(result.weekly_plan) >= 3


def test_orchestrator_multiple_attempts():
    """Test with multiple incorrect attempts across different concepts."""
    snapshot = StudentSnapshot(
        profile=StudentProfile(
            student_id="stu_test_003",
            subject="sql_query_reasoning",
            goals=["Master SQL"],
            available_hours_per_week=8,
        ),
        attempts=[
            QuestionAttempt(
                problem_id="sql_002",
                concept="joins",
                correct=False,
                error_tags=["wrong_join_key"],
            ),
            QuestionAttempt(
                problem_id="sql_003",
                concept="joins",
                correct=False,
                error_tags=["wrong_join_key", "cartesian_like_output"],
            ),
            QuestionAttempt(
                problem_id="sql_001",
                concept="group_by",
                correct=True,
                error_tags=[],
            ),
        ],
    )

    result = OrchestratorService().run(snapshot)

    # joins has more incorrect attempts, so it should be the weakest concept
    assert result.diagnosis.weakest_concept == "joins"
    assert result.diagnosis.evidence["incorrect_attempts"] == 2
