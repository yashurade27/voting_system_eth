import { defineChain, type Address, type Chain } from "viem";
import { hardhat, sepolia } from "viem/chains";
import deployments from "@/contracts/deployments.json";

export const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? hardhat.id);

const PUBLIC_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? (TARGET_CHAIN_ID === hardhat.id ? "http://127.0.0.1:8545" : undefined);

const baseChain = TARGET_CHAIN_ID === sepolia.id ? sepolia : hardhat;

export const targetChain: Chain = defineChain({
  ...baseChain,
  rpcUrls: PUBLIC_RPC_URL ? { default: { http: [PUBLIC_RPC_URL] } } : baseChain.rpcUrls,
});

export const isLocalChain = targetChain.id === hardhat.id;

type Deployment = { address: Address; deployBlock: number; network: string };

const deployment = (deployments as Record<string, Deployment>)[String(TARGET_CHAIN_ID)];

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? deployment?.address) as
  | Address
  | undefined;

export const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? deployment?.deployBlock ?? 0);

export function explorerTx(hash: string) {
  return targetChain.blockExplorers?.default.url ? `${targetChain.blockExplorers.default.url}/tx/${hash}` : null;
}

/** Hardhat's well-known default accounts. Only ever used against a local node. */
export const DEV_ACCOUNTS: readonly Address[] = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
  "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
];
