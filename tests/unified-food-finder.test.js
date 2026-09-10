const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('통합 Finder는 전체 종을 기본값으로 제공하고 기본 URL 값을 생략한다', async () => {
  const [html, source] = await Promise.all([read('food/index.html'), read('js/food-list.js')]);
  assert.match(html, /data-species="all" aria-pressed="true">전체/);
  assert.match(source, /species: 'all'/);
  assert.match(source, /normalizeEnum\(params\.get\('species'\), \['cat', 'dog'\], 'all'\)/);
  assert.match(source, /if \(state\.species !== 'all'\) params\.set\('species', state\.species\)/);
});

test('검색어·종·형태·분류·정렬·태그는 하나의 URL state를 사용한다', async () => {
  const source = await read('js/food-list.js');
  for (const parameter of ['species', 'type', 'role', 'sort', 'q', 'tags']) {
    assert.ok(source.includes(`params.set('${parameter}'`), `${parameter} writer가 필요합니다.`);
  }
  assert.match(source, /selectedTagIds: \[\]/);
  assert.match(source, /activeTagCategory: ''/);
  assert.match(source, /loaded: PAGE_SIZE/);
  assert.match(source, /total: 0/);
  assert.match(source, /loading: false/);
});

test('전체 검색은 종별 서버 query를 bounded merge하고 결과에 species를 보존한다', async () => {
  const source = await read('js/food-list.js');
  assert.match(source, /state\.species === 'all' \? \['cat', 'dog'\]/);
  assert.match(source, /buildListQuery\(species, state\.loaded\)/);
  assert.match(source, /\.range\(0, limit - 1\)/);
  assert.match(source, /\{ \.\.\.row, species: speciesList\[index\] \}/);
  assert.doesNotMatch(source, /from\(getTable\(\)\)[\s\S]{0,200}for \(let from = 0; ;/);
});

test('태그는 고양이와 강아지 relation을 분리하고 AND 교집합으로 계산한다', async () => {
  const source = await read('js/food-list.js');
  assert.match(source, /'dog_feed_food_tags' : 'feed_food_tags'/);
  assert.match(source, /'dog_feed_id' : 'feed_id'/);
  assert.match(source, /tags\.size === required\.size/);
  assert.match(source, /\.in\('tag_id', state\.selectedTagIds\)/);
});

test('Condition Finder signature와 검색·선택 접근성을 유지한다', async () => {
  const [html, source, css] = await Promise.all([read('food/index.html'), read('js/food-list.js'), read('css/food-condition-page.css')]);
  assert.match(html, /id="foodConditionFolders" class="condition-folders"/);
  assert.match(source, /condition-folder__tab/);
  assert.match(source, /aria-expanded="\$\{active\}"/);
  assert.match(source, /data-condition-search/);
  assert.match(source, /aria-pressed="\$\{selected\}"/);
  assert.match(css, /position: absolute/);
  assert.match(css, /overflow-y: auto/);
});

test('legacy conditions route는 query와 hash를 보존해 canonical Finder로 이동한다', async () => {
  const html = await read('food/conditions/index.html');
  assert.match(html, /noindex,follow/);
  assert.match(html, /canonical" href="https:\/\/proved\.kr\/food\/"/);
  assert.match(html, /'\/food\/' \+ window\.location\.search \+ window\.location\.hash/);
  assert.match(html, /window\.location\.replace\(target\)/);
});

test('SEO product href와 Finder history 복원 계약을 유지한다', async () => {
  const source = await read('js/food-list.js');
  assert.match(source, /<a class="food-result" href="\$\{escapeHtml\(buildProductPath\(feed\)\)\}"/);
  assert.match(source, /foodFinder: \{ url: `\$\{window\.location\.pathname\}\$\{window\.location\.search\}`, scrollY: window\.scrollY, loaded: state\.loaded \}/);
  assert.match(source, /window\.scrollTo\(\{ top: Number\(finder\.scrollY\) \|\| 0/);
  assert.match(source, /els\.back\.addEventListener\('click', event/);
  assert.match(source, /if \(finder\?\.url\) \{ event\.preventDefault\(\); history\.back\(\); \}/);
  assert.match(source, /aria-controls="food-condition-/);
  assert.match(source, /restoreFinderFocus/);
  assert.match(source, /if \(readDetailRoute\(\)\) return;/);
});

test('사료 하위 메뉴는 사료 찾기와 등록 요청만 노출한다', async () => {
  const source = await read('js/proved-header.js');
  const foodBlock = source.match(/food: \[([\s\S]*?)\n    \],\n    archive:/)?.[1] || '';
  assert.match(foodBlock, /사료 찾기/);
  assert.match(foodBlock, /등록 요청/);
  assert.doesNotMatch(foodBlock, /조건으로 찾기|사료 목록/);
});
