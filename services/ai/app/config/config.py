from pydantic_settings import BaseSettings, SettingsConfigDict


class AISettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    PROJECT_NAME: str = "Horizon AI Verification Service"
    ENVIRONMENT: str = "development"
    AI_SERVICE_HOST: str = "0.0.0.0"
    AI_SERVICE_PORT: int = 8000
    AI_SERVICE_API_KEY: str = "horizon_ai_dev_key"

    # Future model inference configs
    DEVICE: str = "cpu"
    PHASH_DISTANCE_THRESHOLD: int = 10
    CONFIDENCE_THRESHOLD: float = 0.85


settings = AISettings()
