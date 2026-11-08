"""Application settings, loaded exclusively from environment variables.

No secret has a usable default: in production, missing secrets fail fast at startup.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "staging", "production"]
Locale = Literal["fr", "en"]

_INSECURE_DEV_SECRET = "dev-only-insecure-secret-change-me"  # noqa: S105
# Repository-root .env (local development). Real environment variables always take precedence.
_here = Path(__file__).resolve()
_ROOT_ENV = _here.parents[4] / ".env" if len(_here.parents) > 4 else Path(".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT_ENV, ".env"), env_file_encoding="utf-8", env_prefix="DG_", extra="ignore"
    )

    environment: Environment = "development"
    app_name: str = "DecisionGuard"
    log_level: str = "INFO"
    log_json: bool = True

    secret_key: SecretStr = SecretStr(_INSECURE_DEV_SECRET)

    # Runtime connection: unprivileged role `dg_app`, always subject to Row-Level Security.
    database_url: str = "postgresql+psycopg://dg_app:dg_app_dev@localhost:5432/decisionguard"
    # Migration connection: table owner. Falls back to database_url if unset.
    migration_database_url: str | None = None
    # "queue": classic connection pool (long-running server).
    # "null": one connection per use, for serverless platforms behind an external pooler.
    db_pool: Literal["queue", "null"] = "queue"
    # Disable server-side prepared statements (required behind transaction-mode poolers
    # such as Supabase Supavisor on port 6543 / PgBouncer).
    db_disable_prepared_statements: bool = False
    # Optional: used for the health check now, and by background workers later (M4).
    redis_url: str | None = None

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    # Public URL of the web app, used to build links in e-mails.
    public_web_url: str = "http://localhost:3000"

    # --- Sessions & auth ---
    session_ttl_hours: int = Field(default=24 * 14, ge=1)
    session_cookie_name: str = "dg_session"
    csrf_cookie_name: str = "dg_csrf"
    # None = secure cookies everywhere except development/test.
    cookie_secure: bool | None = None
    password_min_length: int = Field(default=12, ge=8)
    login_rate_limit: int = Field(default=10, ge=1, description="attempts per window")
    login_rate_window_seconds: int = Field(default=900, ge=1)
    # Shared secret between the web relay and the API. When set, the API trusts the
    # client IP forwarded by the relay (X-DG-Client-IP) only if X-DG-Relay-Secret matches.
    relay_secret: SecretStr | None = None

    # --- E-mail ---
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_use_tls: bool = False
    email_from: str = "DecisionGuard <no-reply@decisionguard.local>"
    # Send after the HTTP response (long-running server) or inline (serverless platforms,
    # where work after the response is not guaranteed to run).
    email_background: bool = True
    # Where messages from the public contact form are delivered (never shown on the site).
    contact_email: str | None = None

    default_locale: Locale = "fr"
    supported_locales: tuple[Locale, ...] = ("fr", "en")

    # --- Analysis worker ---
    # "none": no engine; queued analyses wait honestly instead of producing fake results.
    # "agents": the multi-agent engine, using `llm_provider`.
    analysis_engine: Literal["none", "agents"] = "none"
    worker_poll_seconds: float = Field(default=5.0, gt=0)
    analysis_timeout_seconds: int = Field(default=900, ge=30)
    # Serverless: wall-clock budget of one /internal/worker/tick call (function max duration).
    worker_tick_max_seconds: int = Field(default=290, ge=30)

    # LLM provider: "mock" is deterministic and clearly labelled; never used in production.
    llm_provider: Literal["mock", "anthropic"] = "mock"
    llm_api_key: SecretStr | None = None
    llm_model: str = "claude-opus-5-5"
    llm_effort: Literal["low", "medium", "high", "xhigh", "max"] = "high"
    llm_timeout_seconds: float = Field(default=300.0, gt=0)

    @field_validator(
        "llm_api_key",
        "smtp_password",
        "smtp_username",
        "migration_database_url",
        "redis_url",
        "relay_secret",
        "contact_email",
        mode="before",
    )
    @classmethod
    def _empty_is_unset(cls, value: object) -> object:
        # `KEY=` in a .env file means "not configured", not "configured as empty string".
        return None if value == "" else value

    @model_validator(mode="after")
    def _check_production_safety(self) -> "Settings":
        if self.llm_provider == "anthropic" and self.llm_api_key is None:
            raise ValueError("DG_LLM_API_KEY is required when DG_LLM_PROVIDER=anthropic")
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

    @property
    def secure_cookies(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.environment not in ("development", "test")


@lru_cache
def get_settings() -> Settings:
    return Settings()
