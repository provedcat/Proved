const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const entry = read('js/calculator-diet-entry.js');

function loadPolicy() {
  const mod = { exports: {} };
  vm.runInNewContext(entry, {
    window: { location: { search: '' } },
    sb: { auth: { onAuthStateChange() {} } },
    module: mod,
    URLSearchParams,
    provedGetRequestedSpecies: () => 'cat'
  }, { filename: 'calculator-diet-entry.js' });
  return mod.exports;
}

const { normalizeSavedEntries, savedDietPolicy } = loadPolicy();
const catId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const wetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

assert.deepEqual(JSON.parse(JSON.stringify(normalizeSavedEntries({
  건사료_결과: [{ 사료_id: catId, 이름: 'dry A', 비율: 60 }],
  습식사료_결과: [{ 사료_id: wetId, 이름: 'wet A', 비율: 40 }]
}))), [
  { type: 'dry', id: catId, name: 'dry A', pct: 60 },
  { type: 'wet', id: wetId, name: 'wet A', pct: 40 }
]);

assert.deepEqual(JSON.parse(JSON.stringify(normalizeSavedEntries({
  건사료_결과: [{ 이름: 'legacy product', 비율: 100 }]
}))), [{ type: 'dry', id: null, name: 'legacy product', pct: 100 }]);

assert.equal(savedDietPolicy(true, false), 'saved-diet');
assert.equal(savedDietPolicy(true, true), 'external-preview');
assert.equal(savedDietPolicy(false, true), 'external-preview');
assert.equal(savedDietPolicy(false, false), 'draft');

const calculator = read('js/calculator.js');
const savedCats = read('js/saved-cats.js');
const shell = read('js/proved-shell.js');
const session = read('js/calculator-session.js');
const petDetail = read('js/my-pet.js');
const detail = read('js/food-list.js');
const compare = read('js/food-compare.js');

assert.match(calculator, /건사료_결과\.push\(\{ 사료_id: feed\.id/);
assert.match(calculator, /습식사료_결과\.push\(\{ 사료_id: feed\.id/);
assert.match(savedCats, /provedOnFeedingPlanSaved\(\{ userId, petId: catId, result: currentResult \}\)/);
assert.match(shell, /await window\.provedRestoreSavedDietAndHandoff\(normalizedPet\)/);
assert.match(entry, /\.from\('feeding_records'\)/);
assert.match(entry, /\.order\('created_at', \{ ascending: false \}\)/);
assert.match(entry, /if \(pendingExternal\) await applyExternal\(species, serial\)/);
assert.match(entry, /if \(!applied\) clearSelectedFeeds\(\)/);
assert.match(entry, /provedRegistrationReturnPending/);
assert.match(session, /if \(readPendingRegisteredFeed\(\)\) window\.provedRegistrationReturnPending = true/);
assert.match(petDetail, /\.order\('created_at', \{ ascending: false \}\)/);
assert.match(detail, /-food-calculator\/\?feed=/);
assert.match(compare, /-food-calculator\/\?feed=/);

for (const page of ['index.html','cat-food-calculator/index.html','dog-food-calculator/index.html']) {
  assert.match(read(page), /calculator-diet-entry\.js/);
}

console.log('saved-diet handoff checks passed');
