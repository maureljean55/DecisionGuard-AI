"""Provider-neutral request/result types."""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from pydantic import BaseModel

if TYPE_CHECKING:
    from app.agents.brief import DecisionBrief


@dataclass(frozen=True)
class LLMRequest:
    agent: str
    system: str
    prompt: str
    output: type[BaseModel]
    # Structured input, for providers that do not read prose (the deterministic mock).
    brief: "DecisionBrief"


@dataclass(frozen=True)
class LLMResult:
    output: BaseModel
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


class LLMError(Exception):
    """A provider call that did not produce a usable result.

    `code` is stored and shown to users; it never contains tenant data or vendor messages.
    """

    def __init__(self, code: str, *, retryable: bool) -> None:
        super().__init__(code)
        self.code = code
        self.retryable = retryable


class LLMProvider(Protocol):
    name: str
    # True when results are not produced by a real model. The UI must say so.
    simulated: bool

    def complete(self, request: LLMRequest) -> LLMResult: ...
