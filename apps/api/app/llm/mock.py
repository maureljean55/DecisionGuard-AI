"""Deterministic stand-in for a real model, for development and demos without an API key.

It applies simple rules to the fields the customer filled in. It does not reason, and every
analysis it produces is flagged `simulated` so the interface can say so plainly.
"""

from app.agents.brief import DecisionBrief
from app.agents.schema import AgentFinding, AgentReport, AuditReport, FindingReview
from app.llm.base import LLMRequest, LLMResult

MODEL = "rules-v1"


def _money(brief: DecisionBrief) -> str:
    assert brief.amount is not None  # noqa: S101
    whole = f"{brief.amount:,.0f}".replace(",", " ")
    return f"{whole} {brief.currency or ''}".strip()


def _fr(text: str) -> str:
    # French typography: non-breaking space before ":" and narrow one before ";?!".
    text = text.replace(" :", "\u00a0:")
    for mark in ";?!":
        text = text.replace(f" {mark}", f"\u202f{mark}")
    return text


def _t(brief: DecisionBrief, fr: str, en: str) -> str:
    return _fr(fr) if brief.locale == "fr" else en


def _f(
    brief: DecisionBrief,
    title: tuple[str, str],
    description: tuple[str, str],
    evidence: str,
    basis: tuple[str, str],
    likelihood: int,
    impact: int,
    mitigation: tuple[str, str],
) -> AgentFinding:
    return AgentFinding(
        title=_t(brief, *title),
        description=_t(brief, *description),
        evidence_type=evidence,  # type: ignore[arg-type]
        basis=_t(brief, *basis),
        likelihood=likelihood,
        impact=impact,
        mitigation=_t(brief, *mitigation),
    )


def _mentions(brief: DecisionBrief, *words: str) -> bool:
    text = " ".join(
        [brief.description, brief.context, *(a.answer or "" for a in brief.answers)]
    ).casefold()
    return any(w in text for w in words)


def _finance(b: DecisionBrief) -> list[AgentFinding]:
    out = []
    if b.amount is not None:
        out.append(
            _f(
                b,
                (f"Engagement de {_money(b)}", f"Commitment of {_money(b)}"),
                (
                    "Le montant engagé est connu, mais pas sa part dans la trésorerie ou le "
                    "chiffre d'affaires de l'organisation : l'exposition réelle reste à "
                    "mesurer.",
                    "The amount is known, but not its share of the organisation's cash or "
                    "revenue, so the real exposure remains to be measured.",
                ),
                "fact",
                ("Montant saisi dans la décision.", "Amount entered in the decision."),
                3,
                4,
                (
                    "Rapporter le montant à la trésorerie disponible sur 12 mois.",
                    "Compare the amount with 12 months of available cash.",
                ),
            )
        )
    else:
        out.append(
            _f(
                b,
                ("Montant engagé inconnu", "Amount at stake unknown"),
                (
                    "Sans montant, ni l'exposition ni le retour attendu ne peuvent être évalués.",
                    "Without an amount, neither the exposure nor the expected return can be "
                    "assessed.",
                ),
                "assumption",
                ("Aucun montant fourni.", "No amount provided."),
                3,
                3,
                ("Chiffrer une fourchette basse et haute.", "Put a low and high range on it."),
            )
        )
    if not _mentions(b, "rentab", "roi", "marge", "margin", "profit", "retour", "payback"):
        out.append(
            _f(
                b,
                ("Retour sur investissement non documenté", "Return on investment not stated"),
                (
                    "Rien n'indique quand ni comment l'investissement serait récupéré.",
                    "Nothing says when or how the investment would be recovered.",
                ),
                "ai_hypothesis",
                ("Absence de mention dans la décision.", "Not mentioned in the decision."),
                3,
                3,
                (
                    "Établir un point mort et une durée de récupération.",
                    "Work out a break-even point and payback period.",
                ),
            )
        )
    return out


def _strategy(b: DecisionBrief) -> list[AgentFinding]:
    out = []
    alt = b.answer("alternatives")
    if alt and alt.answer and not alt.unknown:
        out.append(
            _f(
                b,
                ("Alternatives à comparer", "Alternatives to compare"),
                (
                    "Des alternatives ont été citées ; leur comparaison chiffrée renforcerait "
                    "la décision.",
                    "Alternatives were named; a costed comparison would strengthen the decision.",
                ),
                "fact",
                ("Réponse à la question sur les alternatives.", "Answer on alternatives."),
                2,
                2,
                (
                    "Comparer les options sur trois critères communs.",
                    "Compare the options on three shared criteria.",
                ),
            )
        )
    else:
        out.append(
            _f(
                b,
                ("Aucune alternative comparée", "No alternative compared"),
                (
                    "La décision est présentée seule : le risque est de retenir une option "
                    "sans savoir si une autre ferait mieux.",
                    "The decision stands alone: an option may be chosen without knowing "
                    "whether another would do better.",
                ),
                "assumption",
                ("Pas d'alternative indiquée.", "No alternative given."),
                3,
                3,
                (
                    "Formuler au moins une alternative, y compris ne rien faire.",
                    "State at least one alternative, including doing nothing.",
                ),
            )
        )
    if _mentions(b, "concurren", "competit", "rival"):
        out.append(
            _f(
                b,
                ("Réaction de la concurrence", "Competitor response"),
                (
                    "Un concurrent est mentionné ; il pourrait réagir sur les prix ou "
                    "accélérer ses propres projets.",
                    "A competitor is mentioned; it may respond on price or speed up its own plans.",
                ),
                "ai_hypothesis",
                ("Concurrent cité dans le contexte.", "Competitor named in the context."),
                3,
                4,
                (
                    "Anticiper deux réactions probables et la riposte prévue.",
                    "Anticipate two likely responses and the planned answer.",
                ),
            )
        )
    return out


