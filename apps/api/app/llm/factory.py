from app.core.config import Settings
from app.llm.base import LLMProvider


def get_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "mock":
        from app.llm.mock import MockProvider

        return MockProvider()
    if settings.llm_provider == "anthropic":
        from app.llm.anthropic_provider import AnthropicProvider

        assert settings.llm_api_key is not None  # noqa: S101 - enforced by Settings
        return AnthropicProvider(
            api_key=settings.llm_api_key.get_secret_value(),
            model=settings.llm_model,
            effort=settings.llm_effort,
            timeout=settings.llm_timeout_seconds,
        )
    raise ValueError(f"unknown LLM provider: {settings.llm_provider}")
