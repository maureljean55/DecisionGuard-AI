"""Risk index (0–100) computed from the agents' findings.

The agents assess each finding's likelihood and impact (1–5). Everything after that is plain
arithmetic, documented here and in the report, so a score can always be explained:

    index = 100 × (0.45 × peak + 0.30 × concentration + 0.15 × breadth + 0.10 × uncertainty)

    peak           worst severity / 25            (one critical risk is enough to matter)
    concentration  mean of the 5 worst / 25       (several serious risks weigh more)
    breadth        share of findings with severity ≥ 10
    uncertainty    min(1, (unknown answers + 2 × failed agents + missing facts / 5) / 6)

Findings the audit agent marks "unsupported" are excluded.
"""

from dataclasses import asdict, dataclass, field
from statistics import mean

MODEL = "risk-v1"
WEIGHTS = {"peak": 0.45, "concentration": 0.30, "breadth": 0.15, "uncertainty": 0.10}
LEVELS = ((65, "critical"), (45, "high"), (25, "moderate"), (0, "low"))


@dataclass(frozen=True)
class Item:
    agent: str
    likelihood: int
    impact: int

    @property
    def severity(self) -> int:
        return self.likelihood * self.impact


@dataclass(frozen=True)
class Inputs:
    unknown_answers: int = 0
    failed_agents: int = 0
    missing_items: int = 0


@dataclass
class RiskResult:
    score: int
    level: str
    model: str = MODEL
    components: dict[str, int] = field(default_factory=dict)
    weights: dict[str, float] = field(default_factory=lambda: dict(WEIGHTS))
    per_agent: dict[str, int] = field(default_factory=dict)
    matrix: list[list[int]] = field(default_factory=list)  # [impact-1][likelihood-1]
    counted: int = 0
    excluded: int = 0
    inputs: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return asdict(self)


def level_of(score: int) -> str:
    return next(name for floor, name in LEVELS if score >= floor)


def _clamp(v: int) -> int:
    return min(max(v, 1), 5)


NO_INPUTS = Inputs()


def compute(items: list[Item], inputs: Inputs = NO_INPUTS, excluded: int = 0) -> RiskResult:
    matrix = [[0] * 5 for _ in range(5)]
    per_agent: dict[str, int] = {}
    for it in items:
        matrix[it.impact - 1][it.likelihood - 1] += 1
        per_agent[it.agent] = max(per_agent.get(it.agent, 0), it.severity)

    sev = sorted((it.severity for it in items), reverse=True)
    uncertainty = min(
        1.0,
        (inputs.unknown_answers + 2 * inputs.failed_agents + inputs.missing_items / 5) / 6,
    )
    parts = {
        "peak": sev[0] / 25 if sev else 0.0,
        "concentration": mean(sev[:5]) / 25 if sev else 0.0,
        "breadth": sum(1 for s in sev if s >= 10) / len(sev) if sev else 0.0,
        "uncertainty": uncertainty,
    }
    score = round(100 * sum(WEIGHTS[k] * v for k, v in parts.items()))
    return RiskResult(
        score=score,
        level=level_of(score),
        components={k: round(v * 100) for k, v in parts.items()},
        per_agent=per_agent,
        matrix=matrix,
        counted=len(items),
        excluded=excluded,
        inputs=asdict(inputs),
    )


def shift(items: list[Item], shifts: dict[str, tuple[int, int]], default=(0, 0)) -> list[Item]:
    """Move every finding's likelihood/impact by a per-agent offset, clamped to 1–5."""
    out = []
    for it in items:
        dl, di = shifts.get(it.agent, default)
        out.append(Item(it.agent, _clamp(it.likelihood + dl), _clamp(it.impact + di)))
    return out


# Fixed scenarios: what the index becomes if the agents' estimates prove too pessimistic or
# too optimistic. Offsets apply to every finding.
SCENARIOS = (
    ("favourable", (-1, 0)),
    ("median", (0, 0)),
    ("adverse", (1, 0)),
    ("severe", (1, 1)),
)


def scenarios(items: list[Item], inputs: Inputs, excluded: int = 0) -> list[dict]:
    out = []
    for key, offset in SCENARIOS:
        r = compute(shift(items, {}, default=offset), inputs, excluded)
        out.append(
            {
                "key": key,
                "likelihood_shift": offset[0],
                "impact_shift": offset[1],
                "score": r.score,
                "level": r.level,
            }
        )
    return out


def sensitivity(items: list[Item], inputs: Inputs, excluded: int = 0) -> list[dict]:
    """For each agent: the index if its findings were one notch less / more likely.

    Sorted by total swing, largest first (the tornado chart's order).
    """
    base = compute(items, inputs, excluded).score
    out = []
    for agent in sorted({it.agent for it in items}):
        down = compute(shift(items, {agent: (-1, 0)}), inputs, excluded).score
        up = compute(shift(items, {agent: (1, 0)}), inputs, excluded).score
        out.append({"agent": agent, "down": down, "up": up, "base": base})
    return sorted(out, key=lambda r: (r["up"] - r["down"], r["agent"]), reverse=True)
