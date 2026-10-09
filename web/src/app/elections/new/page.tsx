"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseEventLogs } from "viem";
import { useConnection } from "wagmi";
import { sealedBallotAbi } from "@/contracts/abi";
import { parseAddressList } from "@/lib/addresses";
import { useBallotTx } from "@/lib/hooks";
import { pad2 } from "@/lib/format";
import { WalletButton } from "@/components/wallet-button";

const MAX_CANDIDATES = 16;

export default function NewElectionPage() {
  const router = useRouter();
  const { isConnected, address } = useConnection();
  const { send, pending, error } = useBallotTx();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [candidates, setCandidates] = useState(["", ""]);
  const [openToAll, setOpenToAll] = useState(false);
  const [roll, setRoll] = useState("");

  const names = candidates.map((c) => c.trim()).filter(Boolean);
  const { valid: voters, invalid } = parseAddressList(roll);
  const problems = [
    !title.trim() && "Add a title",
    names.length < 2 && "Add at least two candidates",
    new Set(names.map((n) => n.toLowerCase())).size !== names.length && "Candidate names must be unique",
    !openToAll && voters.length === 0 && "Add at least one voter address, or make the election open to all",
    !openToAll && invalid.length > 0 && `${invalid.length} invalid address${invalid.length > 1 ? "es" : ""}`,
    !openToAll && voters.length > 100 && "At most 100 voters per election in this demo",
  ].filter(Boolean) as string[];

  async function submit() {
    const created = await send("Creating election", {
      functionName: "createElection",
      args: [title.trim(), description.trim(), names, openToAll],
    });
    if (!created) return;
    const [log] = parseEventLogs({ abi: sealedBallotAbi, logs: created.logs, eventName: "ElectionCreated" });
    const id = log.args.id;
    if (!openToAll) {
      const registered = await send("Registering voters", { functionName: "registerVoters", args: [id, voters] });
      if (!registered) return router.push(`/elections/${id}`);
    }
    router.push(`/elections/${id}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <span className="label text-flare">New election</span>
      <h1 className="display mt-2 text-[40px]">Write the rules</h1>
      <p className="mt-3 max-w-2xl text-graphite/70">
        Everything below is stored permanently in the smart contract. You become the organiser and control when voting
        opens and when ballots are revealed.
      </p>

      <div className="mt-10 grid gap-2 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-2">
          <section className="bg-card p-6">
            <span className="label text-graphite/50">01 · Basics</span>
            <label className="mt-4 block text-sm font-medium" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="field mt-2"
              placeholder="Class Representative — TE Computer"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label className="mt-5 block text-sm font-medium" htmlFor="desc">
              Description <span className="font-normal text-graphite/50">(optional)</span>
            </label>
            <textarea
              id="desc"
              className="field mt-2 min-h-24"
              placeholder="What are people voting on, and who is allowed to vote?"
              value={description}
              maxLength={280}
              onChange={(e) => setDescription(e.target.value)}
            />
          </section>

          <section className="bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="label text-graphite/50">02 · Candidates</span>
              <span className="label text-graphite/50">
                {names.length}/{MAX_CANDIDATES}
              </span>
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {candidates.map((c, i) => (
                <li key={i} className="flex">
                  <span className="grid w-12 shrink-0 place-items-center bg-ink font-mono text-sm text-card">
                    {pad2(i + 1)}
                  </span>
                  <input
                    className="field"
                    placeholder={`Candidate ${i + 1}`}
                    value={c}
                    maxLength={48}
                    onChange={(e) => setCandidates(candidates.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {candidates.length > 2 && (
                    <button
                      aria-label="Remove candidate"
                      className="w-12 shrink-0 border border-l-0 border-ink hover:bg-ink hover:text-card"
                      onClick={() => setCandidates(candidates.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {candidates.length < MAX_CANDIDATES && (
              <button className="btn-ghost mt-4 text-sm" onClick={() => setCandidates([...candidates, ""])}>
                + Add candidate
              </button>
            )}
          </section>

          <section className="bg-card p-6">
            <span className="label text-graphite/50">03 · Who can vote</span>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { v: false, t: "Voter roll", d: "Only addresses you register can cast a ballot." },
                { v: true, t: "Open to all", d: "Any wallet can vote once. Good for public polls." },
              ].map((o) => (
                <button
                  key={o.t}
                  onClick={() => setOpenToAll(o.v)}
                  className={`border p-4 text-left ${openToAll === o.v ? "border-flare bg-mist" : "border-ink/15 hover:border-ink"}`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span className={`h-2.5 w-2.5 border ${openToAll === o.v ? "border-flare bg-flare" : "border-ink"}`} />
                    {o.t}
                  </span>
                  <span className="mt-1 block text-sm text-graphite/70">{o.d}</span>
                </button>
              ))}
            </div>
            {!openToAll && (
              <>
                <label className="mt-5 block text-sm font-medium" htmlFor="roll">
                  Voter addresses <span className="font-normal text-graphite/50">(one per line or comma separated)</span>
                </label>
                <textarea
                  id="roll"
                  className="field mt-2 min-h-32 font-mono text-[13px]"
                  placeholder={"0x7099…79C8\n0x3C44…93BC"}
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                  <span className="font-mono">{voters.length} valid</span>
                  {invalid.length > 0 && <span className="font-mono text-flare">{invalid.length} invalid</span>}
                  {address && !voters.includes(address) && (
                    <button className="btn-ghost" onClick={() => setRoll((r) => `${r.trim()}\n${address}`.trim())}>
                      + Add my address
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-2 self-start lg:sticky lg:top-20">
          <div className="bg-card">
            <div className="border-b border-canvas p-5">
              <span className="label text-graphite/50">Preview</span>
              <p className="mt-2 text-lg font-semibold">{title.trim() || "Untitled election"}</p>
              <p className="mt-1 text-sm text-graphite/60">
                {names.length} candidates · {openToAll ? "open to all" : `${voters.length} voters`}
              </p>
            </div>
            <div className="p-5">
              <span className="label text-graphite/50">Transactions</span>
              <ol className="mt-3 space-y-2 text-sm">
                <li className={pending === "Creating election" ? "text-flare" : ""}>01 · createElection</li>
                {!openToAll && (
                  <li className={pending === "Registering voters" ? "text-flare" : ""}>02 · registerVoters</li>
                )}
              </ol>
              {problems.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-graphite/60">
                  {problems.map((p) => (
                    <li key={p}>— {p}</li>
                  ))}
                </ul>
              )}
              {error && <p className="mt-4 border border-flare bg-mist p-3 text-sm">{error}</p>}
              <div className="mt-5">
                {isConnected ? (
                  <button className="btn btn-primary w-full" disabled={problems.length > 0 || !!pending} onClick={submit}>
                    {pending ? `${pending}…` : "Publish election"}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-graphite/70">Connect a wallet to become the organiser.</p>
                    <WalletButton />
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
