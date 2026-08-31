# Proved Design Audit — 2026-08-31

This audit precedes `DESIGN.md`. It reconciles three sources before generating an agent-facing design contract.

## Sources audited

1. Notion `World Model Records`: approved design standards and relevant feature decisions.
2. GitHub: merged/current design PRs plus main-branch CSS that represents the actual shipped system.
3. Confirmed Proved project conversation decisions available during the audit.

## Result

- Active rules: **50**
- Resolved conflicts / stale directions: **7**
- Unresolved conflicts: **0**
- Agent contract coverage: **50/50**

The machine-readable inventory is `design/rules-inventory.json`. The compiled execution contract is `/DESIGN.md`.

## Important reconciliations

### Semantic color is not decoration

The broad color-collapse direction from PR #82 was narrowed by later implementation. PR #83, #109, and #113 restore meaning-bearing feed and nutrition colors. The current contract therefore keeps Proved Blue for brand chrome while preserving semantic dry/wet/water/Ca:P colors.

### Avoiding an AI-made look does not mean removing character

The stable rule is **cardless by default**, not **expressionless everywhere**. Current shipped Product Tag Blob, condition-folder z-stack, explanatory data graphics, and document-like result artifacts are valid Proved signature visuals because they encode data or interaction.

### Saved result background is white

The warm-paper direction introduced during result experimentation is historical. The current saved/share feeding document uses a white background; grams remain the protagonist and PV naming remains removed.

### Condition finder and wordmark are shipped

Older World Model state fields said these were queued/building. The audit updated their Current Truth / Delivery State to match GitHub.

### Responsive composition may structurally change

PR #129 established that tablet/mobile should not preserve a cramped desktop grid. Responsive design may change composition while preserving information hierarchy and alignment contracts.

## Source precedence

If sources disagree:

1. Approved World Model Current Truth
2. newer merged GitHub implementation/current main
3. explicit current conversation decision
4. historical evidence only

A conflict that cannot be resolved by this precedence must be recorded as unresolved and causes the design contract test to fail until a decision is made.

## Coverage limitation

The 50/50 check guarantees that every **audited active rule** appears in `DESIGN.md`. It cannot prove that a conversation or artifact unavailable to the audit contained no additional rule. If an older decision is later recovered, add it to the World Model/inventory first; do not patch `DESIGN.md` by hand.
