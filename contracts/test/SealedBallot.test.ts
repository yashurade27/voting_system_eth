import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

enum Phase {
  Setup,
  Commit,
  Reveal,
  Ended,
}

const salt = (n: number) => ethers.zeroPadValue(ethers.toBeHex(n), 32);

function commitmentOf(id: bigint | number, candidateId: number, s: string, voter: string) {
  return ethers.solidityPackedKeccak256(
    ["uint256", "uint256", "bytes32", "address"],
    [id, candidateId, s, voter],
  );
}

describe("SealedBallot", () => {
  async function deployFixture() {
    const [organiser, alice, bob, carol, mallory] = await ethers.getSigners();
    const ballot = await ethers.deployContract("SealedBallot");
    await ballot.createElection(
      "Class Representative 2026",
      "Pick the CR for the Computer Engineering batch",
      ["Asha", "Rohan", "Meera"],
      false,
    );
    await ballot.registerVoters(0, [alice.address, bob.address, carol.address]);
    return { ballot, organiser, alice, bob, carol, mallory };
  }

  async function commitPhaseFixture() {
    const f = await deployFixture();
    await f.ballot.openVoting(0);
    return f;
  }

  describe("creation", () => {
    it("stores the election and candidates", async () => {
      const { ballot, organiser } = await loadFixture(deployFixture);
      const e = await ballot.getElection(0);
      expect(e.title).to.equal("Class Representative 2026");
      expect(e.organiser).to.equal(organiser.address);
      expect(e.phase).to.equal(Phase.Setup);
      expect(e.voterCount).to.equal(3);
      const cs = await ballot.getCandidates(0);
      expect(cs.map((c) => c.name)).to.deep.equal(["Asha", "Rohan", "Meera"]);
    });

    it("rejects fewer than two candidates", async () => {
      const { ballot } = await loadFixture(deployFixture);
      await expect(ballot.createElection("x", "", ["solo"], true)).to.be.revertedWithCustomError(
        ballot,
        "InvalidCandidates",
      );
    });

    it("ignores duplicate voter registrations", async () => {
      const { ballot, alice } = await loadFixture(deployFixture);
      await ballot.registerVoters(0, [alice.address, alice.address]);
      expect((await ballot.getElection(0)).voterCount).to.equal(3);
    });

    it("only lets the organiser manage the election", async () => {
      const { ballot, mallory } = await loadFixture(deployFixture);
      await expect(ballot.connect(mallory).registerVoters(0, [mallory.address])).to.be.revertedWithCustomError(
        ballot,
        "NotOrganiser",
      );
      await expect(ballot.connect(mallory).openVoting(0)).to.be.revertedWithCustomError(ballot, "NotOrganiser");
    });
  });

  describe("commit phase", () => {
    it("accepts sealed votes from registered voters only", async () => {
      const { ballot, alice, mallory } = await loadFixture(commitPhaseFixture);
      const c = commitmentOf(0, 1, salt(42), alice.address);
      await expect(ballot.connect(alice).commitVote(0, c))
        .to.emit(ballot, "VoteCommitted")
        .withArgs(0, alice.address, c);

      const m = commitmentOf(0, 1, salt(1), mallory.address);
      await expect(ballot.connect(mallory).commitVote(0, m)).to.be.revertedWithCustomError(ballot, "NotEligible");
    });

    it("lets a voter change their sealed vote without double counting", async () => {
      const { ballot, alice } = await loadFixture(commitPhaseFixture);
      await ballot.connect(alice).commitVote(0, commitmentOf(0, 0, salt(1), alice.address));
      await ballot.connect(alice).commitVote(0, commitmentOf(0, 2, salt(2), alice.address));
      expect((await ballot.getElection(0)).commitCount).to.equal(1);
    });

    it("hides tallies while voting is open", async () => {
      const { ballot, alice } = await loadFixture(commitPhaseFixture);
      await ballot.connect(alice).commitVote(0, commitmentOf(0, 1, salt(9), alice.address));
      const cs = await ballot.getCandidates(0);
      expect(cs.every((c) => c.votes === 0n)).to.equal(true);
    });

    it("rejects commits outside the commit phase", async () => {
      const { ballot, alice } = await loadFixture(deployFixture);
      await expect(
        ballot.connect(alice).commitVote(0, commitmentOf(0, 1, salt(9), alice.address)),
      ).to.be.revertedWithCustomError(ballot, "WrongPhase");
    });
  });

  describe("reveal phase", () => {
    async function revealFixture() {
      const f = await commitPhaseFixture();
      const { ballot, alice, bob, carol } = f;
      await ballot.connect(alice).commitVote(0, commitmentOf(0, 1, salt(11), alice.address));
      await ballot.connect(bob).commitVote(0, commitmentOf(0, 1, salt(22), bob.address));
      await ballot.connect(carol).commitVote(0, commitmentOf(0, 2, salt(33), carol.address));
      await ballot.startReveal(0);
      return f;
    }

    it("counts valid reveals and declares the winner", async () => {
      const { ballot, alice, bob, carol } = await loadFixture(revealFixture);
      await ballot.connect(alice).revealVote(0, 1, salt(11));
      await ballot.connect(bob).revealVote(0, 1, salt(22));
      await ballot.connect(carol).revealVote(0, 2, salt(33));
      await ballot.closeElection(0);

      const cs = await ballot.getCandidates(0);
      expect(cs.map((c) => c.votes)).to.deep.equal([0n, 2n, 1n]);
      expect(await ballot.getWinners(0)).to.deep.equal([1n]);
      expect((await ballot.getElection(0)).phase).to.equal(Phase.Ended);
    });

    it("rejects a reveal that does not match the commitment", async () => {
      const { ballot, alice } = await loadFixture(revealFixture);
      await expect(ballot.connect(alice).revealVote(0, 2, salt(11))).to.be.revertedWithCustomError(
        ballot,
        "CommitmentMismatch",
      );
      await expect(ballot.connect(alice).revealVote(0, 1, salt(12))).to.be.revertedWithCustomError(
        ballot,
        "CommitmentMismatch",
      );
    });

    it("prevents revealing twice", async () => {
      const { ballot, alice } = await loadFixture(revealFixture);
      await ballot.connect(alice).revealVote(0, 1, salt(11));
      await expect(ballot.connect(alice).revealVote(0, 1, salt(11))).to.be.revertedWithCustomError(
        ballot,
        "AlreadyRevealed",
      );
    });

    it("stops a copied commitment from being revealed by someone else", async () => {
      const { ballot, organiser, alice } = await loadFixture(deployFixture);
      await ballot.createElection("Open poll", "", ["A", "B"], true);
      await ballot.openVoting(1);
      const aliceCommit = commitmentOf(1, 0, salt(5), alice.address);
      await ballot.connect(alice).commitVote(1, aliceCommit);
      await ballot.connect(organiser).commitVote(1, aliceCommit);
      await ballot.startReveal(1);
      await expect(ballot.connect(organiser).revealVote(1, 0, salt(5))).to.be.revertedWithCustomError(
        ballot,
        "CommitmentMismatch",
      );
    });

    it("reports ties as multiple winners", async () => {
      const { ballot, alice, carol } = await loadFixture(revealFixture);
      await ballot.connect(alice).revealVote(0, 1, salt(11));
      await ballot.connect(carol).revealVote(0, 2, salt(33));
      expect(await ballot.getWinners(0)).to.deep.equal([1n, 2n]);
    });
  });

  it("matches the on-chain commitment helper", async () => {
    const { ballot, alice } = await loadFixture(deployFixture);
    expect(await ballot.computeCommitment(0, 2, salt(7), alice.address)).to.equal(
      commitmentOf(0, 2, salt(7), alice.address),
    );
  });
});
