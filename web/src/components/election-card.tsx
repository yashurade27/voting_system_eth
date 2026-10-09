import Link from "next/link";
import type { ElectionSummary } from "@/lib/types";
import { pad2, shortAddress } from "@/lib/format";
import { PhaseTrack } from "./phase-track";

export function ElectionCard({ e }: { e: ElectionSummary }) {
  const live = e.phase === "Commit" || e.phase === "Reveal";
  return (
    <Link
      href={`/elections/${e.id}`}
      className="group flex flex-col bg-card outline-1 -outline-offset-1 outline-transparent transition-[outline-color] hover:outline-flare"
    >
      <div className="flex items-start justify-between gap-4 p-4">
        <div>
          <span className="label text-graphite/50">Election #{pad2(e.id)}</span>
          <h3 className="mt-1 text-lg font-semibold leading-snug">{e.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-graphite/70">{e.description || "No description"}</p>
        </div>
        {live && (
          <span className="label flex shrink-0 items-center gap-1.5 border border-flare px-2 py-1 text-flare">
            <span className="live-dot h-1.5 w-1.5 bg-flare" /> Live
          </span>
        )}
      </div>
      <div className="mt-auto px-4">
        <PhaseTrack phase={e.phase} compact />
      </div>
      <dl className="mt-4 grid grid-cols-3 border-t border-canvas">
        {[
          ["Roll", e.openToAll ? "Open" : e.voterCount],
          ["Sealed", e.commitCount],
          ["Opened", e.revealCount],
        ].map(([k, v]) => (
          <div key={k} className="border-r border-canvas px-4 py-3 last:border-r-0">
            <dt className="label text-graphite/50">{k}</dt>
            <dd className="display mt-1 text-xl">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between border-t border-canvas px-4 py-2.5 text-xs text-graphite/60">
        <span>
          {e.candidateCount} candidates · by <span className="font-mono">{shortAddress(e.organiser)}</span>
        </span>
        <span className="text-flare opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
      </div>
    </Link>
  );
}
