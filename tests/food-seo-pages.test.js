const test = require('node:test');
const assert = require('node:assert/strict');
const { copyFile, mkdir, mkdtemp, readFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const BRAND = {
  id: 'bbbbbbbb-2222-4333-8444-555555555555',
  name: 'Farmina',
  name_ko: '파미나',
  slug: 'farmina',
  search_aliases: ['파미나', 'Farmina', 'N&D'],
  official_url: 'https://www.farmina.com/'
};

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
  brand_id: BRAND.id,
  brands: BRAND
};

const DOG_FEED = {
  ...CAT_FEED,
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  제품명: 'N&D Mini Adult Chicken',
  brand_id: BRAND.id,
  brands: BRAND
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
  const html = renderProductPage(template, CAT_FEED, 'cat', [CAT_FEED]);
  const encodedUrl = new URL(buildProductPath(CAT_FEED, 'cat'), 'https://proved.kr').href;

  assert.match(html, new RegExp(`<link rel="canonical" href="${encodedUrl}">`));
  assert.match(html, /<title>파미나 N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류 성분·칼로리·급여량 \| 프루브<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]*DM 단백질 39\.13%[^"]*">/);
  assert.match(html, /<meta property="og:type" content="product">/);
  assert.match(html, /<section id="foodListView"[^>]* hidden>/);
  assert.doesNotMatch(html, /<section id="foodDetailView"[^>]* hidden>/);
  assert.match(html, /<h1 id="foodDetailTitle">N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류<\/h1>/);
  assert.match(html, /<script id="foodStructuredData" type="application\/ld\+json">/);
  assert.match(html, /"@type":"Product"/);
  assert.match(html, /window\.__PROVED_FOOD_PAGE__=.*"id":"11111111-2222-4333-8444-555555555555"/);
  assert.match(html, /href="\/food\/brand\/farmina\/"/);
});

test('브랜드 Finder는 한글 초성·영문 알파벳과 실제 허브 href를 정적 HTML로 출력한다', async () => {
  const { renderBrandFinder } = await loadGenerator();
  const html = renderBrandFinder([
    {
      brand: {
        id: 'royal',
        name: '로얄캐닌 Royal Canin',
        nameKo: '로얄캐닌',
        displayName: '로얄캐닌',
        slug: 'royal-canin',
        aliases: ['로얄캐닌', 'Royal Canin']
      },
      items: [{ species: 'cat' }, { species: 'dog' }]
    },
    {
      brand: {
        id: 'nine',
        name: '9Care',
        nameKo: '',
        displayName: '9Care',
        slug: '9care',
        aliases: []
      },
      items: [{ species: 'cat' }]
    }
  ]);

  assert.match(html, /data-brand-range-toggle="ko"/);
  assert.match(html, /data-brand-range-toggle="en"/);
  assert.match(html, /data-brand-initial="ㄹ"/);
  assert.match(html, /data-brand-initial="R"/);
  assert.match(html, /data-brand-initial="0-9"/);
  assert.match(html, /href="\/food\/brand\/royal-canin\/"/);
  assert.match(html, /href="\/food\/brand\/9care\/"/);
  assert.match(html, />로얄캐닌<\/span>/);
});

test('고양이·강아지 제품은 하나의 브랜드 허브로 묶이고 루트 Finder와 사이트맵에 연결된다', async () => {
  const { buildBrandPath, buildProductPath, writeGeneratedPages } = await loadGenerator();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'proved-food-pages-'));
  try {
    await mkdir(path.join(tempRoot, 'food'), { recursive: true });
    await copyFile(path.join(__dirname, '..', 'food', 'index.html'), path.join(tempRoot, 'food', 'index.html'));

    const entries = await writeGeneratedPages({ repoRoot: tempRoot, catFeeds: [CAT_FEED], dogFeeds: [DOG_FEED] });
    assert.equal(entries.filter(entry => entry.kind === 'product').length, 2);
    assert.equal(entries.filter(entry => entry.kind === 'brand').length, 1);

    const catPath = buildProductPath(CAT_FEED, 'cat');
    const dogPath = buildProductPath(DOG_FEED, 'dog');
    const brandPath = buildBrandPath({ name: 'Farmina', slug: 'farmina' });
    assert.equal(brandPath, '/food/brand/farmina/');

    const catHtml = await readFile(path.join(tempRoot, catPath, 'index.html'), 'utf8');
    const brandHtml = await readFile(path.join(tempRoot, brandPath, 'index.html'), 'utf8');
    const rootHtml = await readFile(path.join(tempRoot, 'food', 'index.html'), 'utf8');
    const sitemap = await readFile(path.join(tempRoot, 'sitemap-foods.xml'), 'utf8');

    assert.match(catHtml, /파미나 N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류 성분·칼로리·급여량/);
    assert.match(catHtml, /href="\/food\/brand\/farmina\/"/);
    assert.match(brandHtml, /<link rel="canonical" href="https:\/\/proved\.kr\/food\/brand\/farmina\/">/);
    assert.match(brandHtml, /고양이 · 건사료/);
    assert.match(brandHtml, /강아지 · 건사료/);
    assert.match(brandHtml, /"@type":"CollectionPage"/);
    assert.match(rootHtml, /href="\/food\/brand\/farmina\/"/);
    assert.match(rootHtml, /data-brand-initial="ㅍ"/);
    assert.match(rootHtml, /data-brand-initial="F"/);

    assert.ok(sitemap.includes(new URL(catPath, 'https://proved.kr').href));
    assert.ok(sitemap.includes(new URL(dogPath, 'https://proved.kr').href));
    assert.ok(sitemap.includes(new URL(brandPath, 'https://proved.kr').href));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('목록 결과는 크롤러가 따라갈 수 있는 제품 링크를 출력한다', async () => {
  const source = await readFile(path.join(__dirname, '..', 'js', 'food-list.js'), 'utf8');
  assert.match(source, /<a class="food-result" href="\$\{escapeHtml\(buildProductPath\(feed\)\)\}"/);
  assert.doesNotMatch(source, /<button class="food-result"/);
});
