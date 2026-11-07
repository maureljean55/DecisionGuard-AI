import { ArrowDown, RotateCcw } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";

type Flow = Dictionary["landing"]["flow"];

/** Split a label into lines of at most `max` characters (SVG text does not wrap). */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Desktop geometry (viewBox units). Everything is centred on the agents' column.
const MID = 262;
const AGENT = { x: 280, w: 210, h: 46, top: 47, step: 64 };
const agentY = (i: number) => AGENT.top + i * AGENT.step;
const agentCY = (i: number) => agentY(i) + AGENT.h / 2;

function DesktopDiagram({ f }: { f: Flow }) {
  return (
    <svg
      viewBox="0 -20 1200 560"
      className="hidden w-full lg:block"
      role="img"
      aria-labelledby="flow-svg-title flow-svg-desc"
    >
      <title id="flow-svg-title">{f.title}</title>
      <desc id="flow-svg-desc">{f.srSummary}</desc>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-muted" />
        </marker>
        <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-teal" />
        </marker>
      </defs>

      {/* Connectors: decision → agents → engine */}
      <g fill="none" strokeWidth="1.25" className="stroke-line">
        {f.agents.map((_, i) => (
          <path key={`in-${i}`} d={`M200 ${MID} C 240 ${MID}, 240 ${agentCY(i)}, ${AGENT.x} ${agentCY(i)}`} />
        ))}
        {f.agents.map((_, i) => (
          <path
            key={`out-${i}`}
            d={`M${AGENT.x + AGENT.w} ${agentCY(i)} C 535 ${agentCY(i)}, 535 ${MID}, 580 ${MID}`}
          />
        ))}
      </g>
      <path d={`M780 ${MID} H 846`} className="stroke-muted" strokeWidth="1.25" markerEnd="url(#arrow)" />
      <path d={`M1000 ${MID} H 1056`} className="stroke-teal" strokeWidth="1.5" markerEnd="url(#arrow-teal)" />

      {/* Feedback loop: the auditor sends unsupported conclusions back to the agents. */}
      <path
        d={`M925 207 C 925 -12, 385 -18, 385 ${AGENT.top - 4}`}
        fill="none"
        className="dg-flow stroke-teal"
        strokeWidth="1.5"
        strokeDasharray="5 6"
        markerEnd="url(#arrow-teal)"
      />
      <rect x="520" y="-2" width="270" height="26" rx="13" className="fill-night" />
      <text x="655" y="15" textAnchor="middle" fontSize="13" className="fill-teal">
        {f.loop}
      </text>

      {/* Decision */}
      <rect x="10" y={MID - 55} width="190" height="110" rx="14" className="fill-abyss stroke-line" />
      <text x="105" y={MID - 12} textAnchor="middle" fontSize="22" className="fill-ink font-display">
        {f.decision}
      </text>
      <text textAnchor="middle" fontSize="13" className="fill-muted">
        {wrap(f.decisionNote, 26).map((l, i) => (
          <tspan key={l} x="105" y={MID + 14 + i * 16}>{l}</tspan>
        ))}
      </text>

      {/* Agents */}
      {f.agents.map((name, i) => (
        <g key={name}>
          <rect x={AGENT.x} y={agentY(i)} width={AGENT.w} height={AGENT.h} rx={AGENT.h / 2} className="fill-night stroke-line" />
          <circle cx={AGENT.x + 24} cy={agentCY(i)} r="3.5" className="fill-muted" />
          <text x={AGENT.x + 40} y={agentCY(i) + 5} fontSize="16" className="fill-ink">
            {name}
          </text>
        </g>
      ))}
      <text x={AGENT.x + AGENT.w / 2} y="520" textAnchor="middle" fontSize="13" className="fill-muted">
        {f.agentsLabel}
      </text>

      {/* Scoring engine */}
      <rect x="580" y={MID - 70} width="200" height="140" rx="14" className="fill-abyss stroke-iris/60" />
      <text x="680" y={MID - 26} textAnchor="middle" fontSize="21" className="fill-ink font-display">
        {f.engine}
      </text>
      <text x="680" y={MID + 8} textAnchor="middle" fontSize="14" className="fill-[#9aa6ff] font-mono">
        {f.formula}
      </text>
      <text x="680" y={MID + 40} textAnchor="middle" fontSize="13" className="fill-muted">
        {f.engineNote}
      </text>

      {/* Auditor: solid left rule, same device as on the agents grid */}
      <rect x="850" y={MID - 55} width="150" height="110" rx="12" className="fill-abyss stroke-line" />
      <rect x="850" y={MID - 55} width="3" height="110" className="fill-teal" />
      <text x="928" y={MID - 10} textAnchor="middle" fontSize="21" className="fill-ink font-display">
        {f.auditor}
      </text>
      <text textAnchor="middle" fontSize="13" className="fill-muted">
        {wrap(f.auditorNote, 18).map((l, i) => (
          <tspan key={l} x="928" y={MID + 16 + i * 16}>{l}</tspan>
        ))}
      </text>

      {/* Report: the only light node, because it is the thing you take away */}
      <rect x="1060" y={MID - 55} width="132" height="110" rx="12" className="fill-ink" />
      <text textAnchor="middle" fontSize="20" className="fill-night font-display">
        {wrap(f.report, 12).map((l, i, all) => (
          <tspan key={l} x="1126" y={MID - (all.length - 1) * 11 - 4 + i * 22}>{l}</tspan>
        ))}
      </text>
      <text x="1126" y={MID + 34} textAnchor="middle" fontSize="13" className="fill-night/70 font-semibold">
        {f.reportNote}
      </text>
    </svg>
  );
}

