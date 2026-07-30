const assert = require('node:assert/strict');
const {
  getAgeMonths,
  getDogAdultTransitionMonths,
  getDogGrowthFactor,
  getFediafPuppyEnergy,
  getDogCaloriePlan,
  getMealRatios
} = require('../js/calculator.js');

const today = new Date('2026-07-30T00:00:00');

assert.ok(getAgeMonths(new Date('2026-01-15T00:00:00'), today) > 6.4);
assert.equal(getDogAdultTransitionMonths(8), 10);
assert.equal(getDogAdultTransitionMonths(20), 12);
assert.equal(getDogAdultTransitionMonths(35), 15);
assert.equal(getDogAdultTransitionMonths(55), 18);

assert.deepEqual(getDogGrowthFactor(0.4, 0.4), { factor: 3, stage: '성장 초기' });
assert.deepEqual(getDogGrowthFactor(0.65, 0.6), { factor: 2.5, stage: '성장 중기' });
assert.deepEqual(getDogGrowthFactor(0.85, 0.8), { factor: 2, stage: '성장 후기' });
assert.deepEqual(getDogGrowthFactor(0.95, 0.95), { factor: 1.8, stage: '성견 전환기' });
assert.equal(getFediafPuppyEnergy(1, 3).DER, 209);
assert.equal(getFediafPuppyEnergy(1, 40).DER, 251);

const puppy = getDogCaloriePlan(8, '2026-01-15', false, {
  expectedAdultWeight: 20,
  activity: 'normal'
}, today);
assert.equal(puppy.stage, '성장 초기');
assert.ok(Math.abs(puppy.factor - ((254.1 - (135 * (8 / 20))) / 70)) < 0.0001);
assert.equal(puppy.transitionMonths, 12);
assert.equal(puppy.DER, getFediafPuppyEnergy(8, 20).DER);

for (const expectedAdultWeight of [3, 7, 11, 20, 30, 40, 50]) {
  const presetPlan = getDogCaloriePlan(2, '2026-05-01', false, {
    expectedAdultWeight,
    activity: 'normal'
  }, today);
  assert.equal(presetPlan.expectedAdultWeight, expectedAdultWeight);
  const expectedGrowth = getDogGrowthFactor(Math.min(2 / expectedAdultWeight, 1.5), Math.min(presetPlan.months / presetPlan.transitionMonths, 1));
  assert.equal(presetPlan.DER, getFediafPuppyEnergy(2, expectedAdultWeight).DER);
  assert.equal(presetPlan.stage, expectedGrowth.stage);
}

const directlyEditedAdultWeight = getDogCaloriePlan(4, '2026-05-01', false, {
  expectedAdultWeight: 23.5,
  activity: 'normal'
}, today);
assert.equal(directlyEditedAdultWeight.expectedAdultWeight, 23.5);
assert.equal(directlyEditedAdultWeight.DER, getFediafPuppyEnergy(4, 23.5).DER);

const unknownAdultWeight = getDogCaloriePlan(1, '2026-05-01', false, {
  expectedAdultWeight: null,
  activity: 'normal'
}, today);
assert.equal(unknownAdultWeight.expectedAdultWeight, null);
assert.equal(unknownAdultWeight.stage, '성장기');

const neuteredLowActivityAdult = getDogCaloriePlan(20, '2023-01-01', true, {
  activity: 'low'
}, today);
assert.equal(neuteredLowActivityAdult.factor, 1.4);
assert.equal(neuteredLowActivityAdult.stage, '성견');

const weightLoss = getDogCaloriePlan(20, '2023-01-01', true, {
  activity: 'high',
  diet: true
}, today);
assert.equal(weightLoss.factor, 1);
assert.equal(weightLoss.stage, '감량 모드');

const pregnant = getDogCaloriePlan(20, '2023-01-01', false, {
  pregnant: true
}, today);
assert.equal(pregnant.stage, '임신기');
assert.equal(pregnant.factor, 2);
assert.equal(pregnant.label, '임신 상태 반영');

const lactating = getDogCaloriePlan(20, '2023-01-01', false, {
  lactating: true
}, today);
assert.equal(lactating.stage, '수유기');
assert.equal(lactating.factor, 3);
assert.equal(lactating.label, '수유 상태 반영');

assert.deepEqual(getMealRatios(60), { dryPercent: 60, wetPercent: 40 });
assert.deepEqual(getMealRatios(0), { dryPercent: 0, wetPercent: 100 });
assert.deepEqual(getMealRatios(100), { dryPercent: 100, wetPercent: 0 });

console.log('dog calculator tests passed');
