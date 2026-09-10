import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITE_ORIGIN = 'https://proved.kr';
const DEFAULT_SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_XFFdz51FE3JyOucv1qHRpw_fnsP6N8I';
const PAGE_SIZE = 1000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const SELECT_COLUMNS = [
  'id', 'type', '제조사', '원산지', '제품명', '완전식여부', '메인단백질', '전성분',
  '조단백', '조지방', '조회분', '조섬유', '수분', '칼슘', '인', 'ca_p_ratio',
  'dm_단백', 'dm_지방', 'dm_회분', 'dm_섬유', 'dm_칼슘', 'dm_인', '겔화제',
  'final_me', 'cal_source', 'calorie_note', 'verified', 'searchable_before_review',
  'brand_id', 'brands(name,official_url)'
].join(',');

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function jsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96)
    .replace(/-+$/g, '') || 'food';
}

function getBrand(feed) {
  const relation = Array.isArray(feed?.brands) ? feed.brands[0] : feed?.brands;
  return {
    name: relation?.name || feed?.제조사 || '브랜드 정보 없음',
    officialUrl: /^https?:\/\//i.test(String(relation?.official_url || '')) ? relation.official_url : ''
  };
}

function splitProductName(name) {
  const text = String(name || '').trim();
  const match = text.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
  if (!match) return { primary: text || '제품명 정보 없음', secondary: '' };
  return { primary: match[1].trim(), secondary: match[2].trim() };
}

export function buildProductSlug(feed) {
  const base = slugify(`${getBrand(feed).name} ${feed?.제품명 || ''}`);
  const stableId = String(feed?.id || '').replace(/-/g, '').slice(0, 8).toLowerCase();
  return `${base}--${stableId || 'detail'}`;
}

export function buildProductPath(feed, species) {
  return `/food/${species === 'dog' ? 'dog' : 'cat'}/${buildProductSlug(feed)}/`;
}

function speciesLabel(species) {
  return species === 'dog' ? '강아지' : '고양이';
}

function typeLabel(type) {
  return type === 'wet' ? '습식사료' : type === 'dry' ? '건사료' : '사료';
}

function roleLabel(role) {
  return role || '분류 확인중';
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function formatNumber(value, maxFraction = 2) {
  if (!isPresent(value)) return '—';
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction
  }).format(Number(value));
}

function formatPercent(value, maxFraction = 2) {
  return isPresent(value) ? `${formatNumber(value, maxFraction)}%` : '—';
}

function formatRatio(value) {
  return isPresent(value) && Number(value) > 0 ? `${formatNumber(value, 2)} : 1` : '—';
}

function buildDescription(feed, species) {
  const brand = getBrand(feed);
  const product = splitProductName(feed.제품명);
  const facts = [
    isPresent(feed.final_me) ? `열량 ${formatNumber(feed.final_me, 1)} kcal/kg` : '',
    isPresent(feed.dm_단백) ? `DM 단백질 ${formatNumber(feed.dm_단백, 2)}%` : '',
    isPresent(feed.ca_p_ratio) ? `칼슘·인 비율 ${formatNumber(feed.ca_p_ratio, 2)}:1` : ''
  ].filter(Boolean);
  const detail = facts.length ? `${facts.join(', ')} 등 ` : '';
  const description = `${brand.name} ${product.primary} ${speciesLabel(species)} ${typeLabel(feed.type)} 성분 정보. ${detail}등록 영양정보를 프루브에서 확인하세요.`;
  return description.length > 160 ? `${description.slice(0, 157).trim()}…` : description;
}

function sectionHeading(number, title, id) {
  return `<div class="food-section-heading"><span>${number}</span><h2 id="${id}">${escapeHtml(title)}</h2></div>`;
}

function metricCard(kind, label, value, unit) {
  return `<div class="food-metric food-metric--${kind}"><div><span class="food-metric__label">${escapeHtml(label)}</span><span class="food-metric__value">${escapeHtml(value)}</span>${unit ? `<span class="food-metric__unit">${escapeHtml(unit)}</span>` : ''}</div></div>`;
}

function mineralCard(label, value, sub) {
  return `<div class="food-mineral-item"><p class="food-mineral-item__label">${escapeHtml(label)}</p><p class="food-mineral-item__value">${escapeHtml(value)}</p><p class="food-mineral-item__sub">${escapeHtml(sub)}</p></div>`;
}

