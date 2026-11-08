"""Claude, through the official Anthropic SDK, with schema-validated structured output."""

import logging
from typing import Any

import anthropic
from pydantic import ValidationError

from app.llm.base import LLMError, LLMRequest, LLMResult

log = logging.getLogger(__name__)

# Re-run a request declined by safety classifiers on Anthropic's recommended fallback model.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicProvider:
    name = "anthropic"
    simulated = False

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        effort: str = "high",
        timeout: float = 300.0,
        client: Any = None,
    ) -> None:
        self.model = model
        self.effort = effort
        # The SDK retries connection errors, 408, 409, 429 and 5xx with backoff.
        self._client = client or anthropic.Anthropic(
            api_key=api_key, timeout=timeout, max_retries=2
        )

    def complete(self, request: LLMRequest) -> LLMResult:
        try:
            response = self._client.messages.parse(
                model=self.model,
                max_tokens=16000,
                system=[
                    # The system prompt is identical for every analysis of a given agent,
                    # so it is cached; the decision itself goes in the user turn.
                    {
                        "type": "text",
                        "text": request.system,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": request.prompt}],
                thinking={"type": "adaptive"},
                output_config={"effort": request.effort or self.effort},
                output_format=request.output,
                extra_headers={"anthropic-beta": FALLBACK_BETA},
                extra_body={"fallbacks": "default"},
            )
        except anthropic.AuthenticationError as exc:
            raise LLMError("llm_auth", retryable=False) from exc
        except anthropic.PermissionDeniedError as exc:
            raise LLMError("llm_permission", retryable=False) from exc
        except anthropic.BadRequestError as exc:
            raise LLMError("llm_bad_request", retryable=False) from exc
        except anthropic.RateLimitError as exc:
            raise LLMError("llm_rate_limited", retryable=True) from exc
        except anthropic.APITimeoutError as exc:
            raise LLMError("llm_timeout", retryable=True) from exc
        except anthropic.APIConnectionError as exc:
            raise LLMError("llm_unreachable", retryable=True) from exc
        except anthropic.APIStatusError as exc:
            raise LLMError("llm_unavailable", retryable=exc.status_code >= 500) from exc
        except ValidationError as exc:
            raise LLMError("llm_invalid_output", retryable=True) from exc

        log.info(
            "llm call",
            extra={
                "agent": request.agent,
                "model": response.model,
                "stop_reason": response.stop_reason,
                "request_id": getattr(response, "_request_id", None),
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
                "cache_read_tokens": getattr(response.usage, "cache_read_input_tokens", 0),
            },
        )
        if response.stop_reason == "refusal":
            raise LLMError("llm_refused", retryable=False)
        if response.stop_reason == "max_tokens":
            raise LLMError("llm_truncated", retryable=True)
        parsed = response.parsed_output
        if parsed is None:
            raise LLMError("llm_invalid_output", retryable=True)
        return LLMResult(
            output=parsed,
            model=response.model,
            input_tokens=response.usage.input_tokens or 0,
            output_tokens=response.usage.output_tokens or 0,
        )
