const test = require('node:test');
const assert = require('node:assert/strict');
const { copyFile, mkdir, mkdtemp, readFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const CAT_FEED = {
  id: '11111111-2222-4333-8444-555555555555',
  type: 'dry',
  제조사: 'Farmina Pet Foods',
  원산지: '이탈리아',
  제품명: 'N&D 엔세스트럴 그레인 캣 닭고기와 석류',
  완전식여부: '주식',
  메인단백질: '닭고기',
  전성분: '뼈를 제거한 닭고기, 건조 닭고기 단백질, 스펠트밀, 귀리, 석류',
  조단백: 36,
  조지방: 20,
  수분: 8,
  칼슘: 1.1,
  인: 0.9,
  ca_p_ratio: 1.22,
  dm_단백: 39.13,
  dm_지방: 21.74,
  final_me: 4200,
  cal_source: 'official',
  verified: true,
  searchable_before_review: true,
  brands: { name: 'Farmina', official_url: 'https://www.farmina.com/' }
};

const DOG_FEED = {
  ...CAT_FEED,
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  제품명: 'Mini Adult Chicken',
  brands: { name: 'Example Dog', official_url: null }
};

async function loadGenerator() {
  return import('../scripts/generate-food-pages.mjs');
}

test('제품 URL은 읽을 수 있는 slug와 충돌 방지 ID를 포함한다', async () => {
  const { buildProductPath, buildProductSlug } = await loadGenerator();
  const slug = buildProductSlug(CAT_FEED);
  assert.match(slug, /^farmina-n-and-d-엔세스트럴-그레인-캣-닭고기와-석류--11111111$/);
  assert.equal(buildProductPath(CAT_FEED, 'cat'), `/food/cat/${slug}/`);
  assert.notEqual(
    buildProductPath(CAT_FEED, 'cat'),
    buildProductPath({ ...CAT_FEED, id: '99999999-2222-4333-8444-555555555555' }, 'cat')
  );
});

test('제품 HTML에 고유 canonical, 검색 설명, 본문과 구조화 데이터가 들어간다', async () => {
  const { buildProductPath, renderProductPage } = await loadGenerator();
  const template = await readFile(path.join(__dirname, '..', 'food', 'index.html'), 'utf8');
  const html = renderProductPage(template, CAT_FEED, 'cat');
  const encodedUrl = new URL(buildProductPath(CAT_FEED, 'cat'), 'https://proved.kr').href;

  assert.match(html, new RegExp(`<link rel="canonical" href="${encodedUrl}">`));
  assert.match(html, /<meta name="description" content="[^"]*DM 단백질 39\.13%[^"]*">/);
  assert.match(html, /<meta property="og:type" content="product">/);
  assert.match(html, /<section id="foodListView"[^>]* hidden>/);
  assert.doesNotMatch(html, /<section id="foodDetailView"[^>]* hidden>/);
  assert.match(html, /<h1 id="foodDetailTitle">N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류<\/h1>/);
  assert.match(html, /<script id="foodStructuredData" type="application\/ld\+json">/);
  assert.match(html, /"@type":"Product"/);
  assert.match(html, /window\.__PROVED_FOOD_PAGE__=.*"id":"11111111-2222-4333-8444-555555555555"/);
});

test('고양이·강아지 정적 페이지와 제품 사이트맵을 함께 생성한다', async () => {
  const { buildProductPath, writeGeneratedPages } = await loadGenerator();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'proved-food-pages-'));
  try {
    await mkdir(path.join(tempRoot, 'food'), { recursive: true });
    await copyFile(path.join(__dirname, '..', 'food', 'index.html'), path.join(tempRoot, 'food', 'index.html'));

    const entries = await writeGeneratedPages({ repoRoot: tempRoot, catFeeds: [CAT_FEED], dogFeeds: [DOG_FEED] });
    assert.equal(entries.length, 2);

    const catPath = buildProductPath(CAT_FEED, 'cat');
    const dogPath = buildProductPath(DOG_FEED, 'dog');
    const catHtml = await readFile(path.join(tempRoot, catPath, 'index.html'), 'utf8');
    const sitemap = await readFile(path.join(tempRoot, 'sitemap-foods.xml'), 'utf8');

    assert.match(catHtml, /Farmina N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류 성분·칼로리/);
    assert.ok(sitemap.includes(new URL(catPath, 'https://proved.kr').href));
    assert.ok(sitemap.includes(new URL(dogPath, 'https://proved.kr').href));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('목록 결과는 크롤러가 따라갈 수 있는 제품 링크를 출력한다', async () => {
  const source = await readFile(path.join(__dirname, '..', 'js', 'food-list.js'), 'utf8');
  assert.match(source, /<a class="food-result" href="\$\{escapeHtml\(buildProductPath\(feed\)\)\}"/);
  assert.doesNotMatch(source, /<button class="food-result"/);
});
