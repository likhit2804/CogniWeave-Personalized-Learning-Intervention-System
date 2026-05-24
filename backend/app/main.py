from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.api.routes.health import router as health_router
from backend.app.api.routes.orchestrator import router as orchestrator_router
from backend.app.api.routes.ingest import router as ingest_router
from backend.app.config import settings
from backend.app.services.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)
app.include_router(health_router)
app.include_router(orchestrator_router)
app.include_router(ingest_router)
