"use client";

import Link from "next/link";
import { useConnection } from "wagmi";
import { useElection } from "@/lib/hooks";
import { pad2, shortAddress, pct } from "@/lib/format";
import { PhaseTrack } from "./phase-track";
import { Scoreboard } from "./scoreboard";
import { BallotPanel } from "./ballot-panel";
import { OrganiserPanel } from "./organiser-panel";
import { ActivityFeed } from "./activity-feed";
import { ChainError } from "./chain-error";

export function ElectionScreen({ id }: { id: number }) {
  const { data: e, error, isLoading } = useElection(id);
  const { address } = useConnection();

  if (isLoading) return <ElectionSkeleton />;
  if (error || !e) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        {error?.message === "Not found" ? (
          <div className="bg-card p-10 text-center">
            <p className="display text-2xl">Election #{pad2(id)} doesn&apos;t exist</p>
            <Link href="/" className="btn btn-primary mt-6">
              Back to elections
            </Link>
          </div>
        ) : (
          <ChainError message={error?.message ?? "Unknown error"} />
        )}
      </div>
    );
  }

  const isOrganiser = !!address && address.toLowerCase() === e.organiser.toLowerCase();
  const turnout = e.openToAll ? null : pct(e.commitCount, e.voterCount);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/" className="label text-graphite/50 hover:text-ink">
        ← All elections
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <span className="label text-flare">Election #{pad2(e.id)}</span>
          <h1 className="display mt-2 text-[32px] sm:text-[40px]">{e.title}</h1>
          {e.description && <p className="mt-3 text-graphite/75">{e.description}</p>}
          <p className="mt-3 text-sm text-graphite/60">
            Organised by <span className="font-mono">{shortAddress(e.organiser)}</span>
            {isOrganiser && <span className="label ml-2 bg-ink px-1.5 py-0.5 text-card">You</span>} ·{" "}
            {e.openToAll ? "open to every wallet" : `${e.voterCount} registered voters`}
          </p>
        </div>
        <dl className="grid grid-cols-3 bg-card">
          {[
            ["Sealed", e.commitCount],
            ["Opened", e.revealCount],
            ["Turnout", turnout === null ? "—" : `${turnout}%`],
          ].map(([k, v]) => (
            <div key={k} className="border-r border-canvas px-5 py-3 last:border-r-0">
              <dt className="label text-graphite/50">{k}</dt>
              <dd className="display mt-2 text-2xl">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8">
        <PhaseTrack phase={e.phase} />
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-2">
          <Scoreboard election={e} />
          <ActivityFeed id={e.id} />
        </div>
        <div className="flex flex-col gap-2 self-start lg:sticky lg:top-20">
          {isOrganiser && <OrganiserPanel election={e} />}
          <BallotPanel election={e} />
        </div>
      </div>
    </div>
  );
}

export function ElectionSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="h-4 w-28 animate-pulse bg-card" />
      <div className="mt-6 h-10 w-2/3 animate-pulse bg-card" />
      <div className="mt-8 h-16 animate-pulse bg-card" />
      <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_360px]">
        <div className="h-80 animate-pulse bg-card" />
        <div className="h-80 animate-pulse bg-card" />
      </div>
    </div>
  );
}
