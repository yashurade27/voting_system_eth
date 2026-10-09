"use client";

import { useState } from "react";
import { parseAddressList } from "@/lib/addresses";
import { useBallotTx } from "@/lib/hooks";
import type { ElectionDetail } from "@/lib/types";
import { Panel } from "./ballot-panel";

export function OrganiserPanel({ election }: { election: ElectionDetail }) {
  const { send, pending, error } = useBallotTx();
  const [roll, setRoll] = useState("");
  const { valid, invalid } = parseAddressList(roll);
  const id = BigInt(election.id);

  const unopened = election.commitCount - election.revealCount;

  return (
    <Panel title="Organiser controls" dark>
      {election.phase === "Setup" && (
        <>
          {!election.openToAll && (
            <>
              <label className="label text-card/60" htmlFor="add-voters">
                Add voters · {election.voterCount} registered
              </label>
              <textarea
                id="add-voters"
                className="field mt-2 min-h-20 border-card/30 bg-ink font-mono text-xs text-card"
                placeholder="0x… one per line"
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-mono text-card/60">
                  {valid.length} valid{invalid.length > 0 && <span className="text-flare"> · {invalid.length} invalid</span>}
                </span>
                <button
                  className="btn border border-card/40 py-1.5 text-card hover:bg-card hover:text-ink"
                  disabled={!valid.length || invalid.length > 0 || !!pending}
                  onClick={async () => {
                    if (await send("Registering", { functionName: "registerVoters", args: [id, valid] })) setRoll("");
                  }}
                >
                  Register
                </button>
              </div>
              <hr className="my-5 border-card/15" />
            </>
          )}
          <p className="text-sm text-card/70">
            Opening voting locks the voter roll. Voters can then submit sealed ballots.
          </p>
          <button
            className="btn mt-4 w-full bg-card text-ink hover:bg-mist"
            disabled={!!pending || (!election.openToAll && election.voterCount === 0)}
            onClick={() => send("Opening voting", { functionName: "openVoting", args: [id] })}
          >
            {pending ?? "Open sealed voting →"}
          </button>
        </>
      )}

      {election.phase === "Commit" && (
        <>
          <p className="text-sm text-card/70">
            <span className="display text-2xl text-card">{election.commitCount}</span>
            {election.openToAll ? " sealed votes so far." : ` of ${election.voterCount} voters have sealed a vote.`}{" "}
            Starting the reveal closes voting for good.
          </p>
          <button
            className="btn mt-4 w-full bg-card text-ink hover:bg-mist"
            disabled={!!pending}
            onClick={() => send("Starting reveal", { functionName: "startReveal", args: [id] })}
          >
            {pending ?? "Close voting & start reveal →"}
          </button>
        </>
      )}

      {election.phase === "Reveal" && (
        <>
          <p className="text-sm text-card/70">
            <span className="display text-2xl text-card">{election.revealCount}</span> of {election.commitCount} sealed
            ballots opened.
            {unopened > 0 && ` ${unopened} still unopened — they won't count once you finalise.`}
          </p>
          <button
            className="btn mt-4 w-full bg-flare text-card hover:opacity-90"
            disabled={!!pending}
            onClick={() => send("Finalising", { functionName: "closeElection", args: [id] })}
          >
            {pending ?? "Finalise results"}
          </button>
        </>
      )}

      {election.phase === "Ended" && <p className="text-sm text-card/70">This election is final. Nothing left to do.</p>}

      {error && <p className="mt-4 border border-flare p-3 text-sm">{error}</p>}
    </Panel>
  );
}
