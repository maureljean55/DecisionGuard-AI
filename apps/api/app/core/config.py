"""Application settings, loaded exclusively from environment variables.

No secret has a usable default: in production, missing secrets fail fast at startup.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "staging", "production"]
Locale = Literal["fr", "en"]

_INSECURE_DEV_SECRET = "dev-only-insecure-secret-change-me"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", env_prefix="DG_", extra="ignore"
    )

    environment: Environment = "development"
    app_name: str = "DecisionGuard AI"
    log_level: str = "INFO"
    log_json: bool = True

    secret_key: SecretStr = SecretStr(_INSECURE_DEV_SECRET)

    database_url: str = (
        "postgresql+psycopg://decisionguard:decisionguard@localhost:5432/decisionguard"
    )
    redis_url: str = "redis://localhost:6379/0"

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    default_locale: Locale = "fr"
    supported_locales: tuple[Locale, ...] = ("fr", "en")

    # LLM provider: "mock" is deterministic and clearly labelled; never used in production.
    llm_provider: Literal["mock", "anthropic", "openai"] = "mock"
    llm_api_key: SecretStr | None = None

    @model_validator(mode="after")
    def _check_production_safety(self) -> "Settings":
        if self.environment == "production":
            if self.secret_key.get_secret_value() == _INSECURE_DEV_SECRET:
                raise ValueError("DG_SECRET_KEY must be set in production")
            if self.llm_provider == "mock":
                raise ValueError("DG_LLM_PROVIDER=mock is not allowed in production")
            if self.llm_api_key is None:
                raise ValueError("DG_LLM_API_KEY must be set in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
