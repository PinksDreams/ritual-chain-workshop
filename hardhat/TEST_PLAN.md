# Test Plan

## Goal

Verify that the privacy-preserving bounty flow works correctly and that only valid revealed submissions can be judged.

## Manual test cases

### 1. Valid commitment

A participant submits a non-zero commitment during the commit phase.

Expected:
- commitment is stored;
- plaintext answer is not stored;
- participant is recorded as a submitter.

### 2. Duplicate commitment

The same participant tries to submit a second commitment for the same bounty.

Expected:
- transaction reverts with `already committed`.

### 3. Reveal before commit deadline

A participant tries to reveal before the commit phase ends.

Expected:
- transaction reverts with `reveal not started`.

### 4. Valid reveal

A participant reveals the correct answer and salt after the commit deadline.

Expected:
- contract recomputes the commitment;
- commitment matches;
- answer is stored;
- submission is marked as revealed and valid;
- submitter is added to the valid revealed list.

### 5. Wrong salt

A participant reveals the correct answer with the wrong salt.

Expected:
- recomputed hash does not match;
- transaction reverts with `invalid reveal`.

### 6. Wrong wallet

Another wallet tries to reveal someone else's answer and salt.

Expected:
- transaction reverts with `no commitment`.

### 7. Batch judging prompt

After valid reveals, `getBatchJudgingPrompt` is called.

Expected:
- prompt contains only valid revealed submissions;
- prompt contains submission indexes;
- invalid or unrevealed submissions are not included.

### 8. Finalize winner

After judging is completed, the bounty owner finalizes a winner by valid submission index.

Expected:
- selected submitter receives reward;
- bounty is marked as finalized;
- winner and winner index are stored.

## Automated tests

Automated tests are included in:

`test/AIJudgeCommitReveal.ts`

Run:

```bash
npx hardhat test
```

Expected result:

```text
8 passing
```