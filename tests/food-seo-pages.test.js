const test = require('node:test');
const assert = require('node:assert/strict');
const { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const vm = require('node:vm');
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
  assert.match(html, /<title>파미나 N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류 칼로리 \| 100g당 420kcal \| 프루브<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]*100g당 420kcal[^"]*조단백 36%[^"]*">/);
  assert.match(html, /<meta property="og:type" content="product">/);
  assert.match(html, /<section id="foodListView"[^>]* hidden>/);
  assert.doesNotMatch(html, /<section id="foodDetailView"[^>]* hidden>/);
  assert.match(html, /<h1 id="foodDetailTitle">N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류<\/h1>/);
  assert.match(html, /<h2 id="foodListTitle">사료 추천, 내 기준으로 찾기<\/h2>/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, '제품 페이지에는 실제 상세 H1만 있어야 함');
  assert.match(html, /<script id="foodStructuredData" type="application\/ld\+json">/);
  assert.match(html, /"@type":"Product"/);
  assert.doesNotMatch(html, /"@type"\s*:\s*"CollectionPage"/);
  assert.equal((html.match(/<script[^>]*type="application\/ld\+json">/g) || []).length, 1);
  assert.match(html, /window\.__PROVED_FOOD_PAGE__=.*"id":"11111111-2222-4333-8444-555555555555"/);
  assert.match(html, /href="\/food\/brand\/farmina\/"/);
});


test('브랜드 중복을 제거하고 공식 칼로리를 100g당 값으로 검색 제목·설명에 표시한다', async () => {
  const { renderProductPage } = await loadGenerator();
  const template = await readFile(path.join(__dirname, '..', 'food', 'index.html'), 'utf8');
  const feed = {
    ...CAT_FEED,
    제품명: '나인케어 키튼',
    brands: { ...BRAND, name: '9Care', name_ko: '나인케어', search_aliases: ['나인케어'] },
    final_me: 3325
  };
  const html = renderProductPage(template, feed, 'cat');
  assert.match(html, /<title>나인케어 키튼 칼로리 \| 100g당 332\.5kcal \| 프루브<\/title>/);
  assert.doesNotMatch(html, /나인케어 나인케어 키튼/);
  const spacedName = renderProductPage(template, { ...feed, 제품명: '나인 케어 키튼' }, 'cat');
  assert.doesNotMatch(spacedName, /나인케어 나인 케어 키튼/);
  assert.match(html, /<meta name="description" content="[^"]*100g당 332\.5kcal[^"]*전성분·영양성분[^"]*">/);
  assert.match(html, /<meta property="og:title" content="나인케어 키튼 칼로리 \| 100g당 332\.5kcal \| 프루브">/);
  assert.match(html, /<meta name="twitter:title" content="나인케어 키튼 칼로리 \| 100g당 332\.5kcal \| 프루브">/);
  assert.match(html, /"name":"나인케어 키튼"/);
});

test('추정 열량은 검색 제목에서 표시하고 검토 필요·미등록 값은 확정 숫자를 숨긴다', async () => {
  const { renderProductPage } = await loadGenerator();
  const template = await readFile(path.join(__dirname, '..', 'food', 'index.html'), 'utf8');

  const estimated = renderProductPage(template, { ...CAT_FEED, cal_source: 'estimated' }, 'cat');
  assert.match(estimated, /칼로리 \| 100g당 420kcal \(추정\) \| 프루브/);
  assert.match(estimated, /Proved 추정값/);

  for (const feed of [
    { ...CAT_FEED, final_me: null },
    { ...CAT_FEED, final_me: 0 },
    { ...CAT_FEED, final_me: -12 },
    { ...CAT_FEED, needs_calorie_review: true },
    { ...CAT_FEED, cal_source: 'manual_review' }
  ]) {
    const html = renderProductPage(template, feed, 'cat');
    assert.match(html, /<title>파미나 N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류 칼로리·영양성분 \| 프루브<\/title>/);
    assert.match(html, /칼로리 확인 또는 검토 중/);
    assert.doesNotMatch(html, /<title>[^<]*100g당/);
  }
});

