import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import AnalysisStatus


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    answer: str | None
    unknown: bool
    answered_at: datetime | None


class AnalysisSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: AnalysisStatus
    waiting_reason: str | None
    error_code: str | None
    attempts: int
    created_at: datetime
    finished_at: datetime | None
    open_questions: int = 0


class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    evidence_type: str
    basis: str
    likelihood: int
    impact: int
    mitigation: str


class AgentRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    agent: str
    status: str
    model: str | None
    summary: str | None
    confidence: str | None
    missing_information: list[str]
    error_code: str | None
    findings: list[FindingOut] = []


class AnalysisOut(AnalysisSummary):
    decision_id: uuid.UUID
    decision_title: str | None = None
    max_attempts: int
    started_at: datetime | None
    updated_at: datetime
    questions: list[QuestionOut] = []
    provider: str | None = None
    model: str | None = None
    simulated: bool = False
    agents: list[AgentRunOut] = []


class AnswerIn(BaseModel):
    answer: str | None = Field(default=None, max_length=2000)
    unknown: bool = False

    @model_validator(mode="after")
    def _answer_or_unknown(self) -> "AnswerIn":
        if not self.unknown and not (self.answer or "").strip():
            raise ValueError("answer is required unless unknown is true")
        return self


class UsageOut(BaseModel):
    plan: str
    period_start: date
    used: int
    limit: int | None
