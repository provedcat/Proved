const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, wetFactor, rows, render } = require('../js/food-data-policy.js');
const domestic = { type: 'wet', 완전식여부: '주식', 조단백: 7.7, 조지방: 1.3, 조회분: 2, 조섬유: 1.8, 수분: 84, 칼슘: .22, 인: .18, source_region: 'KR', verified: true, verification_status: 'approved' };
test('국내 젤리 값: Ca:P·차감 NFE·기존 습식계수로 계산하고 빈 열량도 성분 검수와 독립', () => {
  const result = calculate(domestic);
  assert.equal(result.ca_p_ratio, 1.22);
  assert.equal(result.nfe, 3.2);
  assert.equal(result.base_estimated_me, 492);
  assert.equal(result.final_me, 693.7);
  assert.equal(result.cal_source, 'estimated_corrected');
  const missing = calculate({ ...domestic, 수분: null });
  assert.equal(missing.final_me, null);
  assert.equal(missing.dm_단백, null);
  assert.equal(missing.eb_단백, null);
  assert.equal(rows(missing)[0][1], '검수 완료');
});
test('음수 NFE는 크기에 상관없이 0: 이전 -2% 차단조건은 적용하지 않는다', () => {
  const result = calculate({ ...domestic, 조단백: 10.14, 조지방: 7.47, 조회분: 3, 조섬유: .1, 수분: 85 });
  assert.equal(result.nfe, 0);
  assert.equal(result.base_estimated_me, 989.9);
  assert.equal(result.final_me, 1247.3);
});
test('회분 누락과 회분 0을 구분하고 공식 열량에는 보정을 중복 적용하지 않는다', () => {
  assert.equal(calculate({ ...domestic, 조회분: null }).final_me, null);
  assert.ok(calculate({ ...domestic, 조회분: 0 }).final_me > 0);
  const result = calculate({ ...domestic, 조회분: null, official_me: 967, final_me: 967, cal_source: 'official' });
  assert.equal(result.final_me, 967);
  assert.equal(result.nfe, null);
  assert.equal(result.corrected_me, null);
});
test('기존 습식 주식 계수 여섯 구간과 보조식 비보정', () => {
  assert.deepEqual([[85,2],[85,3],[82,2],[82,3],[81,2],[81,3]].map(([m,f]) => wetFactor(m,f)), [1.82,1.26,1.41,1.22,1.33,1.28]);
  const result = calculate({ ...domestic, 완전식여부: '보조식' });
  assert.equal(result.final_me, result.base_estimated_me);
});
test('국내 열량·유럽 성분 예외를 출처별로 구분하고 자유 메모를 정책으로 출력하지 않는다', () => {
  const feed = { ...domestic, final_me: 1040, cal_source: 'label', calorie_note: '실제 비율 확정 불가로 비워둠', source_urls: [{ purpose: 'information_basis', nutrition_basis: 'overseas', calorie_basis: 'KR', edition_basis: 'domestic_legacy', adequacy_basis: 'reviewer' }] };
  const html = render(feed);
  assert.match(html, /해외 공식 성분 기준/);
  assert.match(html, /국내 공식 값/);
  assert.match(html, /국내 유통 구판 기준/);
  assert.doesNotMatch(html, /확정 불가로 비워둠/);
});
