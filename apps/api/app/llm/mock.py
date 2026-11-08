"""Deterministic stand-in for a real model, for development and demos without an API key.

It applies simple rules to the fields the customer filled in. It does not reason, and every
analysis it produces is flagged `simulated` so the interface can say so plainly.
"""

from app.agents.brief import EU_EEA, OHADA, DecisionBrief
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


def _legal(b: DecisionBrief) -> list[AgentFinding]:
    code = b.country_code.upper()
    if code in OHADA:
        frame = (
            ("Cadre OHADA à vérifier", "OHADA framework to check"),
            (
                "L'organisation relève d'un État membre de l'OHADA : la forme de la structure, "
                "les contrats et les sûretés doivent respecter les Actes uniformes.",
                "The organisation is in an OHADA member state: the legal form, contracts and "
                "securities must comply with the Uniform Acts.",
            ),
        )
    elif code in EU_EEA:
        frame = (
            ("Données personnelles et RGPD", "Personal data and GDPR"),
            (
                "L'organisation est établie dans l'UE/EEE : tout traitement de données "
                "personnelles lié à la décision doit respecter le RGPD.",
                "The organisation is established in the EU/EEA: any personal data processing "
                "linked to the decision must comply with the GDPR.",
            ),
        )
    else:
        frame = (
            ("Cadre juridique national à valider", "National legal framework to confirm"),
            (
                "Ni OHADA ni UE/EEE : les règles applicables relèvent du droit national, à "
                "faire confirmer localement.",
                "Neither OHADA nor EU/EEA: the applicable rules come from national law, to be "
                "confirmed locally.",
            ),
        )
    return [
        _f(
            b,
            frame[0],
            frame[1],
            "assumption",
            ("Pays de l'organisation.", "Organisation's country."),
            3,
            3,
            (
                "Faire valider le montage par un avocat du pays concerné.",
                "Have the arrangement reviewed by a lawyer in the country concerned.",
            ),
        ),
        _f(
            b,
            ("Engagements contractuels à formaliser", "Contractual commitments to formalise"),
            (
                "Les contrats clés (partenaires, fournisseurs, bail) ne sont pas décrits : "
                "les responsabilités en cas d'échec restent floues.",
                "Key contracts (partners, suppliers, lease) are not described: liability if "
                "things go wrong is unclear.",
            ),
            "ai_hypothesis",
            ("Absence de mention dans la décision.", "Not mentioned in the decision."),
            2,
            3,
            (
                "Lister les contrats nécessaires et leurs clauses de sortie.",
                "List the contracts required and their exit clauses.",
            ),
        ),
    ]


def _cyber(b: DecisionBrief) -> list[AgentFinding]:
    out = [
        _f(
            b,
            ("Protection des données sensibles", "Protection of sensitive data"),
            (
                "La décision ne précise pas quelles données seront manipulées ni qui y aura accès.",
                "The decision does not say which data will be handled or who will access it.",
            ),
            "assumption",
            ("Absence de mention dans la décision.", "Not mentioned in the decision."),
            3,
            3,
            (
                "Inventorier les données concernées et définir les accès.",
                "Inventory the data involved and define access rights.",
            ),
        )
    ]
    if b.category == "technological" or _mentions(
        b, "cloud", "erp", "logiciel", "software", "saas", "donnée", "data", "informatique"
    ):
        out.append(
            _f(
                b,
                ("Dépendance à un prestataire informatique", "Dependence on an IT provider"),
                (
                    "Le projet repose sur un système ou un prestataire numérique : une panne "
                    "ou un changement de conditions bloquerait l'activité.",
                    "The project relies on a digital system or provider: an outage or a change "
                    "of terms would halt operations.",
                ),
                "ai_hypothesis",
                ("Dimension numérique dans la décision.", "Digital dimension in the decision."),
                3,
                4,
                (
                    "Prévoir un plan de continuité et une clause de réversibilité.",
                    "Plan for continuity and a reversibility clause.",
                ),
            )
        )
    return out


def _people(b: DecisionBrief) -> list[AgentFinding]:
    out = [
        _f(
            b,
            ("Conduite du changement", "Change management"),
            (
                "Les équipes touchées par la décision ne sont pas associées explicitement : "
                "des résistances peuvent ralentir la mise en œuvre.",
                "The teams affected are not explicitly involved: resistance may slow down "
                "implementation.",
            ),
            "ai_hypothesis",
            ("Absence de mention dans la décision.", "Not mentioned in the decision."),
            3,
            2,
            (
                "Désigner un responsable et un plan de communication interne.",
                "Appoint an owner and an internal communication plan.",
            ),
        )
    ]
    if _mentions(b, "recrut", "équipe", "personne", "salari", "recruit", "team", "staff", "hire"):
        out.append(
            _f(
                b,
                ("Recrutement des compétences", "Hiring the skills needed"),
                (
                    "La décision suppose de constituer ou d'étoffer une équipe : les délais de "
                    "recrutement peuvent décaler le calendrier.",
                    "The decision requires building or growing a team: hiring lead times may "
                    "push back the schedule.",
                ),
                "fact",
                ("Équipe mentionnée dans la décision.", "Team mentioned in the decision."),
                3,
                3,
                (
                    "Chiffrer les profils clés et leur délai de recrutement local.",
                    "Cost the key profiles and their local hiring lead time.",
                ),
            )
        )
    return out


def _foresight(b: DecisionBrief) -> list[AgentFinding]:
    return [
        _f(
            b,
            ("Évolution du marché à cinq ans", "Five-year market outlook"),
            (
                "La décision est évaluée sur la situation actuelle : un changement de la "
                "demande ou de la réglementation pourrait en modifier l'intérêt.",
                "The decision is assessed on today's situation: a shift in demand or "
                "regulation could change its value.",
            ),
            "ai_hypothesis",
            ("Horizon long non abordé.", "Long horizon not addressed."),
            2,
            3,
            (
                "Définir deux indicateurs à suivre chaque trimestre.",
                "Define two indicators to monitor every quarter.",
            ),
        )
    ]


_RULES = {
    "finance": _finance,
    "strategy": _strategy,
    "operations": _operations,
    "legal": _legal,
    "cyber": _cyber,
    "people": _people,
    "foresight": _foresight,
}

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


def _assistant(request: LLMRequest):  # type: ignore[no-untyped-def]
    """Rule: cite the findings whose words overlap the question, else the most severe ones."""
    from app.agents.assistant import AssistantAnswer

    dossier = request.context
    b = request.brief
    words = {w for w in dossier.question.casefold().split() if len(w) > 3}
    ranked = sorted(dossier.findings, key=lambda f: f.likelihood * f.impact, reverse=True)
    matched = [f for f in ranked if words & set(f.title.casefold().split())] or ranked
    picked = matched[:3]
    lines = [f"[{f.ref}] {f.title} ({f.likelihood * f.impact}/25)" for f in picked]
    answer = _t(
        b,
        "Réponse simulée par des règles fixes, sans modèle d'IA. Constats du dossier les plus "
        "proches de votre question :\n" + "\n".join(lines),
        "Simulated answer from fixed rules, without an AI model. Findings of the dossier "
        "closest to your question:\n" + "\n".join(lines),
    )
    return AssistantAnswer(answer=answer, citations=[f.ref for f in picked], confidence="low")


class MockProvider:
    name = "mock"
    simulated = True

    def complete(self, request: LLMRequest) -> LLMResult:
        if request.agent == "audit":
            return LLMResult(output=_audit(request), model=MODEL)
        if request.agent == "assistant":
            return LLMResult(output=_assistant(request), model=MODEL)
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