function calorieSourceLabel(source) {
  const labels = {
    official: '제조사 공식 정보',
    label: '제품 라벨 정보',
    seller: '판매처 정보',
    estimated_corrected: 'Proved 추정값 · 습식 보정',
    estimated: 'Proved 추정값',
    manual_review: '검토 필요'
  };
  return labels[source] || '출처 확인중';
}

function renderPrerenderedDetail(feed, species) {
  const brand = getBrand(feed);
  const product = splitProductName(feed.제품명);
  const basic = [
    ['대상', speciesLabel(species)],
    ['형태', typeLabel(feed.type)],
    ['분류', roleLabel(feed.완전식여부)],
    ['주 단백질', feed.메인단백질 || '정보 없음'],
    ['원산지', feed.원산지 || '정보 없음']
  ];
  const nutritionRows = [
    ['조단백', feed.조단백, feed.dm_단백],
    ['조지방', feed.조지방, feed.dm_지방],
    ['조회분', feed.조회분, feed.dm_회분],
    ['조섬유', feed.조섬유, feed.dm_섬유],
    ['수분', feed.수분, null],
    ['칼슘', feed.칼슘, feed.dm_칼슘],
    ['인', feed.인, feed.dm_인]
  ].filter(([, asFed, dm]) => isPresent(asFed) || isPresent(dm));
  const officialLink = brand.officialUrl
    ? `<a class="food-brand-link" href="${escapeHtml(brand.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(brand.name)} 공식 홈페이지</a>`
    : '';

  return `<article class="food-detail-article">
        <header class="food-detail-hero">
          <div class="food-detail-hero__brand-row">
            <p class="food-detail-brand">${escapeHtml(brand.name)}${feed.verified === true ? '' : '<span class="food-review-badge">검수 전</span>'}</p>
            ${officialLink}
          </div>
          <h1 id="foodDetailTitle">${escapeHtml(product.primary)}</h1>
          ${product.secondary ? `<p class="food-detail-hero__secondary">${escapeHtml(product.secondary)}</p>` : ''}
          <a class="food-compare-link" href="/food/compare/?species=${species}&amp;ids=${encodeURIComponent(feed.id)}">다른 제품과 비교하기</a>
        </header>

        <section class="food-detail-section" aria-labelledby="foodBasicHeading">
          ${sectionHeading('01', '기본 정보', 'foodBasicHeading')}
          <dl class="food-basic-grid">${basic.map(([label, value]) => `<div class="food-basic-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
        </section>

        <section class="food-detail-section" aria-labelledby="foodMetricsHeading">
          ${sectionHeading('02', '핵심 수치', 'foodMetricsHeading')}
          <div class="food-metric-grid">
            ${metricCard('energy', '열량', formatNumber(feed.final_me, 1), 'kcal/kg')}
            ${metricCard('moisture', '수분', formatNumber(feed.수분, 2), '%')}
            ${metricCard('protein', '단백질 · DM', formatNumber(feed.dm_단백, 2), '%')}
            ${metricCard('ratio', '칼슘 : 인', isPresent(feed.ca_p_ratio) ? formatNumber(feed.ca_p_ratio, 2) : '—', isPresent(feed.ca_p_ratio) ? ': 1' : '')}
          </div>
        </section>

        ${nutritionRows.length ? `<section class="food-detail-section" aria-labelledby="foodNutritionHeading">
          ${sectionHeading('03', '영양 정보', 'foodNutritionHeading')}
          <table class="food-nutrition-table">
            <thead><tr><th scope="col">항목</th><th scope="col">등록 값</th><th scope="col">건물 기준 DM</th></tr></thead>
            <tbody>${nutritionRows.map(([label, asFed, dm]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(formatPercent(asFed, label === '칼슘' || label === '인' ? 3 : 2))}</td><td>${dm === null ? '—' : escapeHtml(formatPercent(dm, label === '칼슘' || label === '인' ? 3 : 2))}</td></tr>`).join('')}</tbody>
          </table>
          <p class="food-table-note">DM은 수분을 제외한 건물 기준 환산값입니다. 등록 값은 데이터베이스에 저장된 수치를 그대로 표시합니다.</p>
        </section>` : ''}

        ${(isPresent(feed.칼슘) || isPresent(feed.인) || isPresent(feed.ca_p_ratio)) ? `<section class="food-detail-section" aria-labelledby="foodMineralHeading">
          ${sectionHeading('04', '칼슘 · 인', 'foodMineralHeading')}
          <div class="food-mineral-grid">
            ${mineralCard('Ca · 칼슘', formatPercent(feed.칼슘, 3), '제품 등록 수치')}
            ${mineralCard('P · 인', formatPercent(feed.인, 3), '제품 등록 수치')}
            ${mineralCard('Ca:P', formatRatio(feed.ca_p_ratio), '칼슘과 인의 등록 수치 비율')}
          </div>
        </section>` : ''}

        ${feed.전성분 ? `<section class="food-detail-section" aria-labelledby="foodIngredientsHeading">
          ${sectionHeading('05', '원재료', 'foodIngredientsHeading')}
          <p class="food-ingredients">${escapeHtml(feed.전성분)}</p>
          ${feed.겔화제 ? `<div class="food-additive-row"><strong>겔화제 · 점증제</strong><span>${escapeHtml(feed.겔화제)}</span></div>` : ''}
        </section>` : ''}

        <section class="food-detail-section" aria-labelledby="foodSourceHeading">
          ${sectionHeading(feed.전성분 ? '06' : '05', '정보 상태', 'foodSourceHeading')}
          <dl class="food-source-list">
            <div class="food-source-row"><dt>영양정보</dt><dd class="${feed.verified === true ? '' : 'is-review'}">${feed.verified === true ? '검수 완료' : '검수 전'}</dd></div>
            <div class="food-source-row"><dt>열량</dt><dd>${escapeHtml(calorieSourceLabel(feed.cal_source))}</dd></div>
            ${feed.calorie_note ? `<div class="food-source-row"><dt>열량 메모</dt><dd>${escapeHtml(feed.calorie_note)}</dd></div>` : ''}
          </dl>
        </section>
      </article>`;
}

