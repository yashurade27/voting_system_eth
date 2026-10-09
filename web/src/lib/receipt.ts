import { bytesToHex, encodePacked, isAddress, isHex, keccak256, type Address, type Hex } from "viem";

/** Everything a voter needs to open their sealed ballot later. Losing it means the vote can't be counted. */
export type BallotReceipt = {
  version: 1;
  chainId: number;
  contract: Address;
  electionId: number;
  electionTitle: string;
  candidateId: number;
  candidateName: string;
  voter: Address;
  salt: Hex;
  commitment: Hex;
  txHash?: Hex;
  createdAt: number;
};

export function computeCommitment(electionId: number, candidateId: number, salt: Hex, voter: Address): Hex {
  return keccak256(
    encodePacked(["uint256", "uint256", "bytes32", "address"], [BigInt(electionId), BigInt(candidateId), salt, voter]),
  );
}

export function randomSalt(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

const key = (chainId: number, contract: string, electionId: number, voter: string) =>
  `sealed-ballot.receipt:${chainId}:${contract.toLowerCase()}:${electionId}:${voter.toLowerCase()}`;

/**
 * A receipt is first stored as "pending" before the commit transaction is sent, and promoted
 * once mined. Loading prefers whichever copy matches the commitment currently on-chain, so the
 * salt survives a closed tab mid-transaction as well as a failed attempt to change a vote.
 */
export function saveReceipt(r: BallotReceipt, { pending = false } = {}) {
  const k = key(r.chainId, r.contract, r.electionId, r.voter);
  localStorage.setItem(pending ? `${k}:pending` : k, JSON.stringify(r));
  if (!pending) localStorage.removeItem(`${k}:pending`);
}

export function loadReceipt(chainId: number, contract: string, electionId: number, voter: string, onChain?: Hex) {
  const k = key(chainId, contract, electionId, voter);
  const confirmed = parseReceipt(localStorage.getItem(k) ?? "");
  const pending = parseReceipt(localStorage.getItem(`${k}:pending`) ?? "");
  if (onChain && pending?.commitment === onChain && confirmed?.commitment !== onChain) {
    saveReceipt(pending);
    return pending;
  }
  return confirmed;
}

export function parseReceipt(raw: string): BallotReceipt | null {
  try {
    const r = JSON.parse(raw);
    if (
      r?.version === 1 &&
      Number.isInteger(r.electionId) &&
      Number.isInteger(r.candidateId) &&
      isAddress(r.voter) &&
      isHex(r.salt) &&
      r.salt.length === 66 &&
      isHex(r.commitment)
    ) {
      return r as BallotReceipt;
    }
  } catch {}
  return null;
}

export function downloadReceipt(r: BallotReceipt) {
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ballot-receipt-election-${r.electionId}-${r.voter.slice(2, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
