"use client";

import Link from "next/link";
import { useState } from "react";
import { computeCommitment, parseReceipt, type BallotReceipt } from "@/lib/receipt";
import { CONTRACT_ADDRESS, targetChain } from "@/lib/chain";
import type { ElectionDetail, VoterStatus } from "@/lib/types";
import { pad2, shortAddress, shortHash } from "@/lib/format";

type Check = { label: string; ok: boolean | null; detail: string };

async function verify(r: BallotReceipt): Promise<Check[]> {
  const recomputed = computeCommitment(r.electionId, r.candidateId, r.salt, r.voter);
  const checks: Check[] = [
    {
      label: "Receipt is internally consistent",
      ok: recomputed === r.commitment,
      detail: `keccak256(${r.electionId}, ${r.candidateId}, salt, ${shortAddress(r.voter)}) = ${shortHash(recomputed)}`,
    },
    {
      label: "Issued for this deployment",
      ok: r.chainId === targetChain.id && r.contract.toLowerCase() === CONTRACT_ADDRESS?.toLowerCase(),
      detail: `chain ${r.chainId} · contract ${shortAddress(r.contract)}`,
    },
  ];

  const [eRes, sRes] = await Promise.all([
    fetch(`/api/elections/${r.electionId}`, { cache: "no-store" }),
    fetch(`/api/elections/${r.electionId}/voters/${r.voter}`, { cache: "no-store" }),
  ]);
  if (!eRes.ok || !sRes.ok) {
    checks.push({ label: "Election found on-chain", ok: false, detail: `Election #${r.electionId} could not be loaded` });
    return checks;
  }
  const election: ElectionDetail = await eRes.json();
  const status: VoterStatus = await sRes.json();

  checks.push({
    label: "Matches the sealed vote on-chain",
    ok: status.commitment === r.commitment,
    detail: status.committed ? `on-chain ${shortHash(status.commitment)}` : "No sealed vote stored for this wallet",
  });

  const opened = election.phase === "Reveal" || election.phase === "Ended";
  checks.push({
    label: "Ballot opened and counted",
    ok: status.revealed ? true : opened ? false : null,
    detail: status.revealed
      ? `Counted for ${election.candidates[r.candidateId]?.name ?? `#${r.candidateId}`}`
      : opened
        ? "Ballot was not opened, so it is not in the tally"
        : `Election is still in the ${election.phase.toLowerCase()} phase — nothing to count yet`,
  });
  return checks;
}

export default function VerifyPage() {
  const [text, setText] = useState("");
  const [receipt, setReceipt] = useState<BallotReceipt | null>(null);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(raw: string) {
    setError(null);
    setChecks(null);
    const r = parseReceipt(raw);
    setReceipt(r);
    if (!r) return setError("That isn't a valid SealedBallot receipt.");
    setBusy(true);
    try {
      setChecks(await verify(r));
    } catch {
      setError("Couldn't reach the API. Is the app and local chain running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <span className="label text-flare">Audit</span>
      <h1 className="display mt-2 text-[40px]">Verify a ballot receipt</h1>
      <p className="mt-3 max-w-2xl text-graphite/70">
        Your receipt contains the secret salt used to seal your vote. Checking it recomputes the hash in your browser
        and compares it with what the smart contract stored — proving your vote was recorded exactly as cast.
      </p>

      <div className="mt-10 grid gap-2 lg:grid-cols-2">
        <section className="bg-card p-6">
          <span className="label text-graphite/50">Receipt</span>
          <input
            type="file"
            accept="application/json"
            className="mt-4 block w-full text-sm file:mr-3 file:border file:border-ink file:bg-card file:px-3 file:py-1.5"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const t = await f.text();
              setText(t);
              run(t);
            }}
          />
          <textarea
            className="field mt-3 min-h-56 font-mono text-xs"
            placeholder='{"version":1,"electionId":1,...}'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn btn-primary mt-4" disabled={!text || busy} onClick={() => run(text)}>
            {busy ? "Checking…" : "Verify receipt"}
          </button>
          {error && <p className="mt-4 border border-flare bg-mist p-3 text-sm">{error}</p>}
        </section>

        <section className="bg-card">
          <div className="border-b border-canvas px-6 py-3">
            <span className="label">Result</span>
          </div>
          {!checks ? (
            <p className="p-6 text-sm text-graphite/60">Upload or paste a receipt to see the verification steps.</p>
          ) : (
            <>
              {receipt && (
                <div className="border-b border-canvas px-6 py-4">
                  <Link href={`/elections/${receipt.electionId}`} className="label text-flare hover:underline">
                    Election #{pad2(receipt.electionId)} →
                  </Link>
                  <p className="mt-1 font-semibold">{receipt.electionTitle}</p>
                  <p className="mt-1 text-sm text-graphite/70">
                    Choice recorded in receipt: <span className="font-medium text-ink">{receipt.candidateName}</span>
                  </p>
                </div>
              )}
              <ol>
                {checks.map((c, i) => (
                  <li key={c.label} className="grid grid-cols-[48px_1fr_auto] items-center border-b border-canvas last:border-b-0">
                    <span className="grid h-full min-h-16 place-items-center bg-canvas/60 font-mono text-sm text-graphite/60">
                      {pad2(i + 1)}
                    </span>
                    <div className="px-4 py-3">
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="mt-0.5 font-mono text-xs text-graphite/60">{c.detail}</p>
                    </div>
                    <span
                      className={`label mr-4 px-2 py-1 ${
                        c.ok === true ? "bg-ink text-card" : c.ok === false ? "bg-flare text-card" : "bg-canvas"
                      }`}
                    >
                      {c.ok === true ? "Pass" : c.ok === false ? "Fail" : "Pending"}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