function replaceHeadValue(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`제품 페이지 템플릿에서 ${label}을 찾지 못했습니다.`);
  return html.replace(pattern, replacement);
}

function buildStructuredData(feed, species, canonicalUrl, description) {
  const brand = getBrand(feed);
  const product = splitProductName(feed.제품명);
  const additionalProperty = [
    ['대상', speciesLabel(species)],
    ['형태', typeLabel(feed.type)],
    ['분류', roleLabel(feed.완전식여부)],
    ['열량', isPresent(feed.final_me) ? `${formatNumber(feed.final_me, 1)} kcal/kg` : ''],
    ['조단백', isPresent(feed.조단백) ? formatPercent(feed.조단백) : ''],
    ['DM 단백질', isPresent(feed.dm_단백) ? formatPercent(feed.dm_단백) : ''],
    ['조지방', isPresent(feed.조지방) ? formatPercent(feed.조지방) : ''],
    ['칼슘', isPresent(feed.칼슘) ? formatPercent(feed.칼슘, 3) : ''],
    ['인', isPresent(feed.인) ? formatPercent(feed.인, 3) : ''],
    ['칼슘:인', isPresent(feed.ca_p_ratio) ? formatRatio(feed.ca_p_ratio) : '']
  ].filter(([, value]) => value).map(([name, value]) => ({ '@type': 'PropertyValue', name, value }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brand.name} ${product.primary}`,
    description,
    url: canonicalUrl,
    category: `${speciesLabel(species)} ${typeLabel(feed.type)}`,
    brand: { '@type': 'Brand', name: brand.name },
    additionalProperty
  };
}

export function renderProductPage(template, feed, species) {
  const brand = getBrand(feed);
  const product = splitProductName(feed.제품명);
  const productPath = buildProductPath(feed, species);
  const canonicalUrl = new URL(productPath, SITE_ORIGIN).href;
  const title = `${brand.name} ${product.primary} 성분·칼로리 | 프루브`;
  const description = buildDescription(feed, species);
  const structuredData = buildStructuredData(feed, species, canonicalUrl, description);
  const pageConfig = { species, id: String(feed.id), slug: buildProductSlug(feed), path: productPath };

  let html = template;
  html = replaceHeadValue(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, 'title');
  html = replaceHeadValue(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`, 'description');
  html = replaceHeadValue(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`, 'canonical');
  html = replaceHeadValue(html, /<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="product">', 'Open Graph type');
  html = replaceHeadValue(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(title)}">`, 'Open Graph title');
  html = replaceHeadValue(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(description)}">`, 'Open Graph description');
  html = replaceHeadValue(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`, 'Open Graph URL');
  html = replaceHeadValue(html, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escapeHtml(title)}">`, 'Twitter title');
  html = replaceHeadValue(html, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escapeHtml(description)}">`, 'Twitter description');

  html = html.replace(
    '</head>',
    `  <script id="foodStructuredData" type="application/ld+json">${jsonForHtml(structuredData)}</script>\n  <script>window.__PROVED_FOOD_PAGE__=${jsonForHtml(pageConfig)};</script>\n</head>`
  );
  html = replaceHeadValue(
    html,
    /<section id="foodListView" class="food-list-view" aria-labelledby="foodListTitle">/,
    '<section id="foodListView" class="food-list-view" aria-labelledby="foodListTitle" hidden>',
    '목록 화면'
  );
  html = replaceHeadValue(
    html,
    /<section id="foodDetailView" class="food-detail-view" aria-labelledby="foodDetailTitle" hidden>/,
    '<section id="foodDetailView" class="food-detail-view" aria-labelledby="foodDetailTitle">',
    '상세 화면'
  );
  html = replaceHeadValue(
    html,
    /<div id="foodDetailContent"><\/div>/,
    `<div id="foodDetailContent" data-prerendered-feed-id="${escapeHtml(feed.id)}">${renderPrerenderedDetail(feed, species)}</div>`,
    '상세 콘텐츠 영역'
  );
  return html;
}

