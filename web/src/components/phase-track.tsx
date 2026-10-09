import { PHASES, PHASE_COPY, type PhaseName } from "@/lib/types";
import { pad2 } from "@/lib/format";

/** Tournament-bracket style stepper: done = ink, current = flare, upcoming = white. */
export function PhaseTrack({ phase, compact = false }: { phase: PhaseName; compact?: boolean }) {
  const current = PHASES.indexOf(phase);
  return (
    <ol className="flex items-stretch">
      {PHASES.map((p, i) => {
        const state = i < current || phase === "Ended" ? "done" : i === current ? "active" : "todo";
        return (
          <li key={p} className="flex flex-1 items-center">
            <div
              className={`flex-1 border px-3 ${compact ? "py-1.5" : "py-3"} ${
                state === "active"
                  ? "border-flare bg-flare text-card"
                  : state === "done"
                    ? "border-ink bg-ink text-card"
                    : "border-ink/15 bg-card text-graphite/50"
              }`}
            >
              <span className="label block opacity-70">{pad2(i + 1)}</span>
              <span className={`block truncate font-medium ${compact ? "text-xs" : "text-sm"}`}>
                {compact ? PHASE_COPY[p].short : PHASE_COPY[p].label}
              </span>
              {!compact && <span className="mt-0.5 block text-xs opacity-70">{PHASE_COPY[p].hint}</span>}
            </div>
            {i < PHASES.length - 1 && (
              <span className={`h-px w-3 shrink-0 sm:w-5 ${i < current ? "bg-flare" : "bg-ink/15"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
