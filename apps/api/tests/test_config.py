import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_development_defaults_use_mock_llm() -> None:
    s = Settings(_env_file=None)
    assert s.environment == "development"
    assert s.llm_provider == "mock"
    assert s.default_locale == "fr"


def test_production_rejects_default_secret() -> None:
    with pytest.raises(ValidationError, match="DG_SECRET_KEY"):
        Settings(
            _env_file=None, environment="production", llm_provider="anthropic", llm_api_key="k"
        )


def test_production_rejects_mock_llm() -> None:
    with pytest.raises(ValidationError, match="mock"):
        Settings(_env_file=None, environment="production", secret_key="a-real-secret-value")


def test_production_requires_llm_key() -> None:
    with pytest.raises(ValidationError, match="DG_LLM_API_KEY"):
        Settings(
            _env_file=None,
            environment="production",
            secret_key="a-real-secret-value",
            llm_provider="anthropic",
        )


def test_valid_production_settings() -> None:
    s = Settings(
        _env_file=None,
        environment="production",
        secret_key="a-real-secret-value",
        llm_provider="anthropic",
        llm_api_key="k",
    )
    assert s.is_production