export function buildFoodSitemap(entries) {
  const urls = [...entries]
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'))
    .map(entry => `  <url>\n    <loc>${escapeXml(new URL(entry.path, SITE_ORIGIN).href)}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function fetchTable(table, supabaseUrl, publishableKey) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const url = new URL(`/rest/v1/${table}`, supabaseUrl);
    url.searchParams.set('select', SELECT_COLUMNS);
    url.searchParams.set('or', '(verified.eq.true,searchable_before_review.eq.true)');
    url.searchParams.set('order', '제조사.asc,제품명.asc');
    const response = await fetch(url, {
      headers: {
        apikey: publishableKey,
        Range: `${from}-${from + PAGE_SIZE - 1}`,
        'User-Agent': 'proved-food-page-generator/1.0'
      }
    });
    if (!response.ok) {
      const message = (await response.text()).slice(0, 500);
      throw new Error(`${table} 조회 실패 (${response.status}): ${message}`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`${table} 응답 형식이 배열이 아닙니다.`);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

function assertGeneratedRoot(repoRoot, target) {
  const foodRoot = path.resolve(repoRoot, 'food');
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(`${foodRoot}${path.sep}`) || !['cat', 'dog'].includes(path.basename(resolvedTarget))) {
    throw new Error(`생성 폴더 범위가 올바르지 않습니다: ${resolvedTarget}`);
  }
}

export async function writeGeneratedPages({ repoRoot = DEFAULT_REPO_ROOT, catFeeds, dogFeeds }) {
  const templatePath = path.join(repoRoot, 'food', 'index.html');
  const template = await readFile(templatePath, 'utf8');
  const generatedRoots = [path.join(repoRoot, 'food', 'cat'), path.join(repoRoot, 'food', 'dog')];
  generatedRoots.forEach(target => assertGeneratedRoot(repoRoot, target));
  for (const target of generatedRoots) {
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
  }

  const entries = [];
  const seenPaths = new Set();
  for (const [species, feeds] of [['cat', catFeeds], ['dog', dogFeeds]]) {
    for (const feed of feeds) {
      if (!feed?.id || !String(feed?.제품명 || '').trim()) continue;
      const productPath = buildProductPath(feed, species);
      if (seenPaths.has(productPath)) throw new Error(`중복 제품 URL이 생성되었습니다: ${productPath}`);
      seenPaths.add(productPath);
      const outputPath = path.join(repoRoot, productPath.replace(/^\//, ''), 'index.html');
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, renderProductPage(template, feed, species), 'utf8');
      entries.push({ path: productPath, species, id: String(feed.id) });
    }
  }

  await writeFile(path.join(repoRoot, 'sitemap-foods.xml'), buildFoodSitemap(entries), 'utf8');
  return entries;
}

async function main() {
  const supabaseUrl = process.env.PROVED_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const publishableKey = process.env.PROVED_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
  const [catFeeds, dogFeeds] = await Promise.all([
    fetchTable('feeds', supabaseUrl, publishableKey),
    fetchTable('dog_feeds', supabaseUrl, publishableKey)
  ]);
  const entries = await writeGeneratedPages({ catFeeds, dogFeeds });
  process.stdout.write(`Generated ${entries.length} food pages (${catFeeds.length} cat, ${dogFeeds.length} dog).\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
}
