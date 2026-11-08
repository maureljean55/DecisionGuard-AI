"""Runs the specialist agents for one analysis and stores what they found.

Stages (reported through `JobContext.stage`):
  analyzing  - every agent reads the brief, in parallel (provider calls only, no DB access)
  verifying  - outputs are checked and normalised before storage
  reporting  - provenance is recorded on the analysis
Scenario simulation and the deterministic risk score arrive in M6.
"""

import logging
import time
from concurrent.futures import FIRST_EXCEPTION, ThreadPoolExecutor, wait
from dataclasses import dataclass

from sqlalchemy import delete

from app.agents.brief import DecisionBrief, build_brief, render
from app.agents.schema import AgentFinding, AgentReport
from app.agents.specs import AGENTS, AgentSpec, system_prompt
from app.llm.base import LLMError, LLMProvider, LLMRequest, LLMResult
from app.models import AgentRun, AnalysisStatus, Finding
from app.worker.pipeline import AnalysisTimeout, JobContext

log = logging.getLogger(__name__)

MAX_FINDINGS = 6
MAX_MISSING = 5


class AgentsFailed(Exception):  # noqa: N818
    """No agent produced a result. Carries a safe error code for the analysis."""

    def __init__(self, code: str, *, retryable: bool) -> None:
        super().__init__(code)
        self.error_code = code
        self.retryable = retryable


@dataclass
class _Outcome:
    spec: AgentSpec
    result: LLMResult | None
    error: LLMError | None
    duration_ms: int


def _clip(value: str, limit: int) -> str:
    value = " ".join(value.split())
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def _scale(value: int) -> int:
    return min(max(int(value), 1), 5)


def verify(report: AgentReport) -> AgentReport:
    """Normalise a validated report: bounded sizes, 1–5 scales, no duplicate findings."""
    seen: set[str] = set()
    findings: list[AgentFinding] = []
    for f in report.findings:
        title = _clip(f.title, 200)
        key = title.casefold()
        if not title or key in seen:
            continue
        seen.add(key)
        findings.append(
            AgentFinding(
                title=title,
                description=_clip(f.description, 2000),
                evidence_type=f.evidence_type,
                basis=_clip(f.basis, 600),
                likelihood=_scale(f.likelihood),
                impact=_scale(f.impact),
                mitigation=_clip(f.mitigation, 1000),
            )
        )
        if len(findings) == MAX_FINDINGS:
            break
    return AgentReport(
        summary=_clip(report.summary, 2000),
        confidence=report.confidence,
        findings=findings,
        missing_information=[_clip(m, 300) for m in report.missing_information if m.strip()][
            :MAX_MISSING
        ],
    )


class AgentPipeline:
    def __init__(self, provider: LLMProvider, agents: tuple[AgentSpec, ...] = AGENTS) -> None:
        self.provider = provider
        self.agents = agents

    def _call(self, spec: AgentSpec, brief: DecisionBrief, prompt: str) -> _Outcome:
        started = time.monotonic()
        request = LLMRequest(
            agent=spec.key,
            system=system_prompt(spec, brief.locale),
            prompt=prompt,
            output=AgentReport,
            brief=brief,
        )
        try:
            result = self.provider.complete(request)
            if not isinstance(result.output, AgentReport):
                raise LLMError("llm_invalid_output", retryable=True)
            error = None
        except LLMError as exc:
            result, error = None, exc
        except Exception:  # noqa: BLE001 - one broken agent must not sink the others
            log.exception("agent crashed", extra={"agent": spec.key})
            result, error = None, LLMError("agent_error", retryable=True)
        return _Outcome(spec, result, error, int((time.monotonic() - started) * 1000))

    def run(self, job: JobContext) -> None:
        db, analysis = job.db, job.analysis
        job.stage(AnalysisStatus.ANALYZING)
        # A retry starts from a clean slate.
        db.execute(delete(AgentRun).where(AgentRun.analysis_id == analysis.id))
        brief = build_brief(job)
        prompt = render(brief)

        with ThreadPoolExecutor(max_workers=len(self.agents)) as pool:
            futures = [pool.submit(self._call, spec, brief, prompt) for spec in self.agents]
            remaining = max(job.deadline - time.monotonic(), 0)
            done, pending = wait(futures, timeout=remaining, return_when=FIRST_EXCEPTION)
            if pending:
                for f in pending:
                    f.cancel()
                raise AnalysisTimeout()
            outcomes = [f.result() for f in futures]

        job.stage(AnalysisStatus.VERIFYING)
        succeeded = 0
        for o in outcomes:
            run = AgentRun(
                organization_id=job.organization_id,
                analysis_id=analysis.id,
                agent=o.spec.key,
                provider=self.provider.name,
                duration_ms=o.duration_ms,
                missing_information=[],
            )
            if o.result is None:
                assert o.error is not None  # noqa: S101
                run.status = "failed"
                run.error_code = o.error.code
                db.add(run)
                continue
            report = verify(o.result.output)  # type: ignore[arg-type]
            run.status = "completed"
            run.model = o.result.model
            run.summary = report.summary
            run.confidence = report.confidence
            run.missing_information = report.missing_information
            run.input_tokens = o.result.input_tokens
            run.output_tokens = o.result.output_tokens
            db.add(run)
            db.flush()
            for i, f in enumerate(report.findings):
                db.add(
                    Finding(
                        organization_id=job.organization_id,
                        analysis_id=analysis.id,
                        agent_run_id=run.id,
                        agent=o.spec.key,
                        position=i,
                        title=f.title,
                        description=f.description,
                        evidence_type=f.evidence_type,
                        basis=f.basis,
                        likelihood=f.likelihood,
                        impact=f.impact,
                        mitigation=f.mitigation,
                    )
                )
            succeeded += 1
        db.flush()

        if succeeded == 0:
            errors = [o.error for o in outcomes if o.error]
            raise AgentsFailed(
                errors[0].code if errors else "agent_error",
                retryable=any(e.retryable for e in errors),
            )

        analysis.provider = self.provider.name
        analysis.model = next((o.result.model for o in outcomes if o.result), None)
        analysis.simulated = self.provider.simulated
        db.flush()
        job.stage(AnalysisStatus.REPORTING)
