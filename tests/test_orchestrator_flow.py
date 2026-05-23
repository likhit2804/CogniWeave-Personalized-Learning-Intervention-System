from unittest.mock import patch, MagicMock
from backend.app.schemas.student import StudentProfile, StudentSnapshot, QuestionAttempt
from backend.app.services.orchestrator_service import OrchestratorService


@patch("backend.app.services.llm_client.ChatOpenAI")
def test_langgraph_orchestration_loop(mock_chat_openai):
    # Mock LLM API Responses
    mock_llm = MagicMock()
    mock_llm.invoke.return_value.content = "Mocked LLM Analysis"
    mock_chat_openai.return_value = mock_llm

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

    # Execute service
    result = OrchestratorService().run(snapshot)

    # Assertions
    assert result["diagnosis"]["weakest_concept"] == "joins"
    assert len(result["weekly_plan"]) >= 3
    assert result["critic_feedback"] is None


def test_orchestrator_returns_agent_outputs():
    """Original test preserved: verifies end-to-end outputs."""
    snapshot = StudentSnapshot(
        profile=StudentProfile(
            student_id="stu_001",
            subject="sql_query_reasoning",
            goals=["Improve SQL reasoning"],
            available_hours_per_week=6,
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

    assert result["diagnosis"]["weakest_concept"] == "joins"
    assert result["selected_intervention"]["strategy"]
    assert result["weekly_plan"]
    assert result["evaluation_plan"]["success_signals"]
