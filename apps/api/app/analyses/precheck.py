"""Pre-analysis check: deterministic rules that find information missing from a decision.

Rule-based on purpose (no AI): the platform asks instead of assuming. The specialist agents
(M5+) may add their own questions later.
"""

from app.models import Decision, DecisionCategory

AMOUNT_RELEVANT = {
    DecisionCategory.FINANCIAL,
    DecisionCategory.STRATEGIC,
    DecisionCategory.OPERATIONAL,
    DecisionCategory.TECHNOLOGICAL,
    DecisionCategory.COMMERCIAL,
}
MIN_DESCRIPTION = 120
MIN_CONTEXT = 80


def missing_information(d: Decision) -> list[str]:
    """Return question keys, in the order they should be asked."""
    keys: list[str] = []
    if d.amount is None and d.category in AMOUNT_RELEVANT:
        keys.append("amount")
    if d.deadline is None:
        keys.append("deadline")
    if len(d.description.strip()) < MIN_DESCRIPTION:
        keys.append("scope")
    if not d.context or len(d.context.strip()) < MIN_CONTEXT:
        keys.append("context")
    if d.category in (DecisionCategory.STRATEGIC, DecisionCategory.COMMERCIAL):
        keys.append("alternatives")
    return keys
