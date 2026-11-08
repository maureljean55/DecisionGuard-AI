"""Subscription plans and their monthly analysis quotas (enforced server-side)."""

from typing import Final

# None = no fixed limit (custom contract).
PLAN_MONTHLY_ANALYSES: Final[dict[str, int | None]] = {
    "starter": 5,
    "professional": 30,
    "business": 100,
    "enterprise": None,
}


def monthly_limit(plan: str) -> int | None:
    return PLAN_MONTHLY_ANALYSES.get(plan, PLAN_MONTHLY_ANALYSES["starter"])
