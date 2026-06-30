# Submission Summary

Completed the Privacy-Preserving AI Bounty Judge assignment.

## Required Track

The required commit-reveal bounty flow is implemented in Solidity and tested.

Implemented functions:

- `submitCommitment(uint256 bountyId, bytes32 commitment)`
- `revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt)`
- `judgeAll(uint256 bountyId, bytes calldata llmInput)`
- `finalizeWinner(uint256 bountyId, uint256 winnerIndex)`

The contract verifies reveals using:

```solidity
keccak256(abi.encode(answer, salt, msg.sender, bountyId))
```

Only valid revealed submissions are eligible for AI judging.

## Advanced Track

The advanced Ritual-native hidden submissions track is provided as an architecture design.

The architecture explains:

- where plaintext answers exist;
- what is stored on-chain;
- what is stored off-chain;
- how encrypted submissions can be decrypted inside Ritual TEE-backed execution;
- how the LLM receives submissions as one batch for judging.

## Tests

Automated Hardhat tests are included.

Covered cases:

- commitment submission;
- answer hidden before reveal;
- duplicate commitment rejection;
- reveal before deadline rejection;
- valid reveal;
- wrong salt;
- wrong wallet;
- batch judging prompt;
- winner finalization and reward payment.

Expected local result:

```text
8 passing
```