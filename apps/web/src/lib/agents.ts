/** The nine specialist agents of the roadmap, in display order, with when each goes live. */
export const AGENT_CATALOG = [
  { key: "finance", milestone: "M5" },
  { key: "strategy", milestone: "M5" },
  { key: "operations", milestone: "M5" },
  { key: "audit", milestone: "M6" },
  { key: "scenarios", milestone: "M6" },
  { key: "legal", milestone: "M7" },
  { key: "cyber", milestone: "M7" },
  { key: "people", milestone: "M7" },
  { key: "foresight", milestone: "M7" },
] as const;

export type AgentKey = (typeof AGENT_CATALOG)[number]["key"];
