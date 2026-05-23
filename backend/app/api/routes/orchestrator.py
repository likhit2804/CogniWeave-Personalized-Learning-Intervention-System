from fastapi import APIRouter
from backend.app.schemas.student import StudentSnapshot, OrchestrationResponse
from backend.app.services.orchestrator_service import OrchestratorService

router = APIRouter(prefix="/orchestrate", tags=["orchestrator"])
service = OrchestratorService()


@router.post("", response_model=OrchestrationResponse)
def orchestrate(snapshot: StudentSnapshot) -> OrchestrationResponse:
    return service.run(snapshot)