test('정적 제품 HTML과 JS 상세 화면의 SEO 제목·설명 규칙이 일치한다', async () => {
  const { renderProductPage } = await loadGenerator();
  const template = await readFile(path.join(__dirname, '..', 'food', 'index.html'), 'utf8');
  const browserSource = await readFile(path.join(__dirname, '..', 'js', 'food-list.js'), 'utf8');

  const extract = (start, end) => {
    const from = browserSource.indexOf(start);
    const to = browserSource.indexOf(end, from);
    assert.ok(from >= 0 && to > from, 'SEO helper source range: ' + start);
    return browserSource.slice(from, to);
  };
  // Execute the browser's real SEO builders, not a test-only copy of the algorithm.
  let species = 'cat';
  const script = [
    extract('  function isPresent(', '  function safeHttpUrl('),
    extract('  function seoProductName(', '  function updateListMetadata('),
    extract('  function getCalorieSourceLabel(', '  function energyIcon('),
    '({ buildSeoTitle, buildSeoDescription })'
  ].join('\n');
  const browserSeo = vm.runInNewContext(script, {
    Intl,
    getSpeciesLabel: () => species === 'dog' ? '강아지' : '고양이'
  });

  const nineCare = { ...BRAND, name: '9Care', name_ko: '나인케어' };
  const feeds = [
    { species: 'cat', feed: { ...CAT_FEED, 제품명: '나인케어 키튼', brands: nineCare, final_me: 3325 } },
    { species: 'cat', feed: { ...CAT_FEED, cal_source: 'estimated' } },
    { species: 'cat', feed: { ...CAT_FEED, needs_calorie_review: true } },
    { species: 'cat', feed: { ...CAT_FEED, final_me: null } },
    { species: 'dog', feed: { ...DOG_FEED, cal_source: 'estimated_corrected' } }
  ];

  for (const item of feeds) {
    species = item.species;
    const { feed } = item;
    const relation = feed.brands;
    const name = relation.name;
    const nameKo = relation.name_ko || '';
    const brand = { name, nameKo, displayName: nameKo || name };
    const product = { primary: feed.제품명 };
    const rendered = renderProductPage(template, feed, species);
    const staticTitle = rendered.match(/<title>([^<]+)<\/title>/)?.[1].replaceAll('&amp;', '&');
    const staticDescription = rendered.match(/<meta name="description" content="([^"]+)">/)?.[1].replaceAll('&amp;', '&');
    assert.equal(browserSeo.buildSeoTitle(feed, brand, product), staticTitle, feed.제품명 + ': title');
    assert.equal(browserSeo.buildSeoDescription(feed, brand, product), staticDescription, feed.제품명 + ': description');
  }

  assert.match(browserSource, /brands\(name,name_ko,official_url\)/);
  assert.match(browserSource, /prerenderedPage\.path === normalizePathname\(window\.location\.pathname\)/);
  assert.match(browserSource, /els\.detailContent\?\.dataset\.prerenderedFeedId === String\(feed\.id\)/);
  assert.match(template, /food-list\.js\?v=20261105-managed-filters-v1/);
});

