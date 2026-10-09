import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

// Populates a local chain with demo elections in every phase so the UI has
// something to show straight after `npm run dev:chain`.

const deployments = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../web/src/contracts/deployments.json"), "utf8"),
);

const salt = () => ethers.hexlify(ethers.randomBytes(32));
const commitmentOf = (id: number, candidateId: number, s: string, voter: string) =>
  ethers.solidityPackedKeccak256(["uint256", "uint256", "bytes32", "address"], [id, candidateId, s, voter]);

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const address = deployments[chainId]?.address;
  if (!address) throw new Error(`No deployment for chain ${chainId}. Run the deploy script first.`);

  const signers = await ethers.getSigners();
  const [organiser, ...voters] = signers;
  const ballot = await ethers.getContractAt("SealedBallot", address, organiser);
  const base = Number(await ballot.electionCount());

  // 1. Finished election with real results.
  await (await ballot.createElection(
    "Tech Fest Theme 2026",
    "The committee picks the theme for this year's college tech fest. Results are final.",
    ["Cyberpunk Mumbai", "Space Odyssey", "Retro Arcade", "Ocean Tech"],
    false,
  )).wait();
  const ended = base;
  await (await ballot.registerVoters(ended, voters.slice(0, 8).map((v) => v.address))).wait();
  await (await ballot.openVoting(ended)).wait();
  const picks = [0, 1, 0, 2, 0, 1, 3, 0];
  const salts = picks.map(() => salt());
  for (let i = 0; i < picks.length; i++) {
    await (await ballot.connect(voters[i]).commitVote(ended, commitmentOf(ended, picks[i], salts[i], voters[i].address))).wait();
  }
  await (await ballot.startReveal(ended)).wait();
  for (let i = 0; i < picks.length - 1; i++) {
    await (await ballot.connect(voters[i]).revealVote(ended, picks[i], salts[i])).wait();
  }
  await (await ballot.closeElection(ended)).wait();

  // 2. Election currently accepting sealed votes (account #1–#5 are registered).
  await (await ballot.createElection(
    "Class Representative — TE Computer",
    "Elect the class representative for the third-year Computer Engineering batch.",
    ["Asha Kulkarni", "Rohan Mehta", "Meera Iyer"],
    false,
  )).wait();
  const commit = base + 1;
  await (await ballot.registerVoters(commit, voters.slice(0, 5).map((v) => v.address))).wait();
  await (await ballot.openVoting(commit)).wait();
  await (await ballot.connect(voters[3]).commitVote(commit, commitmentOf(commit, 1, salt(), voters[3].address))).wait();
  await (await ballot.connect(voters[4]).commitVote(commit, commitmentOf(commit, 0, salt(), voters[4].address))).wait();

  // 3. Open-to-all poll still in setup.
  await (await ballot.createElection(
    "Canteen Menu Upgrade",
    "Anyone with a wallet can vote. Which new item should the canteen add?",
    ["Vada Pav Combo", "Cold Coffee", "Paneer Wrap"],
    true,
  )).wait();

  console.log(`Seeded elections #${ended} (ended), #${commit} (commit), #${base + 2} (setup) on ${network.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
