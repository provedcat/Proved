const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const inventoryPath = path.join(root, 'design', 'rules-inventory.json');
const designPath = path.join(root, 'DESIGN.md');

function loadInventory() {
  return JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
}

test('design rule inventory is internally consistent', () => {
  const inventory = loadInventory();
  const active = inventory.rules.filter(rule => rule.status === 'active');
  const ids = active.map(rule => rule.id);

  assert.equal(new Set(ids).size, ids.length, 'duplicate active design rule IDs found');

  for (const rule of active) {
    assert.match(rule.id, /^PD-\d{3}$/, `invalid rule id: ${rule.id}`);
    assert.ok(rule.rule && rule.rule.trim(), `${rule.id} has no rule text`);
    assert.ok(Array.isArray(rule.sources) && rule.sources.length > 0, `${rule.id} has no source`);
  }

  assert.equal(inventory.coverage.active_rules, active.length, 'coverage.active_rules does not match active rule count');
  assert.equal(inventory.coverage.unresolved_conflicts, 0, 'inventory declares unresolved design conflicts');
});

test('DESIGN.md includes every active design rule exactly once', () => {
  const inventory = loadInventory();
  const active = inventory.rules.filter(rule => rule.status === 'active');
  const design = fs.readFileSync(designPath, 'utf8');

  for (const rule of active) {
    const escaped = rule.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = design.match(new RegExp(`\\[${escaped}\\]`, 'g')) || [];
    assert.equal(matches.length, 1, `${rule.id} must appear exactly once in DESIGN.md`);
  }

  const declared = design.match(/Coverage:\*\*\s*(\d+)\/(\d+)\s+active rules included/i);
  assert.ok(declared, 'DESIGN.md coverage banner is missing');
  assert.equal(Number(declared[1]), active.length, 'included coverage count is stale');
  assert.equal(Number(declared[2]), active.length, 'total coverage count is stale');
});

test('historical rules are explicitly mapped to active replacements', () => {
  const inventory = loadInventory();
  const activeIds = new Set(inventory.rules.filter(rule => rule.status === 'active').map(rule => rule.id));

  for (const historical of inventory.superseded_or_historical || []) {
    assert.ok(Array.isArray(historical.replaced_by) && historical.replaced_by.length > 0, `${historical.id} has no replacement mapping`);
    for (const id of historical.replaced_by) {
      assert.ok(activeIds.has(id), `${historical.id} points to missing active rule ${id}`);
    }
  }
});
