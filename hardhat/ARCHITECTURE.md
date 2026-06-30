# Architecture Note

## Required track: commit-reveal bounty

The required implementation uses a commit-reveal flow to prevent participants from copying public answers before the submission deadline.

During the commit phase, participants submit only:

```solidity
bytes32 commitment
```

The commitment is calculated as:

```solidity
keccak256(abi.encode(answer, salt, msg.sender, bountyId))
```

The answer and salt are not stored on-chain during the commit phase.

After the commit deadline, the reveal phase begins. Participants reveal their plaintext answer and salt. The contract recomputes the hash and checks it against the stored commitment. Only matching reveals are marked as valid.

Only valid revealed submissions are eligible for AI judging.

## What is public

Public on-chain data:

- bounty owner;
- reward;
- commit deadline;
- reveal deadline;
- submitter addresses;
- commitment hashes;
- reveal status;
- valid reveal status;
- final winner;
- AI review/result.

This is enough for transparency and auditability.

## What stays hidden in the required track

During the commit phase:

- plaintext answers are hidden;
- salts are hidden;
- judging content is not available.

After reveal:

- answers become public on-chain;
- this is acceptable for the required track because the copying problem is solved once the commit deadline has passed.

## Advanced track: Ritual-native hidden submissions

A stronger Ritual-native design would keep answers encrypted until the AI judging step is complete.

In this design, participants would submit:

- an on-chain commitment;
- an encrypted answer stored off-chain;
- an optional storage pointer;
- metadata needed for verification.

The plaintext answer would exist only in two places:

1. Locally with the participant before submission.
2. Inside Ritual TEE-backed execution during batch judging.

The plaintext answer should not be publicly stored on-chain before judging.

## On-chain vs off-chain storage

### On-chain

The contract stores:

- bountyId;
- deadlines;
- submitter address;
- commitment hash;
- encrypted payload pointer;
- reveal/judging status;
- final winner;
- AI result or result hash.

### Off-chain

Off-chain storage contains:

- encrypted answer;
- encrypted salt or private metadata if needed;
- encrypted submission bundle;
- storage pointer, for example IPFS, Arweave, or another storage layer.

## How the LLM receives submissions for batch judging

The judging process should use one batch, not one LLM call per answer.

Flow:

1. Participants submit commitments and encrypted answers.
2. After the deadline, a Ritual TEE-backed worker loads all encrypted submissions.
3. Decryption happens inside the TEE.
4. The TEE prepares one batch prompt containing all eligible submissions.
5. The LLM judges the batch.
6. The judging result is returned on-chain.
7. The contract finalizes the winner.

This preserves fairness because answers are hidden before judging, while still allowing the final result to be settled transparently on-chain.

## Why Ritual matters

Ritual is useful here because the problem is not only about running an LLM. The system needs private inputs, controlled execution, batch judging, and on-chain settlement.

A normal public smart contract can enforce commit-reveal. A Ritual-native version can go further by keeping the actual answers hidden until TEE-backed AI judging is complete.