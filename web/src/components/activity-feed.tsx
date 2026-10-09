"use client";

import { useActivity } from "@/lib/hooks";
import { explorerTx } from "@/lib/chain";
import { shortAddress, shortHash, timeAgo } from "@/lib/format";
import { PHASE_COPY, type ActivityItem, type PhaseName } from "@/lib/types";

function describe(a: ActivityItem) {
  switch (a.kind) {
    case "created":
      return { tag: "CREATE", text: `Election created · ${a.detail}` };
    case "registered":
      return { tag: "ROLL", text: "Voter registered" };
    case "phase":
      return { tag: "PHASE", text: `Moved to ${PHASE_COPY[a.detail as PhaseName]?.label ?? a.detail}` };
    case "committed":
      return { tag: "SEAL", text: `Sealed vote ${shortHash(a.detail)}` };
    case "revealed":
      return { tag: "OPEN", text: `Opened ballot → ${a.detail}` };
  }
}

export function ActivityFeed({ id }: { id: number }) {
  const { data } = useActivity(id);
  return (
    <section className="bg-card">
      <div className="flex items-center justify-between border-b border-canvas px-4 py-3">
        <span className="label">On-chain activity</span>
        <span className="label text-graphite/50">Event logs</span>
      </div>
      {!data ? (
        <div className="h-40 animate-pulse" />
      ) : (
        <ul className="max-h-[420px] overflow-y-auto">
          {data.map((a) => {
            const d = describe(a);
            const href = explorerTx(a.txHash);
            return (
              <li
                key={`${a.txHash}-${a.kind}-${a.actor}`}
                className="grid grid-cols-[64px_1fr_auto] items-center gap-3 border-b border-canvas px-4 py-2.5 text-sm last:border-b-0"
              >
                <span
                  className={`label w-fit px-1.5 py-0.5 ${
                    a.kind === "revealed" || a.kind === "phase" ? "bg-flare text-card" : "bg-canvas"
                  }`}
                >
                  {d.tag}
                </span>
                <span className="min-w-0 truncate">
                  {d.text}
                  {a.actor && <span className="ml-2 font-mono text-xs text-graphite/50">{shortAddress(a.actor)}</span>}
                </span>
                <span className="text-right font-mono text-xs text-graphite/50">
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="hover:text-flare">
                      {timeAgo(a.timestamp)}
                    </a>
                  ) : (
                    <span title={`block ${a.blockNumber} · ${a.txHash}`}>#{a.blockNumber}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
