"""Analysis pipeline contract. The multi-agent engine (M5+) implements `AnalysisPipeline`."""

import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol

from sqlalchemy.orm import Session

from app.models import Analysis, AnalysisStatus, Decision, DecisionQuestion


class EngineUnavailable(Exception):  # noqa: N818 - reads as a state, not an error
    """No analysis engine is configured: the job goes back to the queue, untouched."""


class AnalysisTimeout(Exception):  # noqa: N818
    pass


@dataclass
class JobContext:
    """Everything a pipeline may use. `db` is scoped to the analysis's organisation (RLS)."""

    db: Session
    analysis: Analysis
    decision: Decision
    questions: list[DecisionQuestion]
    deadline: float
    _progress: Callable[[AnalysisStatus], None] = field(repr=False, default=lambda s: None)

    @property
    def organization_id(self) -> uuid.UUID:
        return self.analysis.organization_id

    def stage(self, status: AnalysisStatus) -> None:
        """Report progress (also refreshes the heartbeat)."""
        self.check_deadline()
        self._progress(status)

    def check_deadline(self) -> None:
        if time.monotonic() > self.deadline:
            raise AnalysisTimeout()


class AnalysisPipeline(Protocol):
    def run(self, job: JobContext) -> None: ...


class NoEnginePipeline:
    """Default until the engine ships: never invents results."""

    def run(self, job: JobContext) -> None:
        raise EngineUnavailable()


def get_pipeline(engine: str) -> AnalysisPipeline:
    if engine == "none":
        return NoEnginePipeline()
    raise ValueError(f"unknown analysis engine: {engine}")
