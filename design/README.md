# Proved design contract

`rules-inventory.json` is the audited design-rule snapshot. `/DESIGN.md` is the agent-facing compiled contract.

## Update order

1. Record or update the decision in the Notion World Model.
2. Audit the current GitHub implementation and resolve conflicts/superseded rules.
3. Update `rules-inventory.json`.
4. Regenerate `/DESIGN.md` so every active `PD-*` rule is represented.
5. Run `node --test tests/*.test.js`.
6. For visual changes, render the affected screen at the required responsive widths when browser tooling is available.

Do not edit `DESIGN.md` as an independent source of truth. A design rule change begins in the World Model/inventory.
