"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import { useConfig, useConnection, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { sealedBallotAbi } from "@/contracts/abi";
import { CONTRACT_ADDRESS, targetChain } from "@/lib/chain";
import type { ActivityItem, ElectionDetail, ElectionSummary, Stats, VoterStatus } from "@/lib/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

const POLL_MS = 4_000;

export const useStats = () =>
  useQuery({ queryKey: ["stats"], queryFn: () => getJson<Stats>("/api/stats"), refetchInterval: POLL_MS });

export const useElections = () =>
  useQuery({
    queryKey: ["elections"],
    queryFn: () => getJson<ElectionSummary[]>("/api/elections"),
    refetchInterval: POLL_MS,
  });

export const useElection = (id: number) =>
  useQuery({
    queryKey: ["election", id],
    queryFn: () => getJson<ElectionDetail>(`/api/elections/${id}`),
    refetchInterval: POLL_MS,
  });

export const useActivity = (id: number) =>
  useQuery({
    queryKey: ["activity", id],
    queryFn: () => getJson<ActivityItem[]>(`/api/elections/${id}/activity`),
    refetchInterval: POLL_MS,
  });

export const useVoterStatus = (id: number, address?: string) =>
  useQuery({
    queryKey: ["voter", id, address],
    queryFn: () => getJson<VoterStatus>(`/api/elections/${id}/voters/${address}`),
    enabled: !!address,
    refetchInterval: POLL_MS,
  });

const FRIENDLY_ERRORS: Record<string, string> = {
  NotOrganiser: "Only the organiser of this election can do that.",
  WrongPhase: "The election has moved to a different phase. Refresh and try again.",
  InvalidCandidates: "Give the election a title and between 2 and 16 named candidates.",
  BatchTooLarge: "Register at most 100 voters per transaction.",
  NotEligible: "This wallet is not on the voter roll for this election.",
  NothingCommitted: "This wallet never cast a sealed vote in this election.",
  AlreadyRevealed: "This ballot has already been revealed and counted.",
  CommitmentMismatch: "The receipt doesn't match the sealed vote on-chain (wrong candidate or salt).",
  InvalidCandidate: "That candidate doesn't exist.",
  EmptyCommitment: "Commitment can't be empty.",
  ElectionNotFound: "Election not found.",
};

export function describeError(err: unknown): string {
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected) return "You rejected the request in your wallet.";
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name && FRIENDLY_ERRORS[name]) return FRIENDLY_ERRORS[name];
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

type WriteArgs = Parameters<ReturnType<typeof useWriteContract>["mutateAsync"]>[0];
type BallotCall = Omit<WriteArgs, "address" | "abi" | "chainId" | "account">;

/** Sends a SealedBallot transaction, waits for it to be mined, then refreshes every API-backed query. */
export function useBallotTx() {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const { mutateAsync } = useWriteContract();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(label: string, call: BallotCall) {
    if (!CONTRACT_ADDRESS) throw new Error("Contract is not deployed on this network.");
    setPending(label);
    setError(null);
    try {
      const hash = await mutateAsync({
        ...call,
        address: CONTRACT_ADDRESS,
        abi: sealedBallotAbi,
        chainId: targetChain.id,
        account: address,
      } as WriteArgs);
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: targetChain.id });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      await queryClient.invalidateQueries();
      return receipt;
    } catch (err) {
      setError(describeError(err));
      return null;
    } finally {
      setPending(null);
    }
  }

  return { send, pending, error, clearError: () => setError(null) };
}
