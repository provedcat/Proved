const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const page = file('about/index.html');
const css = file('css/proved-about.css');

test('reference hero and seven numbered editorial sections are implemented in order', () => {
  assert.match(page, /100마리의 고양이와 강아지가 있다면/);
  assert.match(page, /100개의 1등 사료가 있습니다/);
  const positions = ['01 \/ 시작','02 \/ 자료의 기준','03 \/ 제작 과정','04 \/ 확인의 범위','05 \/ 제보와 정정','06 \/ 운영 원칙','07 \/ 개인정보와 이용약관']
    .map(text => page.indexOf(text.replaceAll('\\/', '/')));
  assert.ok(positions.every(p => p >= 0), 'all seven sections must exist');
  assert.ok(positions.every((p,i) => i === 0 || p > positions[i-1]), 'section order must match the reference');
});

test('information-source and review-scope tables stay accessible', () => {
  assert.match(page, /<table class="pa-about-table">/);
  assert.equal((page.match(/<table class="pa-about-table">/g) || []).length, 2);
  for (const value of ['국내 라벨','제조사 공식 자료','해외 자료','제품 식별','라벨 대조','열량 확인','사용한 판본','확인일','원자료 링크']) {
    assert.ok(page.includes(value), 'expected item: '+value);
  }
  assert.match(page, /scope="row"/);
  assert.match(page, /scope="col"/);
});

test('supplied blue-icon references are implemented in order', () => {
  const icons = ['source','ai','review'];
  for (const kind of icons) {
    const location = 'images/about/process-'+kind+'.svg';
    assert.ok(fs.existsSync(path.join(__dirname, '..', location)));
    assert.ok(page.includes('/'+location));
    const asset = file(location);
    assert.match(asset, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(asset, /<title id="t">/);
  }
  assert.ok(page.indexOf('process-source.svg') < page.indexOf('process-ai.svg'));
  assert.ok(page.indexOf('process-ai.svg') < page.indexOf('process-review.svg'));
});

test('contact, disclosures, and document links remain functional real routes', () => {
  for (const href of [
    'mailto:provedcat@gmail.com','href="/support/"','href="/privacy/"','href="/terms/"'
  ]) assert.ok(page.includes(href), href);
  assert.ok(page.includes('이 외 협찬 및 제품 제공은 없습니다.'));
  assert.doesNotMatch(page, /현재 시안에서는 메모가 전송되지 않습니다|비공개 메모함은 준비하고/);
});

test('responsive desktop split and mobile single-column layouts are scoped to About', () => {
  assert.match(page, /class="pa-about-page"/);
  assert.match(css, /body\.pa-about-page \.pa-about-section\{display:grid/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /body\.pa-about-page \.pa-about-section\{display:block/);
  assert.match(css, /body\.pa-about-page \.pa-process-steps\{display:grid;grid-template-columns:1fr/);
  assert.match(css, /body\.pa-about-page \.pa-main/);
});
