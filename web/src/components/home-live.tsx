"use client";

import Link from "next/link";
import { useState } from "react";
import { useElections, useStats } from "@/lib/hooks";
import type { PhaseName } from "@/lib/types";
import { ElectionCard } from "./election-card";
import { ChainError } from "./chain-error";
import { shortAddress } from "@/lib/format";

export function LiveStats() {
  const { data, error } = useStats();
  const tiles: [string, number | string | undefined][] = [
    ["Elections", data?.elections],
    ["Live now", data?.live],
    ["Sealed votes", data?.sealedVotes],
    ["Opened votes", data?.revealedVotes],
  ];
  return (
    <div className="bg-card">
      <div className="grid grid-cols-2">
        {tiles.map(([k, v], i) => (
          <div
            key={k}
            className={`border-canvas p-5 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""}`}
          >
            <span className="label text-graphite/50">{k}</span>
            <span className={`display mt-3 block text-[40px] ${k === "Live now" && v ? "text-flare" : ""}`}>
              {v ?? "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-canvas bg-ink px-5 py-3 text-card">
        <span className="label flex items-center gap-2">
          <span className={`h-1.5 w-1.5 ${error ? "bg-card/40" : "live-dot bg-flare"}`} />
          {error ? "Node offline" : data ? `Chain ${data.chainId} · block ${data.blockNumber}` : "Connecting…"}
        </span>
        {data && <span className="label shrink-0 text-card/50">{shortAddress(data.contract)}</span>}
      </div>
    </div>
  );
}

const FILTERS: { key: string; label: string; match: (p: PhaseName) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "live", label: "Live", match: (p) => p === "Commit" || p === "Reveal" },
  { key: "setup", label: "Setup", match: (p) => p === "Setup" },
  { key: "ended", label: "Final", match: (p) => p === "Ended" },
];

export function ElectionBoard() {
  const { data, error, isLoading } = useElections();
  const [filter, setFilter] = useState("all");
  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = data?.filter((e) => active.match(e.phase)) ?? [];

  return (
    <section id="elections" className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label text-flare">Board</span>
          <h2 className="display mt-2 text-[32px]">Elections on-chain</h2>
        </div>
        <div className="flex border border-ink">
          {FILTERS.map((f) => {
            const count = data?.filter((e) => f.match(e.phase)).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`border-r border-ink px-4 py-2 text-sm last:border-r-0 ${
                  filter === f.key ? "bg-ink text-card" : "hover:bg-mist"
                }`}
              >
                {f.label}
                {count !== undefined && <span className="ml-1.5 font-mono text-xs opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        {error ? (
          <ChainError message={error.message} />
        ) : isLoading ? (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse bg-card" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-4 bg-card px-6 py-16 text-center">
            <span className="display text-2xl">No elections here yet</span>
            <p className="max-w-sm text-sm text-graphite/70">
              Anyone with a wallet can organise an election. Candidates and rules are written to the contract forever.
            </p>
            <Link href="/elections/new" className="btn btn-primary">
              Create the first one
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((e) => (
              <ElectionCard key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
