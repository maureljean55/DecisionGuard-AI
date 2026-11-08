/**
 * The nine agents of the council, in display order: the seven specialists first, then the
 * audit agent and the scenario engine, which work on the specialists' findings.
 */
export const AGENT_CATALOG = [
  { key: "finance", milestone: "M5" },
  { key: "strategy", milestone: "M5" },
  { key: "operations", milestone: "M5" },
  { key: "legal", milestone: "M7" },
  { key: "cyber", milestone: "M7" },
  { key: "people", milestone: "M7" },
  { key: "foresight", milestone: "M7" },
  { key: "audit", milestone: "M6" },
  { key: "scenarios", milestone: "M6" },
] as const;

export type AgentKey = (typeof AGENT_CATALOG)[number]["key"];
