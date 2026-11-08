"""The decision as agents see it: a frozen snapshot, rendered as delimited, escaped data."""

import html
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from app.db.base import utcnow

Locale = Literal["fr", "en"]

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

    def answer(self, key: str) -> Answer | None:
        return next((a for a in self.answers if a.key == key), None)

    def unknowns(self) -> list[str]:
        return [a.key for a in self.answers if a.unknown]


def build_brief(job) -> DecisionBrief:  # type: ignore[no-untyped-def]
    from app.models import Organization

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
    lines.append("</decision>")
    lines.append(f"Today's date: {brief.today.isoformat()}.")
    lines.append("Analyse this decision from your specialist angle and return the report.")
    return "\n".join(lines)
