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

test('띄어쓰기 없는 브랜드와 제품명도 대안 검색에서 찾는다', () => {
  assert.equal(fuzzy.suggestFoods(foods, '로얄캐닌베이비무스', searchText)[0]?.id, 'baby');
});

test('검색에서 포장 용량 80g과 85g을 구분하지 않고 제품 식별 요소는 유지한다', () => {
  const matches = fuzzy.suggestFoods(foods, '로얄캐닌 어덜트 습식 80g', searchText);
  assert.ok(matches.some(food => food.id === 'adult'));
  assert.equal(fuzzy.normalizeQuery('베이비무스195g'), '베이비무스');
  assert.equal(fuzzy.normalizeQuery('로얄캐닌 1.5kg'), '로얄캐닌');
  assert.equal(fuzzy.normalizeQuery('할로우 001 85g'), '할로우 001');
  assert.equal(fuzzy.normalizeQuery('85g'), '');
});

test('DB 실제 제품명처럼 베이비캣과 무스가 떨어져 있어도 찾는다', () => {
  const product = '로얄캐닌 마더 & 베이비캣 울트라 소프트 무스 캔';
  assert.equal(fuzzy.matchesText(product, '베이비무스'), true);
  assert.equal(fuzzy.matchesText(product, '로얄캐닌베이비무스'), true);
  assert.equal(fuzzy.matchesText(product, '무스 베이비 로얄캐닌'), true);
  assert.equal(fuzzy.matchesText(product, '베이비 무스 195g'), true);
  assert.equal(fuzzy.matchesText(product, '베이비 001'), false);
});

test('브랜드 별칭과 태그 레이블을 한 검색 문자열에서 결합할 수 있다', () => {
  const indexed = '로얄캐닌 royal canin royalcanin 마더 베이비캣 무스 동결건조 freeze dried';
  assert.equal(fuzzy.matchesText(indexed, 'royalcanin 동결'), true);
  assert.equal(fuzzy.matchesText(indexed, 'royal canin 베이비무스'), true);
  assert.equal(fuzzy.matchesText('동결건조 Freeze-dried', '동결'), true);
  assert.equal(fuzzy.matchesText('저온조리 low temp cooked 화식', '화식'), true);
  assert.equal(fuzzy.matchesText('생식 Raw', '생식'), true);
  assert.equal(fuzzy.matchesText('동결건조', '화식'), false);
});

test('모델명 숫자는 무시하거나 자동 변형하지 않는다', () => {
  assert.equal(fuzzy.matchesText('제품 001', '제품 002'), false);
  assert.equal(fuzzy.matchesText('제품 001', '제품 001'), true);
  assert.equal(fuzzy.matchesText('제품 185g', '제품 85g'), true);
});

test('짧은 입력과 무관한 사료는 오타 후보에 들어가지 않는다', () => {
  assert.deepEqual(fuzzy.suggestFoods(foods, '가', searchText), []);
  assert.deepEqual(fuzzy.suggestFoods(foods, '로얄케닌 알러지 케어', searchText), []);
});

test('자판 입력의 글자 위치 교환을 1회 오타로 인정한다', () => {
  assert.equal(fuzzy.boundedDistance('abcde', 'abdce', 1), 1);
});
