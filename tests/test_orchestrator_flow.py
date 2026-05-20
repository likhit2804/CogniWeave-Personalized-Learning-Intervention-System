from backend.app.schemas.student import StudentProfile, StudentSnapshot, QuestionAttempt
from backend.app.services.orchestrator_service import OrchestratorService


def test_orchestrator_returns_agent_outputs():
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