def _operations(b: DecisionBrief) -> list[AgentFinding]:
    out = []
    if b.deadline:
        days = (b.deadline - b.today).days
        tight = days < 120
        out.append(
            _f(
                b,
                (
                    f"Échéance dans {days} jours",
                    f"Deadline in {days} days",
                ),
                (
                    "Le délai paraît court pour préparer, recruter et lancer."
                    if tight
                    else "Le délai laisse une marge, à condition de jalonner le projet.",
                    "The timeline looks short to prepare, staff and launch."
                    if tight
                    else "The timeline leaves room, provided the project is milestoned.",
                ),
                "estimate",
                ("Calculé depuis l'échéance saisie.", "Computed from the deadline entered."),
                4 if tight else 2,
                3,
                (
                    "Découper en jalons et identifier le chemin critique.",
                    "Break into milestones and identify the critical path.",
                ),
            )
        )
    else:
        out.append(
            _f(
                b,
                ("Calendrier non défini", "No timeline set"),
                (
                    "Sans échéance, la charge des équipes ne peut pas être planifiée.",
                    "Without a deadline, team workload cannot be planned.",
                ),
                "assumption",
                ("Aucune échéance fournie.", "No deadline provided."),
                3,
                2,
                ("Fixer une date cible réaliste.", "Set a realistic target date."),
            )
        )
    scope = b.answer("scope")
    if len(b.description) < 200 and not (scope and scope.answer):
        out.append(
            _f(
                b,
                ("Périmètre peu précisé", "Scope loosely defined"),
                (
                    "La description ne dit pas qui est concerné ni ce qui change concrètement.",
                    "The description does not say who is affected or what changes in practice.",
                ),
                "assumption",
                ("Description courte.", "Short description."),
                3,
                3,
                (
                    "Lister les équipes, sites et processus touchés.",
                    "List the teams, sites and processes affected.",
                ),
            )
        )
    return out


_RULES = {"finance": _finance, "strategy": _strategy, "operations": _operations}

_MISSING = {
    "amount": ("Montant engagé", "Amount at stake"),
    "deadline": ("Échéance", "Deadline"),
    "scope": ("Périmètre concerné", "Scope affected"),
    "context": ("Contexte de marché", "Market context"),
    "alternatives": ("Alternatives envisagées", "Alternatives considered"),
}


def _audit(request: LLMRequest) -> AuditReport:
    """Rule: AI hypotheses are flagged as weak; everything else is accepted as labelled."""
    b = request.brief
    reviews = []
    for i, (_, f) in enumerate(request.context or [], start=1):
        weak = f.evidence_type == "ai_hypothesis"
        reviews.append(
            FindingReview(
                ref=i,
                verdict="weak" if weak else "supported",
                evidence_type=f.evidence_type,
                note=_t(
                    b,
                    "Hypothèse générée, à confirmer avant d'en tenir compte."
                    if weak
                    else "Cohérent avec les informations fournies.",
                    "Generated hypothesis, to confirm before relying on it."
                    if weak
                    else "Consistent with the information provided.",
                ),
            )
        )
    return AuditReport(
        summary=_t(
            b,
            "Audit simulé par des règles fixes : les hypothèses générées sont signalées comme "
            "fragiles. Aucun modèle d'IA n'a relu ces constats.",
            "Simulated audit with fixed rules: generated hypotheses are flagged as weak. No AI "
            "model reviewed these findings.",
        ),
        reviews=reviews,
    )


class MockProvider:
    name = "mock"
    simulated = True

    def complete(self, request: LLMRequest) -> LLMResult:
        if request.agent == "audit":
            return LLMResult(output=_audit(request), model=MODEL)
        b = request.brief
        findings = _RULES[request.agent](b)
        report = AgentReport(
            summary=_t(
                b,
                f"Résultat simulé par des règles fixes : {len(findings)} points relevés à "
                "partir des champs renseignés. Aucun modèle d'IA n'a analysé cette décision.",
                f"Simulated with fixed rules: {len(findings)} points drawn from the fields "
                "filled in. No AI model analysed this decision.",
            ),
            confidence="low",
            findings=findings,
            missing_information=[_t(b, *_MISSING[k]) for k in b.unknowns() if k in _MISSING],
        )
        return LLMResult(output=report, model=MODEL)
