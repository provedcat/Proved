const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const inventoryPath = path.join(root, 'design', 'rules-inventory.json');
const designPath = path.join(root, 'DESIGN.md');

const sections = [
  ['Foundation & Brand', 1, 8],
  ['Shared Composition & Components', 9, 17],
  ['Responsive, Accessibility & Motion', 18, 23],
  ['Entry / Home', 24, 28],
  ['Condition Finder', 29, 32],
  ['Food Detail', 33, 37],
  ['Food Compare', 38, 39],
  ['Calculator & Result Artifacts', 40, 43],
  ['Feed Reading & Editorial', 44, 45],
  ['Feed Registration', 46, 46],
  ['Signature Visuals & Trust', 47, 48],
  ['Future Output', 49, 49],
  ['Governance', 50, 50],
];

function ruleNumber(id) {
  const match = /^PD-(\d{3})$/.exec(id);
  if (!match) throw new Error(`Invalid design rule id: ${id}`);
  return Number(match[1]);
}

function renderRule(rule) {
  return `- **[${rule.id}] ${rule.strength.toUpperCase()} · ${rule.implementation_status} · ${rule.scope}** — ${rule.rule}`;
}

function renderDesign(inventory) {
  const active = inventory.rules.filter((rule) => rule.status === 'active');
  const activeIds = new Set(active.map((rule) => rule.id));
  const renderedIds = new Set();

  const lines = [
    '# Proved Design System',
    '',
    '> **Role:** executable design contract for Codex / OpenDesign / frontend agents.',
    '> **Source of truth:** `design/rules-inventory.json`, audited from Notion World Model + merged GitHub implementation + confirmed Proved conversation decisions.',
    `> **Coverage:** ${active.length}/${active.length} active rules included · ${inventory.coverage.unresolved_conflicts} unresolved conflicts.`,
    '> Do not hand-delete or weaken a rule here. Update the World Model/inventory first, then regenerate this contract.',
    '',
    '## Visual thesis',
    '',
    '**Editorial Pet Data.** Proved combines the editorial confidence of a specialist pet magazine with the precision of a data tool. The base chrome is calm and systematic; character comes from typography, data, physical metaphors, and interactions that explain something real.',
    '',
    'AI-looking design is not avoided by deleting all visual character. Avoid generic card mosaics, gratuitous gradients, oversized pills, repeated shadow containers, and decorative filler. At the same time, do not flatten meaningful semantic color or Proved-specific signature visuals.',
    '',
    '## Source precedence',
    '',
    '1. Approved **Current Truth** in the Proved Notion World Model.',
    '2. Newer **merged GitHub implementation** and current main-branch behavior.',
    '3. Explicitly confirmed **current Proved conversation decisions**.',
    '4. Historical PRs/conversations only as superseded evidence.',
    '',
    '## Working model',
    '',
    '- **Utility layer:** search, input, filters, navigation, calculations — fast, literal, restrained.',
    '- **Editorial layer:** explanation, comparison, product identity, result reading — stronger composition and typography.',
    '- **Signature layer:** data/interaction metaphors that make Proved memorable — only when they encode product meaning.',
    '',
  ];

  for (const [title, start, end] of sections) {
    const rules = active
      .filter((rule) => {
        const number = ruleNumber(rule.id);
        return number >= start && number <= end;
      })
      .sort((a, b) => ruleNumber(a.id) - ruleNumber(b.id));

    if (!rules.length) throw new Error(`Design section "${title}" has no active rules`);

    lines.push(`## ${title}`, '');
    for (const rule of rules) {
      if (renderedIds.has(rule.id)) throw new Error(`Design rule rendered twice: ${rule.id}`);
      renderedIds.add(rule.id);
      lines.push(renderRule(rule));
    }
    lines.push('');
  }

  const missing = [...activeIds].filter((id) => !renderedIds.has(id));
  if (missing.length) throw new Error(`Active design rules have no contract section: ${missing.join(', ')}`);
  if (renderedIds.size !== activeIds.size) throw new Error('Rendered rule count does not match active inventory count');

  lines.push(
    '## Current canonical tokens',
    '',
    '```css',
    ':root {',
    '  --proved-color-blue: #3568FF;',
    '  --proved-color-bg: #F5F7FA;',
    '  --proved-color-text: #727B8B;',
    '  --proved-color-text-soft: #9AA1AD;',
    '  --proved-color-line: #DCE2EA;',
    '  --proved-color-white: #FFFFFF;',
    '',
    '  --proved-cat-dry: #B85A00;',
    '  --proved-cat-wet: #1F5CC4;',
    '  --proved-dog-dry: #9A5B34;',
    '  --proved-dog-wet: #388255;',
    '  --proved-water: #2F858C;',
    '  --proved-calcium-phosphorus: #5D537F;',
    '}',
    '```',
    '',
    '## Design task protocol',
    '',
    'Before editing a Proved surface:',
    '',
    '1. Classify the surface: **Utility / Editorial / Signature / Output artifact**.',
    "2. Identify the user's decision or action on that screen.",
    '3. Preserve all applicable `PD-*` rules from this contract.',
    '4. Choose at most the amount of visual emphasis the task can justify; do not add effects merely to make the screen feel designed.',
    '5. Preserve existing product behavior unless the task explicitly changes behavior.',
    '6. Render and inspect responsive states whenever browser tooling is available.',
    '7. For a design PR, report which rule IDs were intentionally affected.',
    '',
    '## Anti-pattern check',
    '',
    'Reject or revise a design if it:',
    '',
    '- looks like a generic dashboard assembled from interchangeable cards;',
    '- removes semantic colors solely to make the palette more uniform;',
    '- creates hierarchy mainly through boxes, radius, shadows, or badges;',
    '- invents a new decorative metaphor instead of strengthening an existing Proved one;',
    '- compresses desktop layouts until text or controls become cramped instead of changing composition;',
    '- hides missing data behind confident visual scoring;',
    '- changes the common header/subnav/layout contract for a local page without a documented reason;',
    '- claims visual verification when screenshots/browser rendering were not actually performed.',
    '',
    '## Superseded directions — do not reintroduce',
    '',
    '- Old #2F6FED / #234FB8 / navy-first global palette.',
    '- Blanket removal of semantic feed/nutrition colors.',
    '- Warm ivory background for the current saved feeding image.',
    '- `PV / DAILY FEEDING PLAN` naming.',
    '- Treating condition finder or the final wordmark as unimplemented.',
    "- Interpreting 'avoid AI-looking UI' as 'remove all expressive visual devices'.",
    '',
    '## Coverage contract',
    '',
    '`tests/design-rules.test.js` must pass before this file is considered synchronized. The test verifies:',
    '',
    '- every active inventory rule ID appears in this file;',
    '- no active rule ID is duplicated in the inventory;',
    '- every active rule has at least one source;',
    '- the inventory has zero unresolved conflicts;',
    '- the coverage count matches the number of active rules.',
    ''
  );

  return lines.join('\n');
}

function loadInventory() {
  return JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
}

function writeDesign() {
  const inventory = loadInventory();
  const output = renderDesign(inventory);
  fs.writeFileSync(designPath, output, 'utf8');
  return output;
}

if (require.main === module) {
  writeDesign();
  process.stdout.write('Generated DESIGN.md from design/rules-inventory.json\n');
}

module.exports = { renderDesign, writeDesign };
