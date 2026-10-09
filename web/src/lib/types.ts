import type { Address, Hex } from "viem";

export const PHASES = ["Setup", "Commit", "Reveal", "Ended"] as const;
export type PhaseName = (typeof PHASES)[number];

export const PHASE_COPY: Record<PhaseName, { label: string; short: string; hint: string }> = {
  Setup: { label: "Setup", short: "Setup", hint: "Organiser registers voters" },
  Commit: { label: "Sealed voting", short: "Voting", hint: "Votes are submitted as hashes" },
  Reveal: { label: "Reveal", short: "Reveal", hint: "Voters open their ballots" },
  Ended: { label: "Final", short: "Final", hint: "Tally frozen on-chain" },
};

export type ElectionSummary = {
  id: number;
  title: string;
  description: string;
  organiser: Address;
  openToAll: boolean;
  phase: PhaseName;
  createdAt: number;
  phaseChangedAt: number;
  voterCount: number;
  commitCount: number;
  revealCount: number;
  candidateCount: number;
};

export type CandidateResult = { id: number; name: string; votes: number };

export type ElectionDetail = ElectionSummary & {
  candidates: CandidateResult[];
  winners: number[];
};

export type ActivityItem = {
  kind: "created" | "registered" | "phase" | "committed" | "revealed";
  actor?: Address;
  detail?: string;
  blockNumber: number;
  timestamp: number;
  txHash: Hex;
};

export type VoterStatus = {
  eligible: boolean;
  committed: boolean;
  revealed: boolean;
  commitment: Hex;
};

export type Stats = {
  chainId: number;
  blockNumber: number;
  contract: Address;
  elections: number;
  live: number;
  sealedVotes: number;
  revealedVotes: number;
};
