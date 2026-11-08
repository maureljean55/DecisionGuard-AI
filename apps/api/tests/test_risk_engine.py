"""Deterministic risk engine: pure functions, no database."""

from app.risk.engine import Inputs, Item, compute, level_of, scenarios, sensitivity, shift


def test_empty_is_zero() -> None:
    r = compute([])
    assert (r.score, r.level, r.counted) == (0, "low", 0)


def test_formula_is_explicit() -> None:
    items = [Item("finance", 4, 4), Item("strategy", 2, 3), Item("operations", 1, 2)]
    r = compute(items, Inputs(unknown_answers=1, failed_agents=0, missing_items=5))
    # peak 16/25, concentration mean(16,6,2)/25 = 8/25, breadth 1/3, uncertainty (1+0+1)/6
    expected = 100 * (0.45 * 16 / 25 + 0.30 * 8 / 25 + 0.15 / 3 + 0.10 * 2 / 6)
    assert r.score == round(expected) == 47
    assert r.level == "high"
    assert r.components == {"peak": 64, "concentration": 32, "breadth": 33, "uncertainty": 33}
    assert r.per_agent == {"finance": 16, "strategy": 6, "operations": 2}
    assert r.matrix[3][3] == 1 and r.matrix[2][1] == 1 and r.matrix[1][0] == 1
    assert compute(items, Inputs(1, 0, 5)).as_dict() == r.as_dict()  # deterministic


def test_levels_and_bounds() -> None:
    assert [level_of(s) for s in (0, 24, 25, 44, 45, 64, 65, 100)] == [
        "low",
        "low",
        "moderate",
        "moderate",
        "high",
        "high",
        "critical",
        "critical",
    ]
    worst = compute([Item("finance", 5, 5)] * 5, Inputs(10, 3, 30))
    assert worst.score == 100


def test_shift_clamps_and_scenarios_are_ordered() -> None:
    items = [Item("finance", 5, 1), Item("strategy", 1, 3)]
    moved = shift(items, {"finance": (2, -3)}, default=(-1, 0))
    assert moved == [Item("finance", 5, 1), Item("strategy", 1, 3)]
    s = scenarios([Item("finance", 3, 3), Item("strategy", 2, 4)], Inputs())
    assert [x["key"] for x in s] == ["favourable", "median", "adverse", "severe"]
    scores = [x["score"] for x in s]
    assert scores == sorted(scores)
    assert s[1]["score"] == compute([Item("finance", 3, 3), Item("strategy", 2, 4)]).score


def test_sensitivity_is_sorted_by_swing() -> None:
    items = [Item("finance", 4, 5), Item("finance", 3, 4), Item("people", 2, 2)]
    rows = sensitivity(items, Inputs())
    assert [r["agent"] for r in rows] == ["finance", "people"]
    base = compute(items).score
    assert all(r["base"] == base and r["down"] <= base <= r["up"] for r in rows)
    assert rows[0]["up"] - rows[0]["down"] >= rows[1]["up"] - rows[1]["down"]
