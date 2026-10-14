const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const results = require('../js/registration-search-results.js');

const read = relative => readFile(path.join(__dirname, '..', relative), 'utf8');

test('an ambiguous AI result shows selectable verified candidates instead of a generic error', () => {
  const html = results.renderResponse({
    성공: true,
    needs_more_info: true,
    outcome: 'needs_candidate_selection',
    안내: '어떤 제품인지 선택해 주세요.',
    candidates: [
      {
        candidate_index: 0,
        manufacturer: '로얄캐닌',
        product_name: '마더 앤 베이비캣 무스',
        detected_feed_type: 'wet',
        match_reasons: ['공식 제품명 유사'],
        identity_verification: { brand_and_product_confirmed: true, reliable_source_confirmed: true, single_product_identified: false }
      },
      {
        candidate_index: 1,
        manufacturer: '브랜드 미확인',
        product_name: '알 수 없는 무스',
        identity_verification: { brand_and_product_confirmed: false, reliable_source_confirmed: false }
      }
    ]
  });
  assert.match(html, /사료 검색 결과/);
  assert.match(html, /마더 앤 베이비캣 무스/);
  assert.match(html, /data-register-candidate-index="0"/);
  assert.doesNotMatch(html, /data-register-candidate-index="1"/);
  assert.match(html, /라벨 사진으로 찾기/);
  assert.match(html, /제품명 수정하기/);
});

test('a single unidentified candidate can be shown without auto-registering unverified products', () => {
  const html = results.renderResponse({
    성공: true,
    needs_more_info: true,
    candidates: [{ candidate_index: 0, product_name: '비슷한 제품', identity_verification: { brand_and_product_confirmed: true, reliable_source_confirmed: false } }]
  });
  assert.match(html, /비슷한 제품/);
  assert.doesNotMatch(html, /data-register-candidate-index/);
});

test('a no-result AI response is a recoverable search result with useful next steps', () => {
  const html = results.renderResponse({
    성공: false,
    outcome: 'not_found',
    오류: '제품을 찾지 못했습니다. 제품명을 확인해 주세요.',
    candidates: []
  });
  assert.match(html, /사료 검색 결과 · 제품을 찾지 못했어요/);
  assert.match(html, /제품명을 확인해 주세요/);
  assert.match(html, /라벨 사진으로 찾기/);
});

test('network and service failures are not misrepresented as missing products', () => {
  const html = results.renderResponse({
    성공: false,
    outcome: 'request_failed',
    오류: '검색 서버에 연결하지 못했습니다.'
  });
  assert.match(html, /사료 검색을 완료하지 못했어요/);
  assert.doesNotMatch(html, /제품을 찾지 못했어요/);
});

test('untrusted AI product names and messages are escaped', () => {
  const html = results.renderResponse({
    성공: true,
    안내: '<script>alert(1)</script>',
    candidates: [{
      candidate_index: 0,
      manufacturer: '<img src=x onerror=alert(1)>',
      product_name: '<b>test</b>',
      match_reasons: ['<svg onload=alert(1)>'],
      identity_verification: { brand_and_product_confirmed: true, reliable_source_confirmed: true }
    }]
  });
  assert.doesNotMatch(html, /<script>|<img |<svg |<b>test<\/b>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});

test('registration submits one compound word through AI with minimum two characters', async () => {
  const [source, page] = await Promise.all([read('js/feed-registration.js'), read('feed-registration/index.html')]);
  assert.match(source, /if \(query\.length < 2\)/);
  assert.doesNotMatch(source, /query\.split\(\/\\s\+\/\)\.filter\(Boolean\)\.length < 2/);
  assert.match(source, /p_request_text: query/);
  assert.match(source, /action:'text_request'/);
  assert.match(source, /renderRegistrationSearchResult\(result, requestId\)/);
  assert.match(source, /action: 'text_candidate_select'/);
  assert.match(source, /request_id: registrationState\.candidateRequestId/);
  assert.match(source, /candidate_index: candidateIndex/);
  assert.match(page, /registration-search-results\.js\?v=20261014-registration-search-v1/);
  assert.match(page, /feed-registration\.js\?v=20261014-registration-search-v1/);
  assert.match(page, /AI가 실제 제품을 확인하고/);
});

test('calculator feed search remains a plain query without ingredient-condition UI', async () => {
  const [catHtml,dogHtml] = await Promise.all([read('cat-food-calculator/index.html'),read('dog-food-calculator/index.html')]);
  assert.doesNotMatch(catHtml, /원재료 조건|ingredient_condition/);
  assert.doesNotMatch(dogHtml, /원재료 조건|ingredient_condition/);
  const fuzzy = await read('js/food-search-fuzzy.js');
  assert.match(fuzzy, /isCompoundMatch/);
  assert.match(fuzzy, /matchPieces|partsMatch/);
});
