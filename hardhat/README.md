# Privacy-Preserving AI Bounty Judge

This submission improves the original AI bounty judge by replacing public answer submission with a commit-reveal flow.

The original problem was fairness: if answers are public during the submission phase, later participants can copy earlier ideas and submit improved versions. This contract keeps answers hidden until the reveal phase. Only answers that match a prior commitment are eligible for AI judging.

## What changed

The contract now uses four assignment-required functions:

```solidity
submitCommitment(uint256 bountyId, bytes32 commitment)
revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt)
judgeAll(uint256 bountyId, bytes calldata llmInput)
finalizeWinner(uint256 bountyId, uint256 winnerIndex)
```

## Lifecycle

1. The bounty owner creates a bounty with a commit deadline and a reveal deadline.
2. During the commit phase, participants submit only a `bytes32 commitment`.
3. The plaintext answer and salt are not stored on-chain during the commit phase.
4. After the commit deadline, participants reveal their answer and salt.
5. The contract recomputes `keccak256(abi.encode(answer, salt, msg.sender, bountyId))`.
6. If the recomputed hash matches the stored commitment, the reveal is valid.
7. Only valid revealed answers are included in the batch judging prompt.
8. The bounty owner calls `judgeAll` once with an LLM input that contains all valid revealed answers.
9. After judging, the bounty owner finalizes the winner by selecting an index from the valid revealed submissions.
10. The reward is paid to the selected winner.

## Why `abi.encode` is used

The assignment describes the commitment as:

```solidity
keccak256(answer, salt, msg.sender, bountyId)
```

In Solidity, the safe implementation is:

```solidity
keccak256(abi.encode(answer, salt, msg.sender, bountyId))
```

`abi.encode` avoids ambiguity around dynamic types such as `string`. This makes the commitment calculation clearer and safer than packed encoding.

## Batch judging

The contract includes:

```solidity
getBatchJudgingPrompt(uint256 bountyId)
```

This returns a single prompt containing all valid revealed submissions. This supports the assignment requirement to batch judge submissions instead of making one LLM call per answer.

The intended flow is:

1. Call `getBatchJudgingPrompt(bountyId)` after the reveal phase.
2. Build Ritual LLM precompile input off-chain using that prompt.
3. Call `judgeAll(bountyId, llmInput)` once.
4. Store the AI review result on-chain.
5. Finalize the winner.

## Files

- `contracts/AIJudge.sol` — updated contract with commit-reveal logic.
- `contracts/utils/PrecompileConsumer.sol` — utility used for Ritual-style precompile calls.
- `contracts/test/AIJudgeHarness.sol` — test helper used to simulate completed judging locally.
- `test/AIJudgeCommitReveal.ts` — automated Hardhat tests for the commit-reveal lifecycle.
- `TEST_PLAN.md` — reveal and lifecycle test plan.
- `ARCHITECTURE.md` — required architecture note, including Ritual-native hidden submission design.
- `REFLECTION.md` — required 5-8 sentence reflection answer.
- `SUBMISSION_SUMMARY.md` — short summary for reviewers.

## Local setup

```bash
Install dependencies:

pnpm install

Run tests:

npx hardhat test
```

## Test coverage

Automated tests cover:

- commitment submission;
- hidden answer before reveal;
- duplicate commitment rejection;
- reveal before deadline rejection;
- valid reveal acceptance;
- wrong salt rejection;
- wrong-wallet reveal rejection;
- batch judging prompt generation;
- winner finalization and reward payment.

Expected result:

```text
8 passing
```

## Notes

The required commit-reveal track works on any EVM chain. The Ritual-specific part is the `judgeAll` flow, which is designed to use an LLM precompile through `PrecompileConsumer` when deployed to Ritual.

The advanced Ritual-native hidden submissions track is provided as an architecture design in `ARCHITECTURE.md`.