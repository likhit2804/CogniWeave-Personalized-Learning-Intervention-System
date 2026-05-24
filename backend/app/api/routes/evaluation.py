from fastapi import APIRouter, HTTPException
from backend.app.schemas.student import MCQProblem, MCQSubmission
from backend.app.services.knowledge_base import KnowledgeBase
import random

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

@router.get("/problems/{topic_id}/{concept_id}", response_model=MCQProblem)
def get_problem_for_concept(topic_id: str, concept_id: str):
    """Fetches a random MCQ problem for a specific concept."""
    try:
        kb = KnowledgeBase(topic_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Find all problems that test this concept
    matching_problems = [p for p in kb.problems.get("items", []) if concept_id in p.get("concept_ids", [])]
    
    if not matching_problems:
        raise HTTPException(status_code=404, detail=f"No problems found for concept {concept_id}")

    # Pick a random problem
    selected_problem = random.choice(matching_problems)
    return selected_problem


@router.post("/evaluate")
def evaluate_submission(submission: MCQSubmission, topic_id: str):
    """Evaluates a student's answer deterministically."""
    try:
        kb = KnowledgeBase(topic_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Topic not found")

    problem = next((p for p in kb.problems.get("items", []) if p["id"] == submission.problem_id), None)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    is_correct = (submission.selected_option == problem["correct_option"])

    if is_correct:
        return {
            "mastery_achieved": True,
            "replan_required": False,
            "feedback": "Correct! You have mastered this concept."
        }
    else:
        return {
            "mastery_achieved": False,
            "replan_required": True,
            "feedback": f"Incorrect. The correct answer was {problem['correct_option']}."
        }
