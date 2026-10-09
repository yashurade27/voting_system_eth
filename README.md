# SealedBallot — commit–reveal voting on Ethereum

A full-stack decentralised voting system. Votes are submitted as **sealed hashes** while voting is open, then
**revealed and counted by a smart contract** — so nobody can watch the trend, and nobody can tamper with the count.

- `contracts/` — Solidity smart contract (`SealedBallot.sol`), Hardhat tests, deploy + demo seed scripts
- `web/` — Next.js 16 full-stack app (React UI + API route handlers that read the chain with viem; wallet writes via wagmi)
- `report.md` — the mini-project report
- `docs/screenshots/` — screenshots captured from an automated end-to-end run

## Run it locally

Requires Node.js 20+.

```bash
npm run setup      # install contracts/ and web/ dependencies
npm run chain      # terminal 1: local Ethereum node on http://127.0.0.1:8545 (chain 31337)
npm run deploy     # terminal 2: deploy SealedBallot + seed 3 demo elections
npm run dev        # terminal 2: web app on http://localhost:3000
```

Open http://localhost:3000 and click **Connect wallet**. On the local chain you can pick one of the built-in
Hardhat accounts in one click — **#0** is the organiser of the demo elections, **#1–#5** are registered voters.
A browser wallet (MetaMask) also works: add network `http://127.0.0.1:8545`, chain id `31337`.

> Restarting `npm run chain` wipes the local blockchain — run `npm run deploy` again afterwards.

## Try the full flow

1. As **#0**, create an election on *New election* and register a few voter addresses.
2. Click **Open sealed voting**.
3. Switch to **#1**, **#2**… choose a candidate and **Seal my vote**. Download the receipt.
4. Switch back to **#0** → **Close voting & start reveal**.
5. Each voter clicks **Open my ballot** — the contract checks the hash and counts it.
6. **#0** → **Finalise results**. Check any receipt on the **Verify receipt** page.

## Other commands

```bash
npm test           # 14 Hardhat unit tests for the contract
npm run gas        # tests + gas usage report
npm run build      # compile contract + production build of the web app
```

### Deploying to Sepolia

Copy `contracts/.env.example` to `contracts/.env`, fill in an RPC URL and a **testnet-only** private key, then
`npm run deploy:sepolia --prefix contracts`. Start the web app with `NEXT_PUBLIC_CHAIN_ID=11155111` and
`NEXT_PUBLIC_RPC_URL` / `RPC_URL` pointing at a Sepolia RPC (see `web/.env.example`).
