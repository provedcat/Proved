const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { allocateFeedingPlan } = require('../js/calculator-plan-adjust.js');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const row = (key, type, kcal, mode = 'auto', grams = 0) => ({ key, type, kcal, mode, grams });
const near = (actual, expected, tolerance = 1) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} within ${tolerance} kcal of ${expected}`);

// All-auto, including two wet products: group ratio is set once, foods split evenly.
const allAuto = allocateFeedingPlan([
  row('dry-0', 'dry', 4000), row('wet-0', 'wet', 1000), row('wet-1', 'wet', 1200)
], 200, 0.6);
near(allAuto.actualFoodKcal, 200);
near(allAuto.dryKcal, 120);
near(allAuto.wetKcal, 80);
near(allAuto.rows[1].actualKcal, allAuto.rows[2].actualKcal);

// Multiple autos with one manually fixed dry product.
const mixed = allocateFeedingPlan([
  row('dry-0', 'dry', 4000, 'manual', 20),
  row('dry-1', 'dry', 4000),
  row('wet-0', 'wet', 1000),
  row('wet-1', 'wet', 1000)
], 200, 0.6);
assert.equal(mixed.rows[0].grams, 20);
near(mixed.actualFoodKcal, 200);
near(mixed.dryKcal, 120);
near(mixed.wetKcal, 80);

// Direct entry exceeding dry share: remaining energy goes to the other auto group.
const shifted = allocateFeedingPlan([
  row('dry-0', 'dry', 4000, 'manual', 40),
  row('wet-0', 'wet', 1000)
], 200, 0.6);
near(shifted.actualFoodKcal, 200);
near(shifted.dryKcal, 160);
near(shifted.wetKcal, 40);

// Manual grams exceed total: auto is zero; excess is visible and never negative.
const over = allocateFeedingPlan([
  row('dry-0', 'dry', 4000, 'manual', 60), row('wet-0', 'wet', 1000)
], 200, 0.6);
assert.equal(over.rows[1].grams, 0);
assert.equal(over.differenceKcal, 40);
assert.ok(over.rows.every(item => item.grams >= 0));

// All-manual and zero-gram plans are allowed; they must not be silently rebalanced.
const manual = allocateFeedingPlan([
  row('dry-0', 'dry', 4000, 'manual', 15),
  row('wet-0', 'wet', 1000, 'manual', 30)
], 200, 0.6);
assert.equal(manual.actualFoodKcal, 90);
assert.equal(manual.differenceKcal, -110);
assert.equal(allocateFeedingPlan([row('dry-0', 'dry', 4000, 'manual', 0)], 200, 1).actualFoodKcal, 0);

// 100% wet, missing dry auto, and 0 target are valid.
const wetOnly = allocateFeedingPlan([row('wet-0', 'wet', 1000)], 150, 0);
near(wetOnly.actualFoodKcal, 150);
assert.equal(allocateFeedingPlan([row('wet-0', 'wet', 1000)], 0, 0).actualFoodKcal, 0);
assert.throws(() => allocateFeedingPlan([row('dry-0', 'dry', 0)], 100, 1));
assert.throws(() => allocateFeedingPlan([row('dry-0', 'dry', 4000, 'manual', -1)], 100, 1));

const calculator = read('js/calculator.js');
const session = read('js/calculator-session.js');
const diet = read('js/calculator-diet-entry.js');
for (const file of ['cat-food-calculator/index.html', 'dog-food-calculator/index.html']) {
  const html = read(file);
  assert.doesNotMatch(html, /id="drySwPct|id="drySwPctWrap|id="wetPct_/, file + ' must not show product percentages');
  // The ratio slider must retain the existing real-time group gram preview.
  assert.match(html, /id="feedingPreview"[^>]*aria-live="polite"/, file + ' must show live gram preview');
  assert.match(html, /id="previewDryGrams"/, file + ' must show dry grams');
  assert.match(html, /id="previewWetGrams"/, file + ' must show wet grams');
  assert.ok(html.indexOf('id="ratioSlider"') < html.indexOf('id="feedingPreview"'), file + ' preview must follow slider');
  assert.ok(html.indexOf('id="feedingPreview"') < html.indexOf('이 구성으로 계산하기'), file + ' preview must appear before calculate button');
  assert.match(html, /예상값입니다\. 제품별 급여량은 다음 단계에서 조정/, file + ' must distinguish estimate from final grams');
  assert.match(html, /id="planAdjustStep"/);
  assert.match(html, /id="planEnergyDifference"/);
  assert.match(html, /calculator-plan-adjust\.js/);
  assert.ok(html.indexOf('id="feedsStep"') < html.indexOf('id="ratioStep"'));
  assert.ok(html.indexOf('id="ratioStep"') < html.indexOf('id="planAdjustStep"'));
  assert.ok(html.indexOf('id="planAdjustStep"') < html.indexOf('id="resultArea"'));
}
assert.doesNotMatch(calculator, /document\.getElementById\(`wetPct_|document\.getElementById\(`drySwPct/);
assert.doesNotMatch(session, /wetPct_|drySwPct/);
assert.doesNotMatch(diet, /wetPct_|drySwPct/);
assert.match(calculator, /function updateRatio\(v\) \{[\s\S]*?updateFeedingPreview\(\)/, 'slider must refresh gram preview');
assert.match(calculator, /function updateFeedingPreview\(\) \{[\s\S]*?getAllocationPreview\(/, 'preview must use selected food energy');
assert.match(calculator, /previewDryGrams/, 'dry grams must be populated');
assert.match(calculator, /previewWetGrams/, 'wet grams must be populated');
assert.match(calculator, /calculate\(mode = 'prepare'\)/);
assert.match(calculator, /getCurrentPlan\(\)/);
assert.match(calculator, /differenceKcal: difference/);

console.log('calculator per-food grams allocation tests passed');