test('제품별 근거 링크와 등록 상태를 구분하고 위험한 URL은 출력하지 않는다', async () => {
  const { renderProductPage } = await loadGenerator();
  const template = await readFile(path.join(__dirname, '..', 'food', 'index.html'), 'utf8');
  const feed = {
    ...CAT_FEED,
    verified: false,
    cal_source: 'estimated_corrected',
    needs_calorie_review: true,
    calorie_note: '보장성분으로 계산한 참고 열량입니다.',
    source_urls: [
      { url: 'https://example.com/food?name=cat&lang=ko', purpose: 'nutrition' },
      { url: 'https://example.com/food?name=cat&lang=ko', purpose: 'identity' },
      { url: 'javascript:alert(1)', purpose: 'other' },
      { url: 'https://%', purpose: 'other' }
    ],
    calorie_source_url: 'https://example.com/calorie'
  };
  const html = renderProductPage(template, feed, 'cat', [feed]);
  assert.match(html, /등록 상태<\/dt><dd class="is-review">검수 전/);
  assert.match(html, /Proved 추정값 · 습식 보정/);
  assert.match(html, /열량 재검토<\/dt><dd class="is-review">추가 확인 필요/);
  assert.match(html, /href="https:\/\/example.com\/food\?name=cat&amp;lang=ko"/);
  assert.match(html, /href="https:\/\/example.com\/calorie"/);
  assert.doesNotMatch(html, /href="javascript:|href="https:\/\/%"/);
  assert.equal((html.match(/자료 1 · example.com/g) || []).length, 1);
});

test('실시간 상세와 계산기는 출처 필드를 읽고 추정 열량 구분값을 사용한다', async () => {
  const detail = await readFile(path.join(__dirname, '..', 'js', 'food-list.js'), 'utf8');
  const search = await readFile(path.join(__dirname, '..', 'js', 'feed-search.js'), 'utf8');
  assert.match(detail, /'source_urls'/);
  assert.match(detail, /'calorie_source_url'/);
  assert.match(detail, /등록된 온라인 근거 링크 없음/);
  assert.match(search, /estimatedCalories: \['estimated', 'estimated_corrected'\]\.includes\(feedData\.cal_source\)/);
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

test('대표 브랜드 8개는 초성 선택 전 정적 링크로 표시되고 순서를 유지한다', async () => {
  const { renderBrandFinder } = await loadGenerator();
  const featured = [
    ['로얄캐닌', '로얄캐닌-royal-canin'],
    ['힐스', 'hill-s'],
    ['퓨리나', 'purina'],
    ['파미나', 'farmina'],
    ['오리젠', 'orijen'],
    ['지위픽', 'ziwi-peak'],
    ['펫큐리안', 'petcurean-펫큐리안'],
    ['하림', '하림']
  ];
  const groups = featured.map(([label, slug]) => ({
    brand: { name: label, nameKo: label, displayName: label, slug, aliases: [label] },
    items: [{ species: 'cat' }]
  }));
  const html = renderBrandFinder(groups);
  const shortcuts = html.match(/<nav class="food-brand-finder__featured"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(shortcuts, '대표 브랜드는 접힌 폴더 밖에 있어야 함');
  assert.ok(html.indexOf('food-brand-finder__featured') < html.indexOf('food-brand-finder__ranges'));
  assert.equal((shortcuts.match(/class="food-brand-chip"/g) || []).length, 8);
  let previous = -1;
  for (const [label, slug] of featured) {
    const link = `href="/food/brand/${slug}/"><span>${label}</span>`;
    const position = shortcuts.indexOf(link);
    assert.ok(position > previous, `${label}은 지정한 순서로 링크에 있어야 함`);
    previous = position;
  }
  const partial = renderBrandFinder(groups.slice(0, 1));
  assert.equal((partial.match(/<nav class="food-brand-finder__featured"[^>]*>/g) || []).length, 1);
  assert.equal((partial.match(/<nav class="food-brand-finder__featured"[\s\S]*?<\/nav>/g) || [])[0].match(/class="food-brand-chip"/g).length, 1);
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

    assert.match(catHtml, /파미나 N&amp;D 엔세스트럴 그레인 캣 닭고기와 석류 칼로리 \| 100g당 420kcal \| 프루브/);
    assert.match(catHtml, /href="\/food\/brand\/farmina\/"/);
    assert.match(brandHtml, /<link rel="canonical" href="https:\/\/proved\.kr\/food\/brand\/farmina\/">/);
    assert.ok(brandHtml.includes('<title>파미나 사료 성분·칼로리 확인 | PROVED</title>'));
    const brandDescription = '파미나 고양이·강아지 사료 2종의 제품 정보와 칼로리를 확인해 보세요. 국내 유통 제품을 기준으로 정리한 반려동물 사료 정보.';
    assert.ok(brandHtml.includes(`<meta name="description" content="${brandDescription}">`));
    assert.ok(brandHtml.includes('<meta property="og:title" content="파미나 사료 성분·칼로리 확인 | PROVED">'));
    assert.ok(brandHtml.includes(`<meta property="og:description" content="${brandDescription}">`));
    assert.ok(brandHtml.includes('<meta property="og:url" content="https://proved.kr/food/brand/farmina/">'));
    assert.ok(brandHtml.includes('<meta name="twitter:title" content="파미나 사료 성분·칼로리 확인 | PROVED">'));
    assert.ok(brandHtml.includes(`<meta name="twitter:description" content="${brandDescription}">`));
    assert.ok(brandHtml.includes('"name":"파미나 N&D 엔세스트럴 그레인 캣 닭고기와 석류"'));
    assert.equal((brandHtml.match(/<h1\b/g) || []).length, 1, '브랜드 허브에도 H1은 하나만');
    for (const id of ['foodSearchInput', 'foodSpeciesFilters', 'foodTypeFilters', 'foodRoleFilters', 'foodConditionFolders', 'foodSelectedConditions', 'foodLoadMore']) {
      assert.ok(brandHtml.includes(`id="${id}"`));
    }
    assert.match(brandHtml, /"id":"bbbbbbbb-2222-4333-8444-555555555555"/);
    assert.match(brandHtml, /<option value="product" selected>제품명순/);
    assert.doesNotMatch(brandHtml, /<option value="brand">/);
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


test('브랜드 설명의 대상 동물과 제품 수는 실제 브랜드 제품 구성에 따른다', async () => {
  const { writeGeneratedPages, buildBrandPath } = await loadGenerator();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'proved-brand-snippets-'));
  const brandPath = buildBrandPath(BRAND);
  const descriptionOf = html => html.match(/<meta name="description" content="([^"]+)">/)?.[1];

  try {
    await mkdir(path.join(tempRoot, 'food'), { recursive: true });
    await copyFile(path.join(__dirname, '..', 'food', 'index.html'), path.join(tempRoot, 'food', 'index.html'));

    await writeGeneratedPages({ repoRoot: tempRoot, catFeeds: [CAT_FEED], dogFeeds: [] });
    let html = await readFile(path.join(tempRoot, brandPath, 'index.html'), 'utf8');
    assert.match(descriptionOf(html), /^파미나 고양이 사료 1종/);
    assert.doesNotMatch(descriptionOf(html), /강아지/);

    await writeGeneratedPages({ repoRoot: tempRoot, catFeeds: [], dogFeeds: [DOG_FEED] });
    html = await readFile(path.join(tempRoot, brandPath, 'index.html'), 'utf8');
    assert.match(descriptionOf(html), /^파미나 강아지 사료 1종/);
    assert.doesNotMatch(descriptionOf(html), /고양이/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});


test('전체 브랜드 페이지는 JS 없이 이름과 유형별 등록 수, 실제 브랜드 링크를 제공한다', async () => {
  const { writeGeneratedPages, buildBrandPath } = await loadGenerator();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'proved-brand-directory-'));
  const mixedBrand = {
    ...BRAND, id: 'cccccccc-2222-4333-8444-555555555555',
    name: 'Royal Canin 로얄캐닌', name_ko: '로얄캐닌', slug: 'royal-canin'
  };
  const koreanOnly = {
    ...BRAND, id: 'dddddddd-2222-4333-8444-555555555555',
    name: '하림', name_ko: '하림', slug: 'harim'
  };
  const cat = [
    CAT_FEED,
    { ...CAT_FEED, id: '22222222-2222-4333-8444-555555555555', type: 'wet', 제품명: '습식 캔' },
    { ...CAT_FEED, id: '33333333-2222-4333-8444-555555555555', type: 'wet', 제품명: '로얄캐닌 캔', brands: mixedBrand, brand_id: mixedBrand.id },
    { ...CAT_FEED, id: '44444444-2222-4333-8444-555555555555', 제품명: '하림 건사료', brands: koreanOnly, brand_id: koreanOnly.id }
  ];
  try {
    await mkdir(path.join(tempRoot, 'food'), { recursive: true });
    await copyFile(path.join(__dirname, '..', 'food', 'index.html'), path.join(tempRoot, 'food', 'index.html'));
    await writeGeneratedPages({ repoRoot: tempRoot, catFeeds: cat, dogFeeds: [DOG_FEED] });
    const html = await readFile(path.join(tempRoot, 'food', 'brands', 'index.html'), 'utf8');
    const sitemap = await readFile(path.join(tempRoot, 'sitemap-foods.xml'), 'utf8');

    assert.ok(html.includes('<link rel="canonical" href="https://proved.kr/food/brands/">'));
    assert.ok(html.includes('<h1>사료 브랜드 전체 목록</h1>'));
    assert.ok(html.includes('href="/food/brand/farmina/"'));
    assert.ok(html.includes('href="/food/brand/royal-canin/"'));
    assert.ok(html.includes('href="/food/brand/harim/"'));
    assert.ok(html.includes('brand-directory__name">Farmina</strong>'));
    assert.ok(html.includes('brand-directory__name-ko">파미나</span>'));
    assert.ok(html.includes('brand-directory__name">Royal Canin</strong>'));
    assert.ok(html.includes('brand-directory__name-ko">로얄캐닌</span>'));
    assert.ok(html.includes('brand-directory__name">하림</strong>'));
    assert.doesNotMatch(html, /brand-directory__name-ko">하림/);
    const farminaRow = html.match(/<li><a class="brand-directory__item" href="\/food\/brand\/farmina\/"[\s\S]*?<\/li>/)?.[0];
    assert.ok(farminaRow);
    assert.ok(farminaRow.includes('brand-directory__metric--dry'));
    assert.ok(farminaRow.includes('brand-directory__metric--wet'));
    assert.ok(farminaRow.includes('>2<span class="brand-directory__unit">개</span>'));
    assert.ok(farminaRow.includes('>1<span class="brand-directory__unit">개</span>'));
    assert.ok(sitemap.includes('<loc>https://proved.kr/food/brands/</loc>'));
    const foodHtml = await readFile(path.join(tempRoot, 'food', 'index.html'), 'utf8');
    assert.ok(foodHtml.includes('href="/food/brands/"'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('사이트맵은 실제 제품 변경일만 반영하고 재생성 시 기존 날짜를 보존한다', async () => {
  const { buildFoodSitemap, buildProductPath, buildBrandPath, writeGeneratedPages } = await loadGenerator();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'proved-sitemap-lastmod-'));
  const sitemapPath = path.join(tempRoot, 'sitemap-foods.xml');
  const readSitemap = () => readFile(sitemapPath, 'utf8');
  const findDate = (xml, path) => {
    const loc = new URL(path, 'https://proved.kr').href;
    const block = (xml.match(/<url>[\s\S]*?<\/url>/g) || []).find(x => x.includes('<loc>' + loc + '</loc>'));
    assert.ok(block, path + ': missing sitemap entry');
    return block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || null;
  };

  try {
    await mkdir(path.join(tempRoot, 'food'), { recursive: true });
    await copyFile(path.join(__dirname, '..', 'food', 'index.html'), path.join(tempRoot, 'food', 'index.html'));
    const catPath = buildProductPath(CAT_FEED, 'cat');
    const dogPath = buildProductPath(DOG_FEED, 'dog');
    const brandPath = buildBrandPath(BRAND);
    const input = { repoRoot: tempRoot, catFeeds: [CAT_FEED], dogFeeds: [DOG_FEED] };
    await writeGeneratedPages({ ...input, sitemapDate: '2026-11-05' });
    let xml = await readSitemap();
    assert.equal((xml.match(/<url>/g) || []).length, 4);
    assert.equal(findDate(xml, catPath), '2026-11-05');
    assert.equal(findDate(xml, dogPath), '2026-11-05');
    assert.equal(findDate(xml, brandPath), '2026-11-05');
    assert.doesNotMatch(xml, /<changefreq>|<priority>/);

    // Rewriting the same content must not reset every URL's lastmod.
    await writeGeneratedPages({ ...input, sitemapDate: '2026-12-01' });
    xml = await readSitemap();
    assert.equal(findDate(xml, catPath), '2026-11-05');
    assert.equal(findDate(xml, dogPath), '2026-11-05');
    assert.equal(findDate(xml, brandPath), '2026-11-05');

    // A CSS revision is not a substantive product or brand content edit.
    const templatePath = path.join(tempRoot, 'food', 'index.html');
    const oldTemplate = await readFile(templatePath, 'utf8');
    await writeFile(templatePath, oldTemplate.replace('/css/proved-colors.css?', '/css/proved-colors.css?cachetest=1&'));
    await writeGeneratedPages({ ...input, sitemapDate: '2026-12-02' });
    xml = await readSitemap();
    assert.equal(findDate(xml, catPath), '2026-11-05');
    assert.equal(findDate(xml, dogPath), '2026-11-05');
    assert.equal(findDate(xml, brandPath), '2026-11-05');

    // Nutrition changes update the affected product and its brand index,
    // but leave unrelated dog product modification dates unchanged.
    await writeGeneratedPages({
      ...input,
      catFeeds: [{ ...CAT_FEED, final_me: 4210 }],
      sitemapDate: '2026-12-03'
    });
    xml = await readSitemap();
    assert.equal(findDate(xml, catPath), '2026-12-03');
    assert.equal(findDate(xml, brandPath), '2026-12-03');
    assert.equal(findDate(xml, dogPath), '2026-11-05');

    assert.match(buildFoodSitemap([{ path: catPath }]), /<loc>/);
    assert.doesNotMatch(buildFoodSitemap([{ path: catPath }]), /<lastmod>/);
    assert.match(buildFoodSitemap([{ path: catPath, lastmod: '2026-11-05' }]), /<lastmod>2026-11-05<\/lastmod>/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('네이버 진단: 개인정보처리방침·이용약관에 각각 고유한 설명이 있다', async () => {
  const privacy = await readFile(path.join(__dirname, '..', 'privacy', 'index.html'), 'utf8');
  const terms = await readFile(path.join(__dirname, '..', 'terms', 'index.html'), 'utf8');
  const getDescription = html => html.match(/<meta name="description" content="([^"]+)">/)?.[1];
  const privacyDescription = getDescription(privacy);
  const termsDescription = getDescription(terms);
  assert.ok(privacyDescription?.includes('개인정보처리방침'));
  assert.ok(termsDescription?.includes('이용약관'));
  assert.notEqual(privacyDescription, termsDescription);
  assert.equal((privacy.match(/<meta name="description"/g) || []).length, 1);
  assert.equal((terms.match(/<meta name="description"/g) || []).length, 1);
});

test('목록에서 상세로 이동 시 H1의 역할과 시각 스타일이 전환된다', async () => {
  const source = await readFile(path.join(__dirname, '..', 'js', 'food-list.js'), 'utf8');
  const css = await readFile(path.join(__dirname, '..', 'css', 'food-list.css'), 'utf8');
  assert.match(source, /function syncFoodListHeading\(isListVisible\)/);
  assert.match(source, /function showList\([\s\S]*?syncFoodListHeading\(true\)/);
  assert.match(source, /function renderDetail\([\s\S]*?syncFoodListHeading\(false\)/);
  assert.match(css, /\.food-list-hero h1, \.food-list-hero h2 \{/);
});

test('목록 결과는 크롤러가 따라갈 수 있는 제품 링크를 출력한다', async () => {
  const source = await readFile(path.join(__dirname, '..', 'js', 'food-list.js'), 'utf8');
  assert.match(source, /<a class="food-result" href="\$\{escapeHtml\(buildProductPath\(feed\)\)\}"/);
  assert.doesNotMatch(source, /<button class="food-result"/);
});

test('과거 제품 주소는 동일 UUID 제품으로 복구하고 변경 주소를 다음 생성에도 보존한다', async () => {
  const { buildProductPath, buildFoodSitemap, writeGeneratedPages } = await loadGenerator();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'proved-legacy-urls-'));
  try {
    await mkdir(path.join(tempRoot, 'food'), { recursive: true });
    await copyFile(path.join(__dirname, '..', 'food', 'index.html'), path.join(tempRoot, 'food', 'index.html'));

    const oldFeed = { ...CAT_FEED, brands: { ...BRAND, name: 'Farmina Pet Foods' } };
    const oldPath = buildProductPath(oldFeed, 'cat');
    const newPath = buildProductPath(CAT_FEED, 'cat');
    const unrelatedPath = '/food/cat/no-longer-listed--22222222/';
    assert.notEqual(oldPath, newPath);
    await writeFile(path.join(tempRoot, 'sitemap-foods.xml'), buildFoodSitemap([
      { path: oldPath },
      { path: unrelatedPath }
    ]));

    await writeGeneratedPages({ repoRoot: tempRoot, catFeeds: [CAT_FEED], dogFeeds: [] });
    const oldHtml = await readFile(path.join(tempRoot, oldPath, 'index.html'), 'utf8');
    const target = new URL(newPath, 'https://proved.kr').href;
    assert.ok(oldHtml.includes('<link rel="canonical" href="' + target + '">'));
    assert.ok(oldHtml.includes('<meta http-equiv="refresh" content="0;url=' + target + '">'));
    assert.ok(oldHtml.includes('location.replace('));
    const sitemap = await readFile(path.join(tempRoot, 'sitemap-foods.xml'), 'utf8');
    assert.ok(sitemap.includes(target));
    assert.ok(!sitemap.includes(new URL(oldPath, 'https://proved.kr').href));
    await assert.rejects(readFile(path.join(tempRoot, unrelatedPath, 'index.html'), 'utf8'));

    const renamedFeed = { ...CAT_FEED, 제품명: 'N&D 새로운 국내 표기' };
    const newestPath = buildProductPath(renamedFeed, 'cat');
    await writeGeneratedPages({ repoRoot: tempRoot, catFeeds: [renamedFeed], dogFeeds: [] });
    const oldHtmlAgain = await readFile(path.join(tempRoot, oldPath, 'index.html'), 'utf8');
    const previousHtml = await readFile(path.join(tempRoot, newPath, 'index.html'), 'utf8');
    const newestTarget = new URL(newestPath, 'https://proved.kr').href;
    assert.ok(oldHtmlAgain.includes(newestTarget));
    assert.ok(previousHtml.includes(newestTarget));
    const registry = JSON.parse(await readFile(path.join(tempRoot, 'scripts/legacy-food-paths.json'), 'utf8'));
    assert.ok(registry.includes(oldPath));
    assert.ok(registry.includes(newPath));
    assert.ok(!registry.includes(unrelatedPath));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
