from fastapi import FastAPI

from backend.app.api.routes.health import router as health_router
from backend.app.api.routes.orchestrator import router as orchestrator_router
from backend.app.config import settings


app = FastAPI(title=settings.app_name)
app.include_router(health_router)
app.include_router(orchestrator_router)
