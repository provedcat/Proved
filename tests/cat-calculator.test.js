const assert = require('node:assert/strict');
const { getCaloriePlan, getWetDefaultPercentages } = require('../js/calculator.js');

function birthMonthsBefore(today, months, days = 0) {
  const birth = new Date(today);
  birth.setMonth(birth.getMonth() - months);
  birth.setDate(birth.getDate() + days);
  return birth.toISOString().slice(0, 10);
}

const today = new Date('2026-08-24T00:00:00');
for (const neutered of [false, true]) {
  const before4 = getCaloriePlan(4, birthMonthsBefore(today, 4, 1), neutered, false, today);
  const at4 = getCaloriePlan(4, birthMonthsBefore(today, 4), neutered, false, today);
  const before9 = getCaloriePlan(4, birthMonthsBefore(today, 9, 1), neutered, false, today);
  const at9 = getCaloriePlan(4, birthMonthsBefore(today, 9), neutered, false, today);
  const before12 = getCaloriePlan(4, birthMonthsBefore(today, 12, 1), neutered, false, today);
  const at12 = getCaloriePlan(4, birthMonthsBefore(today, 12), neutered, false, today);
  assert.ok(Math.abs(before4.f_age - at4.f_age) < 0.02, '4개월 경계가 연속이어야 합니다.');
  assert.ok(Math.abs(before9.f_age - at9.f_age) < 0.02, '9개월 경계가 연속이어야 합니다.');
  assert.ok(Math.abs(before12.f_age - at12.f_age) < 0.02, '12개월 경계가 연속이어야 합니다.');
  assert.ok(Math.abs(before12.DER - at12.DER) <= 2, '12개월 경계 DER 급변이 없어야 합니다.');
}

assert.deepEqual(getWetDefaultPercentages(1), [100]);
assert.deepEqual(getWetDefaultPercentages(2), [50, 50]);
assert.deepEqual(getWetDefaultPercentages(3), [35, 35, 30]);

console.log('cat calculator interpolation tests passed');
