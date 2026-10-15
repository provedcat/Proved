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

const css = fs.readFileSync(path.join(root, 'css/my-pet.css'), 'utf8');
const digits = Array.from(html.matchAll(/<span class="my-pet-bcs-guide__score(?: my-pet-bcs-guide__score--ideal)?">(\\d)<\\/span>/g), match => Number(match[1]));
assert.deepEqual(digits, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.match(html, /my-pet-bcs-guide__score--ideal">5<\\/span>/);
assert.equal((html.match(/my-pet-bcs-guide__score--ideal/g) || []).length, 1);
assert.match(html, /현재 체형에 가장 가까운 점수를 선택해 주세요\\./);
assert.match(html, /5는 가장 이상적인 체형입니다\\./);
assert.match(html, /id="myPetBcsGuideImage"/);
assert.match(pet, /pet\\.species === 'dog'[\\s\\S]*?images\\/bcs\\/dog-bcs-silhouette\\.webp/);
assert.match(pet, /images\\/bcs\\/cat-bcs-silhouette\\.webp/);
assert.match(css, /grid-template-columns: repeat\\(9, minmax\\(0, 1fr\\)\\)/);
assert.match(css, /my-pet-bcs-guide__scroll[\\s\\S]*?overflow-x: auto/);
for (const species of ['cat', 'dog']) {
  const imagePath = path.join(root, 'images', 'bcs', species + '-bcs-silhouette.webp');
  const bytes = fs.readFileSync(imagePath);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.ok(bytes.length > 5000, species + ' guide asset should have image data');
}

console.log('MY PET weight + optional BCS tests passed');
