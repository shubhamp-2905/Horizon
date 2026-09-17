from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    PROJECT_NAME: str = "Horizon Backend API"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "horizon_development_secret_key_not_for_production_32_chars"

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 4000
    API_V1_STR: str = "/api/v1"
    API_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
    ]

    # Database
    DATABASE_URL: str = "postgresql://horizon_user:horizon_password@localhost:5432/horizon_db"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # AI Verification Microservice
    AI_SERVICE_URL: str = "http://localhost:8000"
    AI_SERVICE_API_KEY: str = "horizon_ai_dev_key"

    # S3 / MinIO Object Storage
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_BUCKET: str = "horizon-media"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_REGION: str = "us-east-1"
    S3_FORCE_PATH_STYLE: bool = True

    # Token Economics
    STARTER_TOKEN_GRANT: int = 100
    DEFAULT_TASK_EXPIRATION_HOURS: int = 24
    MINIMUM_COMMITMENT_STAKE: int = 10

    # Downstream Pipeline
    LOUPE_PIPELINE_ENDPOINT: str = "https://pipeline.loupe.internal/ingest"
    LOUPE_API_KEY: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