function Down() {
  return (
    <div className="flex justify-center py-2 text-muted" aria-hidden>
      <ArrowDown className="size-4" />
    </div>
  );
}

function MobileDiagram({ f }: { f: Flow }) {
  return (
    <ol className="lg:hidden" aria-label={f.title}>
      <li className="rounded-2xl border border-line bg-abyss p-5 text-center">
        <p className="font-display text-2xl text-ink">{f.decision}</p>
        <p className="mt-1 text-xs text-muted">{f.decisionNote}</p>
      </li>
      <Down />
      <li className="rounded-2xl border border-line p-4">
        <ul className="grid grid-cols-2 gap-2">
          {f.agents.map((a) => (
            <li key={a} className="flex items-center gap-2 rounded-full border border-line bg-night px-3 py-2 text-sm text-ink">
              <span className="size-1.5 rounded-full bg-muted" aria-hidden />
              {a}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-xs text-muted">{f.agentsLabel}</p>
      </li>
      <Down />
      <li className="rounded-2xl border border-iris/60 bg-abyss p-5 text-center">
        <p className="font-display text-2xl text-ink">{f.engine}</p>
        <p className="mt-1 font-mono text-sm text-[#9aa6ff]">{f.formula}</p>
        <p className="mt-1 text-xs text-muted">{f.engineNote}</p>
      </li>
      <Down />
      <li className="rounded-2xl border border-line border-l-[3px] border-l-teal bg-abyss p-5 text-center">
        <p className="font-display text-2xl text-ink">{f.auditor}</p>
        <p className="mt-1 text-xs text-muted">{f.auditorNote}</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-teal/50 px-3 py-1 text-xs text-teal">
          <RotateCcw className="size-3.5" aria-hidden />
          {f.loop}
        </p>
      </li>
      <Down />
      <li className="rounded-2xl bg-ink p-5 text-center">
        <p className="font-display text-2xl text-night">{f.report}</p>
        <p className="mt-1 text-xs font-semibold text-night/70">{f.reportNote}</p>
      </li>
    </ol>
  );
}

export function AnalysisFlow({ f }: { f: Flow }) {
  return (
    <>
      <DesktopDiagram f={f} />
      <MobileDiagram f={f} />
    </>
  );
}
