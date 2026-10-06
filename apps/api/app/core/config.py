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
    API_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
        "https://horizon-eosin-sigma.vercel.app",
    ]

    @field_validator("API_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.startswith("[") and v_clean.endswith("]"):
                try:
                    import json
                    parsed = json.loads(v_clean)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except Exception:
                    pass
            return [origin.strip() for origin in v_clean.split(",") if origin.strip()]
        elif isinstance(v, list):
            return [str(item).strip() for item in v]
        return ["*"]

    LOG_FORMAT: str = "text"
    RATE_LIMIT_ENABLED: bool = True

    # Database
    DATABASE_URL: str = "postgresql://postgres.wlelfechiyxzfxjhkvmy:%23xH7sJ%26J!hzyUdv@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_RECYCLE: int = 1800

    # AI Verification Microservice
    AI_SERVICE_URL: str = "http://localhost:8000"
    AI_SERVICE_API_KEY: str = "horizon_ai_dev_key"
    AI_SERVICE_TIMEOUT_SECONDS: float = 3.0
    AI_SERVICE_MAX_RETRIES: int = 1

    # S3 / MinIO Object Storage
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_BUCKET: str = "horizon-media"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_REGION: str = "us-east-1"
    S3_FORCE_PATH_STYLE: bool = True
    STORAGE_PERSISTENT_DIR: str = "storage/media"

    # Token Economics
    STARTER_TOKEN_GRANT: int = 100
    DEFAULT_TASK_EXPIRATION_HOURS: int = 24
    MINIMUM_COMMITMENT_STAKE: int = 10

    # Phase 6: Distributed Consensus & Reviewer Pool
    CONSENSUS_POOL_SIZE: int = 3
    CONSENSUS_QUORUM: int = 2
    CONSENSUS_APPROVAL_THRESHOLD: float = 0.5
    CONSENSUS_REJECTION_THRESHOLD: float = 0.5
    CONSENSUS_REVIEWER_BOUNTY: int = 5
    CONSENSUS_SLASH_PENALTY_SCORE: float = 25.0

    # Phase 7: Downstream ETL Pipeline & Loupe Integration
    LOUPE_PIPELINE_ENDPOINT: str = "https://pipeline.loupe.internal/ingest"
    LOUPE_API_KEY: str = "horizon_loupe_export_key_2026"
    EXPORT_STORAGE_DIR: str = "storage/exports"
    DEFAULT_DATASET_VERSION: str = "v1.0.0"
    ETL_MAX_RETRIES: int = 3
    LOUPE_SYNC_TIMEOUT_SECONDS: int = 10

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod", "staging")


settings = Settings()
