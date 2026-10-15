const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const records = require('../js/pet-weight-records.js');

assert.equal(records.normalizeBcs(null), null);
assert.equal(records.normalizeBcs(''), null);
assert.equal(records.normalizeBcs('5'), 5);
assert.equal(records.normalizeBcs(1), 1);
assert.equal(records.normalizeBcs(9), 9);
assert.equal(records.normalizeBcs(0), null);
assert.equal(records.normalizeBcs(10), null);
assert.equal(records.normalizeBcs(5.5), null);
assert.equal(records.suggestedBcs([]), 5);
assert.equal(records.suggestedBcs([{ recorded_date: '2026-08-01', bcs_score: 7 }]), 7);
assert.equal(records.suggestedBcs([
  { recorded_date: '2026-09-01', bcs_score: null },
  { recorded_date: '2026-07-01', bcs_score: 4 },
  { recorded_date: '2026-08-01', bcs_score: 8 }
]), 8);
const ordered = records.normalizeWeightRecords([
  { recorded_date: '2026-10-15', weight_kg: '4.20', bcs_score: null },
  { recorded_date: '2026-09-15', weight_kg: '4.10', bcs_score: '7' }
]);
assert.equal(ordered[0].recorded_date, '2026-09-15');
assert.equal(ordered[1].bcs_score, null);
assert.equal(records.tooltipBcs(ordered[0]), 'BCS : 7/9');
assert.equal(records.tooltipBcs(ordered[1]), null);
assert.equal(records.recalculationUrl({ id: 'pet-01', species: 'cat' }), '/cat-food-calculator/?pet_id=pet-01');
assert.equal(records.recalculationUrl({ id: 'pet-02', species: 'dog' }), '/dog-food-calculator/?pet_id=pet-02');

const root = path.resolve(__dirname, '..');
const pet = fs.readFileSync(path.join(root, 'js/my-pet.js'), 'utf8');
const trend = fs.readFileSync(path.join(root, 'js/weight-trend.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'my/pet/index.html'), 'utf8');
assert.match(pet, /\.from\('weight_records'\)/);
assert.match(pet, /bcs_score/);
assert.match(pet, /tooltipBcs/);
assert.match(trend, /tooltipBcs/);
assert.match(html, /id="myPetBcsToggle"/);
assert.match(html, /id="myPetRecalculate"/);
assert.match(html, /id="petWeightChart"/);
console.log('MY PET weight + optional BCS tests passed');
