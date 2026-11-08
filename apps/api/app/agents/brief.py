"""The decision as agents see it: a frozen snapshot, rendered as delimited, escaped data."""

import html
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from app.db.base import utcnow

Locale = Literal["fr", "en"]

# OHADA member states (Organisation for the Harmonisation of Business Law in Africa).
OHADA = frozenset("BJ BF CM CF KM CG CI GA GN GW GQ ML NE CD SN TD TG".split())
# EU and EEA: the GDPR applies to organisations established there.
EU_EEA = frozenset(
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE "
    "IS LI NO".split()
)


def jurisdiction(country_code: str) -> str:
    """Legal frameworks that follow from the organisation's country. Deterministic."""
    code = (country_code or "").upper()
    parts = [f"Organisation registered in country code {code or 'unknown'}."]
    if code in OHADA:
        parts.append("OHADA member state: OHADA Uniform Acts apply to business law.")
    if code in EU_EEA:
        parts.append("EU/EEA member: the GDPR applies to personal data processing.")
    if code and code not in OHADA and code not in EU_EEA:
        parts.append("Neither OHADA nor EU/EEA: national law governs; check local rules.")
    parts.append(
        "If personal data of EU residents is processed, the GDPR may apply wherever the "
        "organisation is based."
    )
    return " ".join(parts)


QUESTION_LABELS = {
    "amount": "Amount at stake",
    "deadline": "Deadline or timing",
    "scope": "Scope and people affected",
    "context": "Market and competitive context",
    "alternatives": "Alternatives considered",
}


@dataclass(frozen=True)
class Answer:
    key: str
    answer: str | None
    unknown: bool


@dataclass(frozen=True)
class DecisionBrief:
    title: str
    description: str
    category: str
    context: str
    amount: Decimal | None
    currency: str | None
    deadline: date | None
    answers: tuple[Answer, ...]
    locale: Locale
    country_code: str
    today: date
    # Mitigation actions the organisation reports as done or under way: (title, status).
    actions: tuple[tuple[str, str], ...] = ()

    def answer(self, key: str) -> Answer | None:
        return next((a for a in self.answers if a.key == key), None)

    def unknowns(self) -> list[str]:
        return [a.key for a in self.answers if a.unknown]


def build_brief(job) -> DecisionBrief:  # type: ignore[no-untyped-def]
    from sqlalchemy import select

    from app.models import MitigationAction, Organization

    d = job.decision
    org = job.db.get(Organization, job.organization_id)
    locale: Locale = "en" if (org and org.default_locale.startswith("en")) else "fr"
    return DecisionBrief(
        title=d.title,
        description=d.description,
        category=str(d.category.value if hasattr(d.category, "value") else d.category),
        context=d.context or "",
        amount=d.amount,
        currency=d.currency,
        deadline=d.deadline,
        answers=tuple(
            Answer(q.key, q.answer, q.unknown)
            for q in sorted(job.questions, key=lambda q: q.position)
        ),
        locale=locale,
        country_code=org.country_code if org else "",
        today=utcnow().date(),
        actions=tuple(
            (m.title, m.status)
            for m in job.db.scalars(
                select(MitigationAction)
                .where(
                    MitigationAction.decision_id == d.id,
                    MitigationAction.status.in_(("done", "in_progress")),
                )
                .order_by(MitigationAction.created_at)
            )
        ),
    )


def _e(value: str) -> str:
    # Escaping keeps user text from closing the data tags or opening new ones.
    return html.escape(value.strip(), quote=False)


def render(brief: DecisionBrief) -> str:
    """User-turn content. Everything inside <decision> is data written by the customer."""
    amount = f"{brief.amount} {brief.currency}" if brief.amount is not None else "not provided"
    lines = [
        "<decision>",
        f"<title>{_e(brief.title)}</title>",
        f"<category>{_e(brief.category)}</category>",
        f"<amount>{_e(amount)}</amount>",
        f"<deadline>{brief.deadline.isoformat() if brief.deadline else 'not provided'}</deadline>",
        f"<organization_country>{_e(brief.country_code) or 'unknown'}</organization_country>",
        f"<jurisdiction>{_e(jurisdiction(brief.country_code))}</jurisdiction>",
        f"<description>\n{_e(brief.description)}\n</description>",
        f"<context>\n{_e(brief.context) or 'not provided'}\n</context>",
    ]
    if brief.answers:
        lines.append("<follow_up_answers>")
        for a in brief.answers:
            label = QUESTION_LABELS.get(a.key, a.key)
            value = "The decision maker does not know." if a.unknown else _e(a.answer or "")
            lines.append(f'<answer topic="{label}">{value}</answer>')
        lines.append("</follow_up_answers>")
    if brief.actions:
        lines.append("<actions_taken>")
        for title, st in brief.actions:
            label = "done" if st == "done" else "in progress"
            lines.append(f'<action status="{label}">{_e(title)}</action>')
        lines.append("</actions_taken>")
    lines.append("</decision>")
    lines.append(f"Today's date: {brief.today.isoformat()}.")
    lines.append("Analyse this decision from your specialist angle and return the report.")
    return "\n".join(lines)


def render_findings(findings: list[tuple[str, object]]) -> str:
    """Numbered findings for the audit agent. Each item is (agent key, AgentFinding)."""
    lines = ["<findings>"]
    for i, (agent, f) in enumerate(findings, start=1):
        lines.append(
            f'<finding ref="{i}" agent="{agent}" evidence_type="{f.evidence_type}" '  # type: ignore[attr-defined]
            f'likelihood="{f.likelihood}" impact="{f.impact}">'  # type: ignore[attr-defined]
        )
        lines.append(f"<title>{_e(f.title)}</title>")  # type: ignore[attr-defined]
        lines.append(f"<description>{_e(f.description)}</description>")  # type: ignore[attr-defined]
        lines.append(f"<basis>{_e(f.basis)}</basis>")  # type: ignore[attr-defined]
        lines.append("</finding>")
    lines.append("</findings>")
    lines.append("Review each finding by its ref and return the audit.")
    return "\n".join(lines)
