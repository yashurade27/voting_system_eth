"use client";

import { useMemo, useReducer, useState } from "react";
import type { Hex } from "viem";
import { useConnection } from "wagmi";
import { CONTRACT_ADDRESS, targetChain } from "@/lib/chain";
import { useBallotTx, useVoterStatus } from "@/lib/hooks";
import { shortHash, pad2 } from "@/lib/format";
import {
  computeCommitment,
  downloadReceipt,
  loadReceipt,
  parseReceipt,
  randomSalt,
  saveReceipt,
  type BallotReceipt,
} from "@/lib/receipt";
import type { ElectionDetail } from "@/lib/types";
import { WalletButton } from "./wallet-button";

export function BallotPanel({ election }: { election: ElectionDetail }) {
  const { address, isConnected } = useConnection();
  const { data: status } = useVoterStatus(election.id, address);
  const { send, pending, error } = useBallotTx();
  const [choice, setChoice] = useState<number | null>(null);
  const [receiptVersion, bumpReceipt] = useReducer((n: number) => n + 1, 0);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // Only rendered client-side (election data comes from react-query), so localStorage is available.
  const receipt = useMemo(
    () =>
      address && CONTRACT_ADDRESS
        ? loadReceipt(targetChain.id, CONTRACT_ADDRESS, election.id, address, status?.commitment)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, election.id, status?.commitment, receiptVersion],
  );

  if (!isConnected || !address) {
    return (
      <Panel title="Your ballot">
        <p className="text-sm text-graphite/70">Connect a wallet to see whether you can vote in this election.</p>
        <div className="mt-4">
          <WalletButton />
        </div>
      </Panel>
    );
  }

  if (!status) return <Panel title="Your ballot"><div className="h-24 animate-pulse bg-canvas" /></Panel>;

  const receiptMatches = !!receipt && receipt.commitment === status.commitment;

  async function seal() {
    if (choice === null || !address || !CONTRACT_ADDRESS) return;
    const salt = randomSalt();
    const commitment = computeCommitment(election.id, choice, salt, address);
    const draft: BallotReceipt = {
      version: 1,
      chainId: targetChain.id,
      contract: CONTRACT_ADDRESS,
      electionId: election.id,
      electionTitle: election.title,
      candidateId: choice,
      candidateName: election.candidates[choice].name,
      voter: address,
      salt,
      commitment,
      createdAt: Math.floor(Date.now() / 1000),
    };
    saveReceipt(draft, { pending: true });
    const tx = await send("Sealing vote", { functionName: "commitVote", args: [BigInt(election.id), commitment] });
    if (!tx) return;
    const final = { ...draft, txHash: tx.transactionHash as Hex };
    saveReceipt(final);
    bumpReceipt();
    setChoice(null);
  }

  async function reveal(r: BallotReceipt) {
    await send("Opening ballot", {
      functionName: "revealVote",
      args: [BigInt(election.id), BigInt(r.candidateId), r.salt],
    });
  }

  function importReceipt(text: string) {
    const r = parseReceipt(text);
    if (!r) return setImportError("That doesn't look like a SealedBallot receipt.");
    if (r.electionId !== election.id || r.voter.toLowerCase() !== address!.toLowerCase())
      return setImportError("This receipt belongs to a different election or wallet.");
    if (computeCommitment(r.electionId, r.candidateId, r.salt, r.voter) !== status!.commitment)
      return setImportError("This receipt doesn't match the sealed vote stored on-chain.");
    saveReceipt(r);
    bumpReceipt();
    setImportError(null);
    setImportText("");
  }

  const eligibility = (
    <StatusRow
      items={[
        ["Roll", status.eligible ? "Eligible" : "Not listed", status.eligible],
        ["Sealed", status.committed ? "Yes" : "No", status.committed],
        ["Opened", status.revealed ? "Yes" : "No", status.revealed],
      ]}
    />
  );

  const receiptBox = receipt && receiptMatches && (
    <div className="mt-4 border border-ink/15 p-3">
      <div className="flex items-center justify-between">
        <span className="label text-graphite/50">Receipt · stored on this device</span>
        <button className="btn-ghost text-xs" onClick={() => downloadReceipt(receipt)}>
          Download
        </button>
      </div>
      <p className="mt-2 text-sm">
        Your choice: <span className="font-semibold">{receipt.candidateName}</span>
      </p>
      <p className="mt-1 font-mono text-xs text-graphite/60">commit {shortHash(receipt.commitment)}</p>
    </div>
  );

  const importBox = status.committed && !receiptMatches && !status.revealed && election.phase !== "Ended" && (
    <div className="mt-4 border border-flare bg-mist p-3">
      <span className="label text-flare">Receipt missing on this device</span>
      <p className="mt-1 text-sm text-graphite/80">
        Your sealed vote is on-chain, but opening it needs the salt from your receipt file.
      </p>
      <input
        type="file"
        accept="application/json"
        className="mt-3 block w-full text-xs file:mr-3 file:border file:border-ink file:bg-card file:px-3 file:py-1.5"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) importReceipt(await f.text());
        }}
      />
      <textarea
        className="field mt-2 min-h-16 font-mono text-xs"
        placeholder="…or paste receipt JSON"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
      />
      <button className="btn btn-outline mt-2 w-full" disabled={!importText} onClick={() => importReceipt(importText)}>
        Import receipt
      </button>
      {importError && <p className="mt-2 text-xs text-flare">{importError}</p>}
    </div>
  );

  return (
    <Panel title="Your ballot">
      {eligibility}

      {election.phase === "Setup" && (
        <p className="mt-4 text-sm text-graphite/70">
          {status.eligible
            ? "You're on the roll. Voting opens when the organiser starts the sealed phase."
            : "You're not on the voter roll for this election."}
        </p>
      )}

      {election.phase === "Commit" && status.eligible && (
        <>
          {status.committed && (
            <p className="mt-4 text-sm text-graphite/80">
              Your vote is sealed on-chain. You can still change it until the reveal phase starts.
            </p>
          )}
          <fieldset className="mt-4 flex flex-col gap-1.5">
            <legend className="label mb-2 text-graphite/50">{status.committed ? "Change vote" : "Choose one"}</legend>
            {election.candidates.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-3 border px-3 py-2.5 text-sm ${
                  choice === c.id ? "border-flare bg-mist" : "border-ink/15 hover:border-ink"
                }`}
              >
                <input
                  type="radio"
                  name="candidate"
                  className="sr-only"
                  checked={choice === c.id}
                  onChange={() => setChoice(c.id)}
                />
                <span className="font-mono text-xs text-graphite/50">{pad2(c.id + 1)}</span>
                <span className="flex-1 font-medium">{c.name}</span>
                <span className={`h-3 w-3 border ${choice === c.id ? "border-flare bg-flare" : "border-ink/40"}`} />
              </label>
            ))}
          </fieldset>
          <button className="btn btn-primary mt-4 w-full" disabled={choice === null || !!pending} onClick={seal}>
            {pending ?? (status.committed ? "Replace sealed vote" : "Seal my vote")}
          </button>
          <p className="mt-2 text-xs text-graphite/60">
            A random salt is generated in your browser. Keep the receipt — you need it to open your ballot.
          </p>
        </>
      )}

      {election.phase === "Commit" && !status.eligible && (
        <p className="mt-4 text-sm text-graphite/70">This wallet isn&apos;t on the voter roll for this election.</p>
      )}

      {election.phase === "Reveal" && (
        <>
          {status.revealed ? (
            <p className="mt-4 text-sm font-medium">Your ballot has been opened and counted.</p>
          ) : status.committed ? (
            receiptMatches ? (
              <>
                <p className="mt-4 text-sm text-graphite/80">
                  Voting is closed. Open your sealed ballot so it gets counted — unopened ballots don&apos;t count.
                </p>
                <button className="btn btn-primary mt-4 w-full" disabled={!!pending} onClick={() => reveal(receipt!)}>
                  {pending ?? "Open my ballot"}
                </button>
              </>
            ) : null
          ) : (
            <p className="mt-4 text-sm text-graphite/70">You didn&apos;t cast a sealed vote, so there is nothing to open.</p>
          )}
        </>
      )}

      {election.phase === "Ended" && (
        <p className="mt-4 text-sm text-graphite/70">
          {status.revealed
            ? "Your vote was counted in the final tally."
            : status.committed
              ? "Your sealed vote was never opened, so it wasn't counted."
              : "You didn't vote in this election."}
        </p>
      )}

      {receiptBox}
      {importBox}
      {error && <p className="mt-4 border border-flare bg-mist p-3 text-sm">{error}</p>}
    </Panel>
  );
}

export function Panel({ title, children, dark = false }: { title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <section className={dark ? "bg-ink text-card" : "bg-card"}>
      <div className={`border-b px-5 py-3 ${dark ? "border-card/15" : "border-canvas"}`}>
        <span className="label">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusRow({ items }: { items: [string, string, boolean][] }) {
  return (
    <dl className="grid grid-cols-3 gap-px bg-canvas">
      {items.map(([k, v, on]) => (
        <div key={k} className="bg-card py-1">
          <dt className="label text-graphite/50">{k}</dt>
          <dd className={`mt-1 text-sm font-medium ${on ? "" : "text-graphite/40"}`}>
            {on && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px bg-flare" />}
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
