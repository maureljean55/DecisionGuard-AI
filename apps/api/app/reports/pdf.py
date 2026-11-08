"""Decision risk report, rendered as PDF with ReportLab.

Everything printed comes from stored data: the decision, the agents' findings with their audit
verdicts, the deterministic risk index and scenarios. Nothing is generated at render time.
"""

import io
from dataclasses import dataclass
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.risk.engine import WEIGHTS

NAVY = colors.HexColor("#0d1426")
INK = colors.HexColor("#1b2333")
MUTED = colors.HexColor("#5b6678")
LINE = colors.HexColor("#d8dee9")
TEAL = colors.HexColor("#0f9fa6")
LEVEL_COLOR = {
    "low": colors.HexColor("#2f9e6e"),
    "moderate": colors.HexColor("#d9a521"),
    "high": colors.HexColor("#e07b2a"),
    "critical": colors.HexColor("#d23c55"),
}
AGENT_ORDER = ["finance", "strategy", "operations"]

T = {
    "fr": {
        "brand": "DecisionGuard · Rapport d'analyse de risque",
        "sep": "\u00a0: ",
        "categories": {
            "strategic": "Stratégique",
            "financial": "Financière",
            "operational": "Opérationnelle",
            "technological": "Technologique",
            "organizational": "Organisationnelle",
            "commercial": "Commerciale",
            "legal": "Juridique",
        },
        "org": "Organisation",
        "date": "Analyse terminée le",
        "category": "Catégorie",
        "amount": "Montant",
        "deadline": "Échéance",
        "engine": "Moteur",
        "none": "Non renseigné",
        "simulated": "Résultats simulés : produits par des règles fixes pour démonstration. "
        "Aucun modèle d'IA n'a analysé cette décision. Ne vous appuyez pas sur ce rapport.",
        "s_summary": "1. Synthèse",
        "index": "Indice de risque",
        "levels": {"low": "Faible", "moderate": "Modéré", "high": "Élevé", "critical": "Critique"},
        "components": {
            "peak": "Pic (risque le plus grave)",
            "concentration": "Concentration (5 plus graves)",
            "breadth": "Étendue (part des risques ≥ 10)",
            "uncertainty": "Incertitude (informations manquantes)",
        },
        "component": "Composante",
        "value": "Valeur",
        "weight": "Poids",
        "counted": "{n} constats pris en compte, {x} écartés par l'audit.",
        "audit": "Avis de l'agent d'audit",
        "s_map": "2. Carte des risques",
        "map_note": "Nombre de constats par case. Lignes : impact (5 en haut). "
        "Colonnes : probabilité (1 à gauche).",
        "likelihood": "Probabilité",
        "impact": "Impact",
        "s_scen": "3. Scénarios",
        "scen_note": "Indice recalculé en décalant les estimations de tous les constats.",
        "scen": {
            "favourable": "Favorable (probabilités −1)",
            "median": "Médian (estimations des agents)",
            "adverse": "Défavorable (probabilités +1)",
            "severe": "Sévère (probabilités et impacts +1)",
        },
        "scenario": "Scénario",
        "s_top": "4. Risques principaux",
        "risk": "Risque",
        "agent": "Agent",
        "sev": "Gravité",
        "evidence": "Fondement",
        "audit_col": "Audit",
        "s_agents": "5. Constats par agent",
        "agents": {
            "finance": "Finance",
            "strategy": "Stratégie",
            "operations": "Opérations",
            "audit": "Audit",
        },
        "evidence_t": {
            "fact": "Fait",
            "assumption": "Hypothèse",
            "estimate": "Estimation",
            "ai_hypothesis": "Hypothèse IA",
        },
        "audit_t": {"supported": "Validé", "weak": "Fragile", "unsupported": "Non étayé"},
        "not_audited": "Non audité",
        "basis": "Fondement",
        "mitigation": "Atténuation",
        "audit_note": "Audit",
        "missing": "Ce qui changerait l'analyse",
        "failed": "Cet agent n'a pas pu rendre son analyse ({code}).",
        "s_method": "6. Méthode et limites",
        "method": [
            "Chaque agent spécialisé lit la décision et les réponses aux questions, puis estime "
            "pour chaque risque une probabilité et un impact de 1 à 5. L'agent d'audit relit "
            "chaque constat ; les constats « non étayés » sont exclus du calcul.",
            "L'indice est calculé sans IA, par une formule fixe : 100 × (0,45 × pic + 0,30 × "
            "concentration + 0,15 × étendue + 0,10 × incertitude). Pic : gravité maximale / 25. "
            "Concentration : moyenne des 5 gravités les plus hautes / 25. Étendue : part des "
            "constats de gravité ≥ 10. Incertitude : réponses inconnues, agents en échec et "
            "informations manquantes (comptées pour un cinquième). "
            "Seuils : 25 modéré, 45 élevé, 65 critique.",
            "Ce rapport est une aide à la décision. Il ne remplace ni le jugement de la "
            "direction, ni un avis juridique, financier ou comptable professionnel.",
        ],
        "page": "Page {n}",
        "generated": "Généré le {d}",
    },
    "en": {
        "brand": "DecisionGuard · Risk analysis report",
        "sep": ": ",
        "categories": {
            "strategic": "Strategic",
            "financial": "Financial",
            "operational": "Operational",
            "technological": "Technological",
            "organizational": "Organisational",
            "commercial": "Commercial",
            "legal": "Legal",
        },
        "org": "Organisation",
        "date": "Analysis completed on",
        "category": "Category",
        "amount": "Amount",
        "deadline": "Deadline",
        "engine": "Engine",
        "none": "Not provided",
        "simulated": "Simulated results: produced by fixed rules for demonstration. "
        "No AI model analysed this decision. Do not rely on this report.",
        "s_summary": "1. Summary",
        "index": "Risk index",
        "levels": {"low": "Low", "moderate": "Moderate", "high": "High", "critical": "Critical"},
        "components": {
            "peak": "Peak (most severe risk)",
            "concentration": "Concentration (5 most severe)",
            "breadth": "Breadth (share of risks ≥ 10)",
            "uncertainty": "Uncertainty (missing information)",
        },
        "component": "Component",
        "value": "Value",
        "weight": "Weight",
        "counted": "{n} findings counted, {x} excluded by the audit.",
        "audit": "Audit agent's opinion",
        "s_map": "2. Risk map",
        "map_note": "Number of findings per cell. Rows: impact (5 at the top). "
        "Columns: likelihood (1 on the left).",
        "likelihood": "Likelihood",
        "impact": "Impact",
        "s_scen": "3. Scenarios",
        "scen_note": "Index recomputed by shifting the estimates of every finding.",
        "scen": {
            "favourable": "Favourable (likelihood −1)",
            "median": "Median (agents' estimates)",
            "adverse": "Adverse (likelihood +1)",
            "severe": "Severe (likelihood and impact +1)",
        },
        "scenario": "Scenario",
        "s_top": "4. Main risks",
        "risk": "Risk",
        "agent": "Agent",
        "sev": "Severity",
        "evidence": "Basis",
        "audit_col": "Audit",
        "s_agents": "5. Findings by agent",
        "agents": {
            "finance": "Finance",
            "strategy": "Strategy",
            "operations": "Operations",
            "audit": "Audit",
        },
        "evidence_t": {
            "fact": "Fact",
            "assumption": "Assumption",
            "estimate": "Estimate",
            "ai_hypothesis": "AI hypothesis",
        },
        "audit_t": {"supported": "Supported", "weak": "Weak", "unsupported": "Unsupported"},
        "not_audited": "Not audited",
        "basis": "Basis",
        "mitigation": "Mitigation",
        "audit_note": "Audit",
        "missing": "What would change the assessment",
        "failed": "This agent could not return its analysis ({code}).",
        "s_method": "6. Method and limits",
        "method": [
            "Each specialist agent reads the decision and the answers to the follow-up "
            "questions, then rates each risk's likelihood and impact from 1 to 5. The audit "
            "agent reviews every finding; 'unsupported' findings are excluded from the score.",
            "The index is computed without AI, by a fixed formula: 100 × (0.45 × peak + 0.30 × "
            "concentration + 0.15 × breadth + 0.10 × uncertainty). Peak: highest severity / 25. "
            "Concentration: mean of the 5 highest severities / 25. Breadth: share of findings "
            "with severity ≥ 10. Uncertainty: unknown answers, failed agents and missing "
            "information (counted as one fifth). Thresholds: 25 moderate, 45 high, 65 critical.",
            "This report supports decisions. It does not replace management judgement or "
            "professional legal, financial or accounting advice.",
        ],
        "page": "Page {n}",
        "generated": "Generated on {d}",
    },
}


