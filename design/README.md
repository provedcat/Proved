# Proved design contract

`rules-inventory.json` is the audited design-rule snapshot. `/DESIGN.md` is a generated, agent-facing compiled contract.

## Update order

1. Record or update the decision in the Notion World Model.
2. Audit the current GitHub implementation and resolve conflicts/superseded rules.
3. Update `design/rules-inventory.json`.
4. Run `node scripts/generate-design.js` to generate `/DESIGN.md` from the inventory.
5. Run `node --test tests/*.test.js`.
6. For visual changes, render the affected screen at the required responsive widths when browser tooling is available.

Do not edit `DESIGN.md` as an independent source of truth. Its rule lines are compiled from the inventory. `tests/design-rules.test.js` compares the committed file with a fresh generator render byte-for-byte, so changing a rule's text, strength, scope, implementation status, active status, or membership without regeneration fails the test.

If a new `PD-*` rule does not belong to one of the ranges defined in `scripts/generate-design.js`, generation fails rather than silently omitting it.
