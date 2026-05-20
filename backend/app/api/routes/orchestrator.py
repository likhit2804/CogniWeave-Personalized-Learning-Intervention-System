from fastapi import APIRouter

from backend.app.schemas.student import StudentSnapshot
from backend.app.services.orchestrator_service import OrchestratorService


router = APIRouter(prefix="/orchestrate", tags=["orchestrator"])
service = OrchestratorService()


@router.post("")
def orchestrate(snapshot: StudentSnapshot) -> dict:
    return service.run(snapshot)
