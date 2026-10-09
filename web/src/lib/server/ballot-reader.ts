import "server-only";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { sealedBallotAbi } from "@/contracts/abi";
import { CONTRACT_ADDRESS, DEPLOY_BLOCK, targetChain } from "@/lib/chain";
import {
  PHASES,
  type ActivityItem,
  type ElectionDetail,
  type ElectionSummary,
  type Stats,
  type VoterStatus,
} from "@/lib/types";

const client = createPublicClient({
  chain: targetChain,
  transport: http(process.env.RPC_URL ?? targetChain.rpcUrls.default.http[0]),
});

export class NotDeployedError extends Error {
  constructor() {
    super("SealedBallot is not deployed on the configured chain. Run the deploy script first.");
  }
}

function contract() {
  if (!CONTRACT_ADDRESS) throw new NotDeployedError();
  return { address: CONTRACT_ADDRESS, abi: sealedBallotAbi } as const;
}

type RawElection = {
  id: bigint;
  title: string;
  description: string;
  organiser: Address;
  openToAll: boolean;
  phase: number;
  createdAt: bigint;
  phaseChangedAt: bigint;
  voterCount: number;
  commitCount: number;
  revealCount: number;
  candidateCount: bigint;
};

function toSummary(e: RawElection): ElectionSummary {
  return {
    id: Number(e.id),
    title: e.title,
    description: e.description,
    organiser: e.organiser,
    openToAll: e.openToAll,
    phase: PHASES[e.phase],
    createdAt: Number(e.createdAt),
    phaseChangedAt: Number(e.phaseChangedAt),
    voterCount: e.voterCount,
    commitCount: e.commitCount,
    revealCount: e.revealCount,
    candidateCount: Number(e.candidateCount),
  };
}

export async function listElections(): Promise<ElectionSummary[]> {
  const c = contract();
  const count = await client.readContract({ ...c, functionName: "electionCount" });
  if (count === 0n) return [];
  const page = await client.readContract({ ...c, functionName: "getElections", args: [0n, count] });
  return page.map((e) => toSummary(e as RawElection)).reverse();
}

export async function getElection(id: number): Promise<ElectionDetail | null> {
  const c = contract();
  const count = await client.readContract({ ...c, functionName: "electionCount" });
  if (!Number.isInteger(id) || id < 0 || BigInt(id) >= count) return null;

  const [raw, candidates, winners] = await Promise.all([
    client.readContract({ ...c, functionName: "getElection", args: [BigInt(id)] }),
    client.readContract({ ...c, functionName: "getCandidates", args: [BigInt(id)] }),
    client.readContract({ ...c, functionName: "getWinners", args: [BigInt(id)] }),
  ]);

  return {
    ...toSummary(raw as RawElection),
    candidates: candidates.map((cand, i) => ({ id: i, name: cand.name, votes: Number(cand.votes) })),
    winners: winners.map(Number),
  };
}

export async function getVoterStatus(id: number, voter: string): Promise<VoterStatus | null> {
  if (!isAddress(voter)) return null;
  const c = contract();
  const count = await client.readContract({ ...c, functionName: "electionCount" });
  if (!Number.isInteger(id) || id < 0 || BigInt(id) >= count) return null;
  const s = await client.readContract({ ...c, functionName: "getVoterStatus", args: [BigInt(id), voter] });
  return { eligible: s.eligible, committed: s.committed, revealed: s.revealed, commitment: s.commitment };
}

export async function getActivity(id: number, limit = 40): Promise<ActivityItem[]> {
  const c = contract();
  const electionId = BigInt(id);
  const range = { fromBlock: DEPLOY_BLOCK, toBlock: "latest" as const };

  const [created, registered, phases, commits, reveals] = await Promise.all([
    client.getContractEvents({ ...c, ...range, eventName: "ElectionCreated", args: { id: electionId } }),
    client.getContractEvents({ ...c, ...range, eventName: "VoterRegistered", args: { id: electionId } }),
    client.getContractEvents({ ...c, ...range, eventName: "PhaseChanged", args: { id: electionId } }),
    client.getContractEvents({ ...c, ...range, eventName: "VoteCommitted", args: { id: electionId } }),
    client.getContractEvents({ ...c, ...range, eventName: "VoteRevealed", args: { id: electionId } }),
  ]);

  const election = await getElection(id);
  const candidateName = (cid: bigint) => election?.candidates[Number(cid)]?.name ?? `#${cid}`;

  type Pending = Omit<ActivityItem, "timestamp"> & { logIndex: number };
  const items: Pending[] = [
    ...created.map((l) => ({
      kind: "created" as const,
      actor: l.args.organiser,
      detail: l.args.openToAll ? "Open to every wallet" : "Registered voters only",
      blockNumber: Number(l.blockNumber),
      logIndex: l.logIndex,
      txHash: l.transactionHash,
    })),
    ...registered.map((l) => ({
      kind: "registered" as const,
      actor: l.args.voter,
      blockNumber: Number(l.blockNumber),
      logIndex: l.logIndex,
      txHash: l.transactionHash,
    })),
    ...phases
      .filter((l) => l.args.phase !== 0)
      .map((l) => ({
        kind: "phase" as const,
        detail: PHASES[l.args.phase ?? 0],
        blockNumber: Number(l.blockNumber),
        logIndex: l.logIndex,
        txHash: l.transactionHash,
      })),
    ...commits.map((l) => ({
      kind: "committed" as const,
      actor: l.args.voter,
      detail: l.args.commitment,
      blockNumber: Number(l.blockNumber),
      logIndex: l.logIndex,
      txHash: l.transactionHash,
    })),
    ...reveals.map((l) => ({
      kind: "revealed" as const,
      actor: l.args.voter,
      detail: candidateName(l.args.candidateId ?? 0n),
      blockNumber: Number(l.blockNumber),
      logIndex: l.logIndex,
      txHash: l.transactionHash,
    })),
  ];

  items.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
  const recent = items.slice(0, limit);

  const blockNumbers = [...new Set(recent.map((i) => i.blockNumber))];
  const blocks = await Promise.all(blockNumbers.map((n) => client.getBlock({ blockNumber: BigInt(n) })));
  const timeByBlock = new Map(blocks.map((b) => [Number(b.number), Number(b.timestamp)]));

  return recent.map((item) => ({
    kind: item.kind,
    actor: item.actor,
    detail: item.detail,
    blockNumber: item.blockNumber,
    txHash: item.txHash,
    timestamp: timeByBlock.get(item.blockNumber) ?? 0,
  }));
}

export async function getStats(): Promise<Stats> {
  const c = contract();
  const [elections, blockNumber] = await Promise.all([listElections(), client.getBlockNumber()]);
  return {
    chainId: targetChain.id,
    blockNumber: Number(blockNumber),
    contract: c.address,
    elections: elections.length,
    live: elections.filter((e) => e.phase === "Commit" || e.phase === "Reveal").length,
    sealedVotes: elections.reduce((n, e) => n + e.commitCount, 0),
    revealedVotes: elections.reduce((n, e) => n + e.revealCount, 0),
  };
}
