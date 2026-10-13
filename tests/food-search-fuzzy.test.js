const test = require('node:test');
const assert = require('node:assert/strict');
const fuzzy = require('../js/food-search-fuzzy.js');

const foods = [
  { id: 'baby', brand: '로얄캐닌', name: '베이비 무스 195g' },
  { id: 'adult', brand: '로얄캐닌', name: '어덜트 습식 85g' },
  { id: 'other', brand: '오리젠', name: '키튼 건식 1kg' }
];
const searchText = food => food.brand + ' ' + food.name;

test('한글 브랜드 및 제품명 오타를 후보로 제안한다', () => {
  const matches = fuzzy.suggestFoods(foods, '로얄케닌 베비 무스', searchText);
  assert.equal(matches[0]?.id, 'baby');
  assert.ok(matches.length <= 3);
});

test('공백이 생략된 제품명과 단어 순서가 바뀐 오타도 찾는다', () => {
  const matches = fuzzy.suggestFoods(foods, '베이비무스 로얄케닌', searchText);
  assert.equal(matches[0]?.id, 'baby');
});

test('정확히 검색 가능한 제품은 오타 후보 목록으로 보여주지 않는다', () => {
  assert.deepEqual(fuzzy.suggestFoods(foods, '로얄캐닌 베이비 무스', searchText), []);
});

test('중요 규격 숫자 85g을 80g으로 자동 보정하지 않는다', () => {
  const matches = fuzzy.suggestFoods(foods, '로얄캐닌 어덜트 습식 80g', searchText);
  assert.ok(!matches.some(food => food.id === 'adult'));
});

test('짧은 입력과 무관한 사료는 오타 후보에 들어가지 않는다', () => {
  assert.deepEqual(fuzzy.suggestFoods(foods, '가', searchText), []);
  assert.deepEqual(fuzzy.suggestFoods(foods, '로얄케닌 알러지 케어', searchText), []);
});

test('자판 입력의 글자 위치 교환을 1회 오타로 인정한다', () => {
  assert.equal(fuzzy.boundedDistance('abcde', 'abdce', 1), 1);
});
