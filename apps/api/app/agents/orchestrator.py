"""Runs the specialist agents for one analysis and stores what they found.

Stages (reported through `JobContext.stage`):
  analyzing  - every specialist reads the brief, in parallel (provider calls only, no DB access)
  verifying  - outputs are normalised and stored, then the audit agent reviews every finding
  simulating - deterministic risk index and scenarios (app.risk.engine), no model involved
  reporting  - provenance and results are recorded on the analysis
"""

import logging
import time
from concurrent.futures import FIRST_EXCEPTION, ThreadPoolExecutor, wait
from dataclasses import dataclass

from sqlalchemy import delete

from app.agents.brief import DecisionBrief, build_brief, render, render_findings
from app.agents.schema import AgentFinding, AgentReport, AuditReport
from app.agents.specs import AGENTS, AUDIT, AgentSpec, audit_system_prompt, system_prompt
from app.llm.base import LLMError, LLMProvider, LLMRequest, LLMResult
from app.models import AgentRun, AnalysisStatus, Finding
from app.risk import engine as risk
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

    def _call(
        self,
        spec: AgentSpec,
        brief: DecisionBrief,
        prompt: str,
        *,
        system: str | None = None,
        output: type = AgentReport,
        context: object = None,
    ) -> _Outcome:
        started = time.monotonic()
        request = LLMRequest(
            agent=spec.key,
            system=system or system_prompt(spec, brief.locale),
            prompt=prompt,
            output=output,
            brief=brief,
            context=context,
        )
        try:
            result = self.provider.complete(request)
            if not isinstance(result.output, output):
                raise LLMError("llm_invalid_output", retryable=True)
            error = None
        except LLMError as exc:
            result, error = None, exc
        except Exception:  # noqa: BLE001 - one broken agent must not sink the others
            log.exception("agent crashed", extra={"agent": spec.key})
            result, error = None, LLMError("agent_error", retryable=True)
        return _Outcome(spec, result, error, int((time.monotonic() - started) * 1000))

    def _wait(self, job: JobContext, fn, *calls):  # type: ignore[no-untyped-def]
        """Run provider calls in parallel, bounded by the job deadline."""
        with ThreadPoolExecutor(max_workers=max(len(calls), 1)) as pool:
            futures = [pool.submit(fn, *args, **kwargs) for args, kwargs in calls]
            remaining = max(job.deadline - time.monotonic(), 0)
            _, pending = wait(futures, timeout=remaining, return_when=FIRST_EXCEPTION)
            if pending:
                for f in pending:
                    f.cancel()
                raise AnalysisTimeout()
            return [f.result() for f in futures]

    def run(self, job: JobContext) -> None:
        db, analysis = job.db, job.analysis
        job.stage(AnalysisStatus.ANALYZING)
        # A retry starts from a clean slate.
        db.execute(delete(AgentRun).where(AgentRun.analysis_id == analysis.id))
        brief = build_brief(job)
        prompt = render(brief)
        outcomes = self._wait(
            job, self._call, *[((spec, brief, prompt), {}) for spec in self.agents]
        )

        job.stage(AnalysisStatus.VERIFYING)
        stored: list[tuple[str, Finding, AgentFinding]] = []
        missing_items = 0
        for o in outcomes:
            run = self._new_run(job, o)
            db.add(run)
            if o.result is None:
                continue
            report = verify(o.result.output)  # type: ignore[arg-type]
            run.status = "completed"
            run.model = o.result.model
            run.summary = report.summary
            run.confidence = report.confidence
            run.missing_information = report.missing_information
            missing_items += len(report.missing_information)
            db.flush()
            for i, f in enumerate(report.findings):
                row = Finding(
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
                db.add(row)
                stored.append((o.spec.key, row, f))
        db.flush()

        succeeded = [o for o in outcomes if o.result is not None]
        if not succeeded:
            errors = [o.error for o in outcomes if o.error]
            raise AgentsFailed(
                errors[0].code if errors else "agent_error",
                retryable=any(e.retryable for e in errors),
            )

        if stored:
            self._audit(job, brief, prompt, stored)

        job.stage(AnalysisStatus.SIMULATING)
        counted = [
            risk.Item(agent, row.likelihood, row.impact)
            for agent, row, _ in stored
            if row.audit_status != "unsupported"
        ]
        inputs = risk.Inputs(
            unknown_answers=len(brief.unknowns()),
            failed_agents=len(outcomes) - len(succeeded),
            missing_items=missing_items,
        )
        excluded = len(stored) - len(counted)
        result = risk.compute(counted, inputs, excluded)
        analysis.risk_score = result.score
        analysis.risk_level = result.level
        analysis.risk_model = result.model
        analysis.risk_breakdown = result.as_dict()
        analysis.scenarios = risk.scenarios(counted, inputs, excluded)
        analysis.provider = self.provider.name
        analysis.model = succeeded[0].result.model  # type: ignore[union-attr]
        analysis.simulated = self.provider.simulated
        db.flush()
        job.stage(AnalysisStatus.REPORTING)

    def _new_run(self, job: JobContext, o: _Outcome) -> AgentRun:
        run = AgentRun(
            organization_id=job.organization_id,
            analysis_id=job.analysis.id,
            agent=o.spec.key,
            provider=self.provider.name,
            duration_ms=o.duration_ms,
            missing_information=[],
            status="failed",
        )
        if o.error is not None:
            run.error_code = o.error.code
        if o.result is not None:
            run.input_tokens = o.result.input_tokens
            run.output_tokens = o.result.output_tokens
        return run

    def _audit(
        self,
        job: JobContext,
        brief: DecisionBrief,
        prompt: str,
        stored: list[tuple[str, Finding, AgentFinding]],
    ) -> None:
        """The audit agent reviews every finding. If it fails, findings stay unaudited."""
        items = [(agent, f) for agent, _, f in stored]
        (o,) = self._wait(
            job,
            self._call,
            (
                (AUDIT, brief, f"{prompt}\n{render_findings(items)}"),
                {
                    "system": audit_system_prompt(brief.locale),
                    "output": AuditReport,
                    "context": items,
                },
            ),
        )
        run = self._new_run(job, o)
        job.db.add(run)
        if o.result is None:
            return
        report: AuditReport = o.result.output  # type: ignore[assignment]
        run.status = "completed"
        run.model = o.result.model
        run.summary = _clip(report.summary, 2000)
        seen: set[int] = set()
        for review in report.reviews:
            if not 1 <= review.ref <= len(stored) or review.ref in seen:
                continue  # ignore references to findings that do not exist
            seen.add(review.ref)
            row = stored[review.ref - 1][1]
            row.audit_status = review.verdict
            row.audit_note = _clip(review.note, 600)
            row.evidence_type = review.evidence_type
        job.db.flush()