@dataclass
class ReportData:
    locale: str
    org_name: str
    title: str
    description: str
    category: str
    amount: str | None
    deadline: str | None
    finished_at: datetime | None
    provider: str | None
    model: str | None
    simulated: bool
    risk_score: int
    risk_level: str
    breakdown: dict
    scenarios: list[dict]
    runs: list[dict]  # agent, status, summary, error_code, missing_information, findings[]


def _safe(text: str | None) -> str:
    """Escape for ReportLab markup and keep to the built-in fonts' character set."""
    text = (text or "").replace(" ", " ").replace("≥", ">=")
    text = text.replace("−", "-").replace("→", "->")
    text = text.encode("cp1252", "replace").decode("cp1252")
    return escape(text).replace("\n", "<br/>")


def render(data: ReportData) -> bytes:
    t = T["fr" if data.locale == "fr" else "en"]
    sep = _safe(t["sep"])
    base = getSampleStyleSheet()
    body = ParagraphStyle("b", parent=base["BodyText"], fontSize=9.5, leading=13.5, textColor=INK)
    small = ParagraphStyle("s", parent=body, fontSize=8, leading=11, textColor=MUTED)
    h1 = ParagraphStyle(
        "h1", parent=base["Title"], fontSize=20, leading=24, alignment=0, textColor=NAVY
    )
    h2 = ParagraphStyle(
        "h2", parent=base["Heading2"], fontSize=13, leading=17, textColor=NAVY, spaceBefore=10
    )
    h3 = ParagraphStyle(
        "h3", parent=base["Heading3"], fontSize=10.5, leading=14, textColor=INK, spaceBefore=6
    )
    cell = ParagraphStyle("c", parent=body, fontSize=8.5, leading=11)
    big = ParagraphStyle(
        "big", parent=body, fontSize=30, leading=34, textColor=LEVEL_COLOR[data.risk_level]
    )
    P = Paragraph  # noqa: N806

    def grid(rows, widths, header=True):  # type: ignore[no-untyped-def]
        tbl = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
        style = [
            ("GRID", (0, 0), (-1, -1), 0.4, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        if header:
            style += [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef1f6")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        tbl.setStyle(TableStyle(style))
        return tbl

    story: list = []
    story.append(P(_safe(t["brand"]), small))
    story.append(Spacer(1, 4 * mm))
    story.append(P(_safe(data.title), h1))
    meta = [
        (t["org"], data.org_name),
        (t["date"], data.finished_at.strftime("%d/%m/%Y %H:%M UTC") if data.finished_at else ""),
        (t["category"], t["categories"].get(data.category, data.category)),
        (t["amount"], data.amount or t["none"]),
        (t["deadline"], data.deadline or t["none"]),
        (t["engine"], f"{data.provider or ''} · {data.model or ''}"),
    ]
    story.append(
        grid(
            [[P(_safe(k), small), P(_safe(v), cell)] for k, v in meta],
            [42 * mm, 128 * mm],
            header=False,
        )
    )
    if data.simulated:
        warn = Table([[P(_safe(t["simulated"]), cell)]], colWidths=[170 * mm])
        warn.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff4d6")),
                    ("BOX", (0, 0), (-1, -1), 0.6, LEVEL_COLOR["moderate"]),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story += [Spacer(1, 4 * mm), warn]
    story.append(Spacer(1, 3 * mm))
    story.append(P(_safe(data.description), body))

    # 1. Summary
    story.append(P(_safe(t["s_summary"]), h2))
    level_label = t["levels"][data.risk_level]
    story.append(
        P(
            f"{data.risk_score}<font size=14 color='#5b6678'>/100</font> "
            f"<font size=14>{_safe(level_label)}</font>",
            big,
        )
    )
    story.append(P(_safe(t["index"]), small))
    story.append(Spacer(1, 3 * mm))
    comp = data.breakdown.get("components", {})
    rows = [[t["component"], t["value"], t["weight"]]]
    for key in ("peak", "concentration", "breadth", "uncertainty"):
        rows.append(
            [P(_safe(t["components"][key]), cell), f"{comp.get(key, 0)} %", f"{WEIGHTS[key]:.2f}"]
        )
    story.append(grid(rows, [100 * mm, 35 * mm, 35 * mm]))
    story.append(Spacer(1, 2 * mm))
    story.append(
        P(
            _safe(
                t["counted"].format(
                    n=data.breakdown.get("counted", 0), x=data.breakdown.get("excluded", 0)
                )
            ),
            small,
        )
    )
    audit = next((r for r in data.runs if r["agent"] == "audit"), None)
    if audit and audit.get("summary"):
        story.append(P(_safe(t["audit"]), h3))
        story.append(P(_safe(audit["summary"]), body))

    # 2. Heat map
    story.append(P(_safe(t["s_map"]), h2))
    matrix = data.breakdown.get("matrix") or [[0] * 5 for _ in range(5)]
    rows = [["I / P"] + [str(li) for li in range(1, 6)]]
    styles = list(
        [
            ("GRID", (0, 0), (-1, -1), 0.6, colors.white),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    )
    for r, im in enumerate(range(5, 0, -1), start=1):
        row = [str(im)]
        for li in range(1, 6):
            n = matrix[im - 1][li - 1]
            row.append(str(n) if n else "")
            sev = li * im
            lv = (
                "critical"
                if sev >= 15
                else "high"
                if sev >= 10
                else "moderate"
                if sev >= 5
                else "low"
            )
            styles.append(("BACKGROUND", (li, r), (li, r), LEVEL_COLOR[lv].clone(alpha=0.28)))
            if n:
                styles.append(("FONTNAME", (li, r), (li, r), "Helvetica-Bold"))
        rows.append(row)
    heat = Table(rows, colWidths=[22 * mm] + [22 * mm] * 5, rowHeights=[7 * mm] + [11 * mm] * 5)
    heat.setStyle(TableStyle(styles))
    story.append(heat)
    story.append(P(_safe(t["map_note"]), small))

    # 3. Scenarios
    story.append(P(_safe(t["s_scen"]), h2))
    rows = [[t["scenario"], t["index"], ""]]
    for sc in data.scenarios:
        rows.append(
            [
                P(_safe(t["scen"].get(sc["key"], sc["key"])), cell),
                f"{sc['score']}/100",
                t["levels"].get(sc["level"], sc["level"]),
            ]
        )
    story.append(grid(rows, [100 * mm, 35 * mm, 35 * mm]))
    story.append(P(_safe(t["scen_note"]), small))

    # 4. Top risks
    findings = [
        (run["agent"], f) for run in data.runs if run["agent"] != "audit" for f in run["findings"]
    ]
    top = sorted(findings, key=lambda x: x[1]["likelihood"] * x[1]["impact"], reverse=True)[:10]
    if top:
        story.append(P(_safe(t["s_top"]), h2))
        rows = [[t["risk"], t["agent"], "P", "I", t["sev"], t["evidence"], t["audit_col"]]]
        for agent, f in top:
            rows.append(
                [
                    P(_safe(f["title"]), cell),
                    t["agents"].get(agent, agent),
                    str(f["likelihood"]),
                    str(f["impact"]),
                    str(f["likelihood"] * f["impact"]),
                    t["evidence_t"].get(f["evidence_type"], f["evidence_type"]),
                    t["audit_t"].get(f.get("audit_status") or "", t["not_audited"]),
                ]
            )
        story.append(grid(rows, [62 * mm, 22 * mm, 9 * mm, 9 * mm, 15 * mm, 25 * mm, 28 * mm]))

    # 5. Per agent
    story.append(P(_safe(t["s_agents"]), h2))
    for key in AGENT_ORDER:
        run = next((r for r in data.runs if r["agent"] == key), None)
        if run is None:
            continue
        story.append(P(_safe(t["agents"][key]), h3))
        if run["status"] != "completed":
            story.append(P(_safe(t["failed"].format(code=run.get("error_code") or "error")), body))
            continue
        if run.get("summary"):
            story.append(P(_safe(run["summary"]), body))
        for f in run["findings"]:
            sev = f["likelihood"] * f["impact"]
            verdict = t["audit_t"].get(f.get("audit_status") or "", t["not_audited"])
            block = [
                Spacer(1, 2 * mm),
                P(
                    f"<b>{_safe(f['title'])}</b> "
                    f"<font color='#5b6678'>· P{f['likelihood']} × I{f['impact']} = {sev} · "
                    f"{_safe(t['evidence_t'].get(f['evidence_type'], ''))} · "
                    f"{_safe(verdict)}</font>",
                    cell,
                ),
                P(_safe(f["description"]), cell),
                P(f"<i>{_safe(t['basis'])}</i>{sep}{_safe(f['basis'])}", small),
                P(f"<i>{_safe(t['mitigation'])}</i>{sep}{_safe(f['mitigation'])}", small),
            ]
            if f.get("audit_note"):
                block.append(
                    P(f"<i>{_safe(t['audit_note'])}</i>{sep}{_safe(f['audit_note'])}", small)
                )
            story.append(KeepTogether(block))
        if run.get("missing_information"):
            story.append(Spacer(1, 2 * mm))
            story.append(
                P(
                    f"<i>{_safe(t['missing'])}</i>{sep}"
                    + "; ".join(_safe(m) for m in run["missing_information"]),
                    small,
                )
            )

    # 6. Method
    story.append(P(_safe(t["s_method"]), h2))
    for para in t["method"]:
        story.append(P(_safe(para), body))
        story.append(Spacer(1, 2 * mm))

    generated = datetime.now().strftime("%d/%m/%Y")

    def footer(canvas, doc):  # type: ignore[no-untyped-def]
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(20 * mm, 10 * mm, t["generated"].format(d=generated))
        canvas.drawRightString(190 * mm, 10 * mm, t["page"].format(n=doc.page))
        canvas.setStrokeColor(TEAL)
        canvas.setLineWidth(1.2)
        canvas.line(20 * mm, 287 * mm, 190 * mm, 287 * mm)
        canvas.restoreState()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=data.title,
        author="DecisionGuard",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
