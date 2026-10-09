import type { ElectionDetail } from "@/lib/types";
import { pad2, pct } from "@/lib/format";

export function Scoreboard({ election }: { election: ElectionDetail }) {
  const sealed = election.phase === "Setup" || election.phase === "Commit";
  const total = election.candidates.reduce((n, c) => n + c.votes, 0);
  const ended = election.phase === "Ended";

  return (
    <div className="bg-card">
      <div className="flex items-center justify-between border-b border-canvas px-4 py-3">
        <span className="label">Scoreboard</span>
        <span className="label text-graphite/60">
          {sealed ? "Tallies sealed until reveal" : `${total} counted · ${election.commitCount - election.revealCount} unopened`}
        </span>
      </div>
      <ul>
        {election.candidates.map((c) => {
          const leader = !sealed && election.winners.includes(c.id);
          const share = pct(c.votes, total);
          return (
            <li key={c.id} className="grid grid-cols-[56px_1fr_96px] items-center border-b border-canvas last:border-b-0">
              <span
                className={`grid h-full min-h-16 place-items-center font-mono text-sm ${
                  leader ? "bg-flare text-card" : "bg-canvas/60 text-graphite/60"
                }`}
              >
                {pad2(c.id + 1)}
              </span>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {leader && (
                    <span className="label bg-flare px-1.5 py-0.5 text-card">{ended ? "Winner" : "Leading"}</span>
                  )}
                </div>
                <div className="mt-2 h-2 bg-canvas">
                  {sealed ? (
                    <div className="sealed h-full w-full opacity-15" />
                  ) : (
                    <div
                      className={`h-full transition-[width] duration-700 ${leader ? "bg-flare" : "bg-ink"}`}
                      style={{ width: `${share}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="pr-4 text-right">
                {sealed ? (
                  <span className="display text-2xl text-graphite/25">??</span>
                ) : (
                  <>
                    <span className="display block text-3xl">{c.votes}</span>
                    <span className="label text-graphite/50">{share}%</span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
