import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  parseEther,
  toHex,
} from "viem";

async function deployFixture() {
  const connection = await network.connect();
  const [owner, alice, bob] = await connection.viem.getWalletClients();
  const publicClient = await connection.viem.getPublicClient();

  const judge = await connection.viem.deployContract("AIJudgeHarness");

  const now = BigInt((await publicClient.getBlock()).timestamp);
  const commitDeadline = now + 1000n;
  const revealDeadline = now + 2000n;

  const hash = await judge.write.createBounty(
    [
      "Privacy Bounty",
      "Pick the clearest and safest solution",
      commitDeadline,
      revealDeadline,
    ],
    {
      account: owner.account,
      value: parseEther("1"),
    }
  );

  await publicClient.waitForTransactionReceipt({ hash });

  return { connection, publicClient, judge, owner, alice, bob };
}

function makeCommitment(
  answer: string,
  salt: `0x${string}`,
  submitter: `0x${string}`,
  bountyId: bigint
) {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("string, bytes32, address, uint256"),
      [answer, salt, submitter, bountyId]
    )
  );
}

async function increaseTime(connection: any, seconds: bigint) {
  await connection.networkHelpers.time.increase(Number(seconds));
}

describe("AIJudge commit-reveal bounty", () => {
  it("accepts a commitment and hides the answer before reveal", async () => {
    const { judge, alice } = await deployFixture();

    const answer = "My hidden bounty answer";
    const salt = toHex("alice-secret", { size: 32 });
    const commitment = makeCommitment(answer, salt, alice.account.address, 1n);

    await judge.write.submitCommitment([1n, commitment], {
      account: alice.account,
    });

    const submission = await judge.read.getSubmissionBySubmitter([
      1n,
      alice.account.address,
    ]);

    assert.equal(submission.commitment, commitment);
    assert.equal(submission.answer, "");
    assert.equal(submission.revealed, false);
    assert.equal(submission.valid, false);
  });

  it("rejects duplicate commitments from the same address", async () => {
    const { judge, alice } = await deployFixture();

    const commitment = makeCommitment(
      "answer",
      toHex("salt", { size: 32 }),
      alice.account.address,
      1n
    );

    await judge.write.submitCommitment([1n, commitment], {
      account: alice.account,
    });

    await assert.rejects(
      judge.write.submitCommitment([1n, commitment], {
        account: alice.account,
      }),
      /already committed/
    );
  });

  it("does not allow reveal before the commit deadline", async () => {
    const { judge, alice } = await deployFixture();

    const answer = "answer";
    const salt = toHex("salt", { size: 32 });
    const commitment = makeCommitment(answer, salt, alice.account.address, 1n);

    await judge.write.submitCommitment([1n, commitment], {
      account: alice.account,
    });

    await assert.rejects(
      judge.write.revealAnswer([1n, answer, salt], {
        account: alice.account,
      }),
      /reveal not started/
    );
  });

  it("accepts a valid reveal after the commit phase", async () => {
    const { connection, judge, alice } = await deployFixture();

    const answer = "This is the final revealed answer";
    const salt = toHex("correct-salt", { size: 32 });
    const commitment = makeCommitment(answer, salt, alice.account.address, 1n);

    await judge.write.submitCommitment([1n, commitment], {
      account: alice.account,
    });

    await increaseTime(connection, 1001n);

    await judge.write.revealAnswer([1n, answer, salt], {
      account: alice.account,
    });

    const submission = await judge.read.getSubmissionBySubmitter([
      1n,
      alice.account.address,
    ]);

    assert.equal(submission.answer, answer);
    assert.equal(submission.salt, salt);
    assert.equal(submission.revealed, true);
    assert.equal(submission.valid, true);

    const validSubmitter = await judge.read.getValidSubmitter([1n, 0n]);
    assert.equal(validSubmitter.toLowerCase(), alice.account.address.toLowerCase());
  });

  it("rejects reveal with the wrong salt", async () => {
    const { connection, judge, alice } = await deployFixture();

    const answer = "answer";
    const salt = toHex("right-salt", { size: 32 });
    const wrongSalt = toHex("wrong-salt", { size: 32 });
    const commitment = makeCommitment(answer, salt, alice.account.address, 1n);

    await judge.write.submitCommitment([1n, commitment], {
      account: alice.account,
    });

    await increaseTime(connection, 1001n);

    await assert.rejects(
      judge.write.revealAnswer([1n, answer, wrongSalt], {
        account: alice.account,
      }),
      /invalid reveal/
    );
  });

  it("rejects reveal from a different wallet", async () => {
    const { connection, judge, alice, bob } = await deployFixture();

    const answer = "answer";
    const salt = toHex("salt", { size: 32 });
    const commitment = makeCommitment(answer, salt, alice.account.address, 1n);

    await judge.write.submitCommitment([1n, commitment], {
      account: alice.account,
    });

    await increaseTime(connection, 1001n);

    await assert.rejects(
      judge.write.revealAnswer([1n, answer, salt], {
        account: bob.account,
      }),
      /no commitment/
    );
  });

  it("builds a batch judging prompt only from valid revealed submissions", async () => {
    const { connection, judge, alice, bob } = await deployFixture();

    const aliceAnswer = "Alice answer";
    const bobAnswer = "Bob answer";
    const aliceSalt = toHex("alice", { size: 32 });
    const bobSalt = toHex("bob", { size: 32 });

    await judge.write.submitCommitment([1n, makeCommitment(aliceAnswer, aliceSalt, alice.account.address, 1n)], {
      account: alice.account,
    });

    await judge.write.submitCommitment([1n, makeCommitment(bobAnswer, bobSalt, bob.account.address, 1n)], {
      account: bob.account,
    });

    await increaseTime(connection, 1001n);

    await judge.write.revealAnswer([1n, aliceAnswer, aliceSalt], { account: alice.account });
    await judge.write.revealAnswer([1n, bobAnswer, bobSalt], { account: bob.account });

    const prompt = await judge.read.getBatchJudgingPrompt([1n]);

    assert.match(prompt, /Privacy Bounty/);
    assert.match(prompt, /Alice answer/);
    assert.match(prompt, /Bob answer/);
  });

  it("finalizes a winner after judging and pays the reward", async () => {
    const { connection, publicClient, judge, owner, alice } = await deployFixture();

    const answer = "winner answer";
    const salt = toHex("winner-salt", { size: 32 });
    const commitment = makeCommitment(answer, salt, alice.account.address, 1n);

    await judge.write.submitCommitment([1n, commitment], {
      account: alice.account,
    });

    await increaseTime(connection, 1001n);

    await judge.write.revealAnswer([1n, answer, salt], {
      account: alice.account,
    });

    await judge.write.forceJudged([1n, toHex("AI review complete")], {
      account: owner.account,
    });

    const balanceBefore = await publicClient.getBalance({
      address: alice.account.address,
    });

    await judge.write.finalizeWinner([1n, 0n], {
      account: owner.account,
    });

    const balanceAfter = await publicClient.getBalance({
      address: alice.account.address,
    });

    assert.equal(balanceAfter > balanceBefore, true);

    const bounty = await judge.read.getBounty([1n]);

    assert.equal(bounty.finalized, true);
    assert.equal(bounty.winnerIndex, 0n);
  });
});