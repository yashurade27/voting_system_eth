import Link from "next/link";
import { ElectionBoard, LiveStats } from "@/components/home-live";

const STEPS = [
  {
    phase: "Setup",
    title: "Organiser writes the rules",
    body: "Title, candidates and the voter roll (or open-to-all) are stored in the contract. Nobody can edit them later.",
  },
  {
    phase: "Commit",
    title: "Voters seal their ballot",
    body: "Your browser hashes your choice with a random 32-byte salt. Only the hash goes on-chain, so no one can see the trend.",
  },
  {
    phase: "Reveal",
    title: "Ballots are opened",
    body: "Each voter sends their choice and salt. The contract recomputes the hash and only counts it if it matches.",
  },
  {
    phase: "Final",
    title: "Anyone can audit",
    body: "Tallies, winners and every event are public. Download your receipt and verify your vote was counted.",
  },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-16 lg:grid-cols-[1.25fr_1fr] lg:pt-24">
        <div>
          <span className="label inline-flex items-center gap-2 border border-flare px-2 py-1 text-flare">
            Commit–reveal voting on Ethereum
          </span>
          <h1 className="display mt-6 text-[44px] sm:text-[64px]">
            Sealed ballots.
            <br />
            Public count.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-graphite/80">
            Run class, club or committee elections where every vote is locked inside a cryptographic hash until voting
            closes, then opened and counted by a smart contract that nobody can tamper with.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/elections/new" className="btn btn-primary">
              Start an election
            </Link>
            <a href="#how" className="btn-ghost text-sm">
              How sealed voting works ↓
            </a>
          </div>
        </div>
        <LiveStats />
      </section>

      <div className="border-t border-ink/10">
        <ElectionBoard />
      </div>

      <section id="how" className="bg-ink text-card">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <span className="label text-flare">Protocol</span>
          <h2 className="display mt-2 text-[32px]">Four phases, zero trust required</h2>
          <ol className="mt-10 grid gap-px bg-card/15 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.phase} className="bg-ink p-5">
                <div className="flex items-center gap-3">
                  <span className="display text-[32px] text-flare">{String(i + 1).padStart(2, "0")}</span>
                  <span className="label text-card/50">{s.phase}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-card/65">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 border border-card/15 p-5">
            <span className="label text-card/50">What actually goes on-chain during voting</span>
            <p className="mt-3 break-words font-mono text-sm sm:text-base">
              commitment = keccak256(<span className="text-flare">electionId</span> ‖{" "}
              <span className="text-flare">candidateId</span> ‖ <span className="text-flare">salt</span> ‖{" "}
              <span className="text-flare">voterAddress</span>)
            </p>
            <p className="mt-3 text-sm text-card/60">
              Binding the election id and your address means a sealed vote can&apos;t be copied by someone else or replayed
              in another election.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
