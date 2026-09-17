from fastapi import FastAPI
from app.config.config import settings
from app.schemas.health import AIHealthResponse

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Decoupled AI/ML verification and anti-spoofing service for Horizon geospatial submissions.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


@app.get("/health", response_model=AIHealthResponse, tags=["Health"])
def ai_health() -> AIHealthResponse:
    """Return health and runtime engine readiness of the isolated AI service."""
    return AIHealthResponse(
        status="ok",
        service="horizon-ai",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
        device=settings.DEVICE,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.AI_SERVICE_HOST, port=settings.AI_SERVICE_PORT, reload=True)
