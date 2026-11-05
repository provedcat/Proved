import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { collectLegacyProductPaths, restoreLegacyProductUrls } from './food-legacy-urls.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITE_ORIGIN = 'https://proved.kr';
const DEFAULT_SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_XFFdz51FE3JyOucv1qHRpw_fnsP6N8I';
const PAGE_SIZE = 1000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const execFileAsync = promisify(execFile);

const SELECT_COLUMNS = [
  'id', 'type', '제조사', '원산지', '제품명', '완전식여부', '메인단백질', '전성분',
  '조단백', '조지방', '조회분', '조섬유', '수분', '칼슘', '인', 'ca_p_ratio',
  'dm_단백', 'dm_지방', 'dm_회분', 'dm_섬유', 'dm_칼슘', 'dm_인', '겔화제',
  'final_me', 'cal_source', 'calorie_note', 'calorie_source_url', 'source_urls',
  'needs_calorie_review', 'verified', 'searchable_before_review',
  'brand_id', 'brands(id,name,name_ko,official_url,slug,logo_url,search_aliases)'
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
  const name = relation?.name || feed?.제조사 || '브랜드 정보 없음';
  return {
    id: relation?.id || feed?.brand_id || '',
    name,
    nameKo: relation?.name_ko || '',
    displayName: relation?.name_ko || name,
    slug: relation?.slug || slugify(name),
    logoUrl: /^https?:\/\//i.test(String(relation?.logo_url || '')) ? relation.logo_url : '',
    aliases: Array.isArray(relation?.search_aliases) ? relation.search_aliases : [],
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

function getProductSearchName(feed) {
  const brand = getBrand(feed);
  const product = splitProductName(feed?.제품명).primary;
  const normalized = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko').replace(/[\s·_-]+/g, '');
  const normalizedProduct = normalized(product);
  // Only the actual brand names qualify: aliases may name a product line (e.g. N&D).
  const brandNames = [brand.displayName, brand.nameKo, brand.name];
  const hasBrandPrefix = brandNames.some(value => {
    const prefix = normalized(value);
    return prefix.length >= 2 && normalizedProduct.startsWith(prefix);
  });
  return hasBrandPrefix ? product : `${brand.displayName} ${product}`;
}

function searchCalorie(feed) {
  // Values awaiting manual review must not become definitive facts in Google titles.
  if (feed?.needs_calorie_review === true || feed?.cal_source === 'manual_review') return null;
  const kcalPerKg = Number(feed?.final_me);
  if (!isPresent(feed?.final_me) || kcalPerKg <= 0) return null;
  return {
    per100g: formatNumber(kcalPerKg / 10, 2),
    perKg: formatNumber(kcalPerKg, 1),
    estimated: ['estimated', 'estimated_corrected'].includes(feed?.cal_source)
  };
}

function buildSearchTitle(feed) {
  const name = getProductSearchName(feed);
  const calorie = searchCalorie(feed);
  return calorie
    ? `${name} 칼로리 | 100g당 ${calorie.per100g}kcal${calorie.estimated ? ' (추정)' : ''} | 프루브`
    : `${name} 칼로리·영양성분 | 프루브`;
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
  const calorie = searchCalorie(feed);
  const facts = [
    calorie
      ? `100g당 ${calorie.per100g}kcal (${calorie.perKg}kcal/kg, ${calorieSourceLabel(feed.cal_source)})`
      : '칼로리 확인 또는 검토 중',
    isPresent(feed.조단백) ? `조단백 ${formatNumber(feed.조단백, 2)}%` : '',
    isPresent(feed.ca_p_ratio) ? `칼슘·인 비율 ${formatNumber(feed.ca_p_ratio, 2)}:1` : ''
  ].filter(Boolean);
  const available = [
    feed.전성분 ? '전성분' : '',
    ['조단백', '조지방', '수분', '칼슘', '인'].some(key => isPresent(feed[key])) ? '영양성분' : ''
  ].filter(Boolean);
  const details = available.length ? `${available.join('·')}을 확인하고 ` : '';
  const description = `${getProductSearchName(feed)} ${speciesLabel(species)} ${typeLabel(feed.type)}. ${facts.join(', ')}. ${details}급여량을 계산하세요. | 프루브`;
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

function renderProductSourceLinks(feed) {
  const entries = [...(Array.isArray(feed.source_urls) ? feed.source_urls : []),
    ...(feed.calorie_source_url ? [{ url: feed.calorie_source_url }] : [])];
  const seen = new Set();
  return entries.map(entry => typeof entry === 'string' ? entry : entry?.url)
    .filter(url => {
      if (typeof url !== 'string' || seen.has(url)) return false;
      try {
        if (!['http:', 'https:'].includes(new URL(url).protocol)) return false;
      } catch {
        return false;
      }
      seen.add(url);
      return true;
    }).slice(0, 6).map((url, index) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">자료 ${index + 1} · ${escapeHtml(new URL(url).hostname)}</a>`
    ).join(' · ');
}

function renderPrerenderedDetail(feed, species, allFeeds = []) {
  const brand = getBrand(feed);
  const product = splitProductName(feed.제품명);
  const sourceLinks = renderProductSourceLinks(feed);
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
            <div class="food-source-row"><dt>등록 상태</dt><dd class="${feed.verified === true ? '' : 'is-review'}">${feed.verified === true ? '관리자 등록' : '검수 전'}</dd></div>
            <div class="food-source-row"><dt>열량 분류</dt><dd>${escapeHtml(calorieSourceLabel(feed.cal_source))}</dd></div>
            ${feed.needs_calorie_review === true ? '<div class="food-source-row"><dt>열량 재검토</dt><dd class="is-review">추가 확인 필요</dd></div>' : ''}
            ${feed.calorie_note ? `<div class="food-source-row"><dt>열량 설명</dt><dd>${escapeHtml(feed.calorie_note)}</dd></div>` : ''}
            <div class="food-source-row"><dt>제품별 근거</dt><dd>${sourceLinks || '등록된 온라인 근거 링크 없음'}</dd></div>
          </dl>
          <p class="food-table-note">등록 상태는 외부 영양 인증을 뜻하지 않습니다. 브랜드 홈페이지도 제품별 영양 근거와는 다릅니다. <a href="/guide/feed-reading/sources/">출처·검수 기준 보기 →</a></p>
        </section>
        ${renderRelatedBrandLinks(feed, allFeeds, species)}
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
    name: getProductSearchName(feed),
    description,
    url: canonicalUrl,
    category: `${speciesLabel(species)} ${typeLabel(feed.type)}`,
    brand: { '@type': 'Brand', name: brand.displayName },
    additionalProperty
  };
}

export function renderProductPage(template, feed, species, allFeeds = []) {
  const brand = getBrand(feed);
  const product = splitProductName(feed.제품명);
  const productPath = buildProductPath(feed, species);
  const canonicalUrl = new URL(productPath, SITE_ORIGIN).href;
  const title = buildSearchTitle(feed);
  const description = buildDescription(feed, species);
  const structuredData = buildStructuredData(feed, species, canonicalUrl, description);
  const pageConfig = { species, id: String(feed.id), slug: buildProductSlug(feed), path: productPath };

  let html = template;
  // The list template has CollectionPage JSON-LD for /food/. Product pages
  // must not inherit that schema alongside their own Product JSON-LD.
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/g, (tag, jsonText) => {
    try {
      const data = JSON.parse(jsonText);
      if (data['@type'] === 'CollectionPage' && data.url === `${SITE_ORIGIN}/food/`) return '';
    } catch {
      // Preserve unrelated scripts. A malformed schema is not our responsibility here.
    }
    return tag;
  });
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
  // The Finder is hidden on a static product URL; do not emit a second H1.
  // The browser restores the list H1 if the visitor navigates back to Finder.
  html = replaceHeadValue(
    html,
    /<h1 id="foodListTitle">([^<]*)<\/h1>/,
    '<h2 id="foodListTitle">$1</h2>',
    '숨겨진 목록 제목'
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
    `<div id="foodDetailContent" data-prerendered-feed-id="${escapeHtml(feed.id)}">${renderPrerenderedDetail(feed, species, allFeeds)}</div>`,
    '상세 콘텐츠 영역'
  );
  return html;
}



const BRAND_FINDER_START = '<!-- PROVED_BRAND_FINDER_START -->';
const BRAND_FINDER_END = '<!-- PROVED_BRAND_FINDER_END -->';
const HANGUL_INITIALS = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const LATIN_INITIALS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0-9'];

function replaceBrandFinderContent(html, content) {
  const start = html.indexOf(BRAND_FINDER_START);
  const end = html.indexOf(BRAND_FINDER_END);
  if (start < 0 || end < 0 || end < start) throw new Error('브랜드 Finder 마커를 찾지 못했습니다.');
  return html.slice(0, start + BRAND_FINDER_START.length)
    + '\n'
    + content
    + '\n'
    + html.slice(end);
}

export function buildBrandPath(brand) {
  return `/food/brand/${brand.slug || slugify(brand.name)}/`;
}

function getHangulInitial(value) {
  const text = String(value || '').trim();
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) continue;
    const index = Math.floor((code - 0xAC00) / 588);
    return ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'][index]
      ?.replace('ㄲ', 'ㄱ').replace('ㄸ', 'ㄷ').replace('ㅃ', 'ㅂ').replace('ㅆ', 'ㅅ').replace('ㅉ', 'ㅈ') || '';
  }
  return '';
}

function getBrandHangulInitial(brand) {
  const values = [brand.nameKo, ...(brand.aliases || []), brand.name];
  for (const value of values) {
    const initial = getHangulInitial(value);
    if (initial) return initial;
  }
  return '';
}

function getBrandLatinInitial(brand) {
  const name = String(brand.name || '').trim();
  if (/^[0-9]/.test(name)) return '0-9';
  const values = [brand.name, ...(brand.aliases || [])];
  for (const value of values) {
    const match = String(value || '').match(/[A-Za-z]/);
    if (match) return match[0].toUpperCase();
  }
  return '';
}

function renderInitialButtons(initials, groups, range) {
  return initials.map(initial => {
    const count = groups.get(initial)?.length || 0;
    return `<button class="food-brand-initial" type="button" data-brand-initial="${escapeHtml(initial)}" data-brand-initial-range="${range}" aria-pressed="false"${count ? '' : ' disabled'}>${escapeHtml(initial)}</button>`;
  }).join('');
}

function renderBrandInitialGroups(initials, groups, range) {
  return initials.map(initial => {
    const entries = groups.get(initial) || [];
    if (!entries.length) return '';
    return `<div class="food-brand-finder__brand-list" data-brand-group="${escapeHtml(initial)}" data-brand-group-range="${range}" hidden>${entries.map(({ brand, items }) => {
      const label = brand.displayName || brand.name;
      return `<a class="food-brand-chip" href="${escapeHtml(buildBrandPath(brand))}" title="${escapeHtml(brand.name)}"><span>${escapeHtml(label)}</span></a>`;
    }).join('')}</div>`;
  }).join('');
}

// Curated shortcuts keep the most recognizable brand hubs visible without opening alphabet filters.
const FEATURED_BRAND_SLUGS = ["로얄캐닌-royal-canin","hill-s","purina","farmina","orijen","ziwi-peak","petcurean-펫큐리안","하림"];

export function renderBrandFinder(brandGroups) {
  const koGroups = new Map(HANGUL_INITIALS.map(initial => [initial, []]));
  const enGroups = new Map(LATIN_INITIALS.map(initial => [initial, []]));
  const sorted = [...brandGroups].sort((a, b) => {
    const aLabel = a.brand.displayName || a.brand.name;
    const bLabel = b.brand.displayName || b.brand.name;
    return String(aLabel).localeCompare(String(bLabel), 'ko');
  });

  for (const entry of sorted) {
    const ko = getBrandHangulInitial(entry.brand);
    if (koGroups.has(ko)) koGroups.get(ko).push(entry);
    const en = getBrandLatinInitial(entry.brand);
    if (enGroups.has(en)) enGroups.get(en).push(entry);
  }

  const bySlug = new Map(sorted.map(({ brand }) => [brand.slug || slugify(brand.name), brand]));
  const featuredLinks = FEATURED_BRAND_SLUGS.map(slug => bySlug.get(slug))
    .filter(Boolean)
    .map(brand => `<a class="food-brand-chip" href="${escapeHtml(buildBrandPath(brand))}"><span>${escapeHtml(brand.displayName || brand.name)}</span></a>`)
    .join('');
  const featuredMarkup = featuredLinks
    ? `<nav class="food-brand-finder__featured" aria-label="대표 브랜드 바로가기">${featuredLinks}</nav>\n    `
    : '';

  return `${featuredMarkup}<div class="food-brand-finder__ranges" aria-label="브랜드 이름 범위">
      <button class="food-brand-range" type="button" data-brand-range-toggle="ko" aria-expanded="false" aria-controls="foodBrandRangeKo">
        <span>ㄱ ~ ㅎ</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"></path></svg>
      </button>
      <button class="food-brand-range" type="button" data-brand-range-toggle="en" aria-expanded="false" aria-controls="foodBrandRangeEn">
        <span>A ~ Z</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"></path></svg>
      </button>
    </div>
    <div id="foodBrandRangeKo" class="food-brand-finder__panel" data-brand-range-panel="ko" hidden>
      <div class="food-brand-finder__initials" aria-label="한글 초성">${renderInitialButtons(HANGUL_INITIALS, koGroups, 'ko')}</div>
      <div class="food-brand-finder__groups">${renderBrandInitialGroups(HANGUL_INITIALS, koGroups, 'ko')}</div>
    </div>
    <div id="foodBrandRangeEn" class="food-brand-finder__panel" data-brand-range-panel="en" hidden>
      <div class="food-brand-finder__initials" aria-label="영문 알파벳">${renderInitialButtons(LATIN_INITIALS, enGroups, 'en')}</div>
      <div class="food-brand-finder__groups">${renderBrandInitialGroups(LATIN_INITIALS, enGroups, 'en')}</div>
    </div>`;
}

function collectBrandGroups(catFeeds, dogFeeds) {
  const groups = new Map();
  for (const [species, feeds] of [['cat', catFeeds], ['dog', dogFeeds]]) {
    for (const feed of feeds) {
      const brand = getBrand(feed);
      if (!brand.slug || !String(brand.name || '').trim()) continue;
      const key = brand.id || brand.slug;
      if (!groups.has(key)) groups.set(key, { brand, items: [] });
      groups.get(key).items.push({ feed, species });
    }
  }
  return [...groups.values()];
}

function renderBrandHub(brand, items, template) {
  const brandPath = buildBrandPath(brand);
  const canonicalUrl = new URL(brandPath, SITE_ORIGIN).href;
  const label = brand.displayName || brand.name;
  const sortedItems = [...items].sort((a, b) => {
    return String(a.feed.제품명 || '').localeCompare(String(b.feed.제품명 || ''), 'ko');
  });
  const title = `${label} 사료 성분·칼로리·급여량 | 프루브`;
  const description = `프루브에 등록된 ${label} 고양이·강아지 사료 ${items.length}종의 칼로리, 성분, DM 영양정보와 급여량 계산 정보를 확인하세요.`;
  const cards = sortedItems.map(({ feed, species }) => {
    const product = splitProductName(feed.제품명);
    return `<li><a class="brand-food-card" href="${escapeHtml(buildProductPath(feed, species))}"><strong>${escapeHtml(product.primary)}</strong><span>${escapeHtml(speciesLabel(species))} · ${escapeHtml(typeLabel(feed.type))} · ${escapeHtml(formatNumber(feed.final_me, 1))} kcal/kg</span></a></li>`;
  }).join('');
  const logo = brand.logoUrl ? `<img class="brand-hub-logo" src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(label)} 로고">` : '';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonicalUrl,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: sortedItems.length,
      itemListElement: sortedItems.map(({ feed, species }, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `${label} ${splitProductName(feed.제품명).primary}`,
        url: new URL(buildProductPath(feed, species), SITE_ORIGIN).href
      }))
    }
  };
  const hero = `<nav class="brand-breadcrumb"><a href="/food/#foodBrandFinder">사료 찾기</a><span>›</span><span>${escapeHtml(label)}</span></nav><header class="brand-hub-hero">${logo}<div><p class="food-eyebrow">BRAND</p><h1 id="foodListTitle">${escapeHtml(label)}</h1><p>${escapeHtml(description)}</p></div></header>`;
  const scope = { id: brand.id, path: brandPath, title, description };
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script id="brandStructuredData" type="application/ld+json">${jsonForHtml(structuredData)}</script>`)
    .replace(/<div class="food-list-hero">[\s\S]*?<\/div>/, hero)
    .replace(/<section id="foodBrandFinder"[\s\S]*?<\/section>/, '')
    .replace('<main class="food-main">', '<main class="food-main brand-hub">')
    .replace('<option value="brand">브랜드순</option>', '')
    .replace('<option value="product">제품명순</option>', '<option value="product" selected>제품명순</option>')
    .replace('브랜드 또는 제품명 검색', `${escapeHtml(label)} 제품 검색`)
    .replace('예: RAWZ, 로우즈 연어', '제품명이나 조건을 입력하세요')
    .replace('<div id="foodResults"', `<section id="brandStaticProducts"><h2>등록 제품 ${items.length}개</h2><ul class="brand-food-grid">${cards}</ul></section><div id="foodResults"`)
    .replace('</head>', `<link rel="stylesheet" href="/css/brand-hub.css"><script id="foodBrandScope" type="application/json">${jsonForHtml(scope)}</script></head>`)
    .replace(/<script defer src="\/js\/brand-finder\.js[^" ]*"><\/script>/, '')
    .replace(/food-list\.js\?v=[^" ]+/, 'food-list.js?v=20261105-managed-filters-v1');
  return html;
}

function renderRelatedBrandLinks(feed, allFeeds, species) {
  const brand = getBrand(feed);
  if (!brand.id && !brand.slug) return '';
  const related = allFeeds.filter(item => item.id !== feed.id && (getBrand(item).id || getBrand(item).slug) === (brand.id || brand.slug)).slice(0, 6);
  const label = brand.displayName || brand.name;
  const relatedLinks = related.length
    ? `<div class="food-brand-related__links">${related.map(item => `<a href="${escapeHtml(buildProductPath(item, species))}">${escapeHtml(splitProductName(item.제품명).primary)}</a>`).join('')}</div>`
    : '';
  return `<section class="food-detail-section food-brand-related" aria-labelledby="foodBrandRelatedHeading"><div class="food-section-heading"><span>+</span><h2 id="foodBrandRelatedHeading">${escapeHtml(label)}의 다른 사료</h2></div>${relatedLinks}<a class="food-brand-related__all" href="${escapeHtml(buildBrandPath(brand))}">${escapeHtml(label)} 브랜드 전체 제품 보기</a></section>`;
}


function validSitemapDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));
}

// The date belongs to actual page changes, never to the date the sitemap was rebuilt.
function sitemapContentSignature(html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
  const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1] || '';
  const details = html.match(/<article class="food-detail-article">[\s\S]*?<\/article>/)?.[0]
    || html.match(/<section id="brandStaticProducts">[\s\S]*?<\/section>/)?.[0];
  return details ? [title, description, details].join('\n') : null;
}

async function previousSitemapDates(repoRoot) {
  let sitemap = '';
  try {
    sitemap = await readFile(path.join(repoRoot, 'sitemap-foods.xml'), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const dates = new Map();
  for (const block of sitemap.match(/<url>[\s\S]*?<\/url>/g) || []) {
    const url = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (!url || !validSitemapDate(lastmod)) continue;
    try {
      const pathname = decodeURIComponent(new URL(url.replace(/&amp;/g, '&')).pathname);
      dates.set(pathname, lastmod);
    } catch {
      // A malformed old URL must not break regeneration.
    }
  }
  return dates;
}

async function previousContentSignatures(generatedRoots) {
  const signatures = new Map();
  for (const root of generatedRoots) {
    let dirs;
    try {
      dirs = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const filepath = path.join(root, dir.name, 'index.html');
      let html;
      try {
        html = await readFile(filepath, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      const signature = sitemapContentSignature(html);
      if (signature) signatures.set('/food/' + path.basename(root) + '/' + dir.name + '/', signature);
    }
  }
  return signatures;
}

// Backfill known historical page dates from Git; never replace them with
// "today" simply because this sitemap generator is being introduced.
async function gitPageDates(repoRoot) {
  const dates = new Map();
  let stdout;
  try {
    ({ stdout } = await execFileAsync('git', [
      '-c', 'core.quotePath=false', 'log', '--no-renames',
      '--format=SITEMAP_COMMIT_DATE:%cs', '--name-only', '--',
      'food/cat', 'food/dog', 'food/brand'
    ], { cwd: repoRoot, maxBuffer: 32 * 1024 * 1024 }));
  } catch {
    // Small test fixtures and non-Git distributions have no commit history.
    return dates;
  }
  let commitDate = '';
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith('SITEMAP_COMMIT_DATE:')) {
      commitDate = line.slice('SITEMAP_COMMIT_DATE:'.length).trim();
      continue;
    }
    if (!validSitemapDate(commitDate) || !/^food\/(cat|dog|brand)\/.+\/index\.html$/.test(line)) continue;
    const urlPath = '/' + line.slice(0, -'index.html'.length);
    if (!dates.has(urlPath)) dates.set(urlPath, commitDate);
  }
  return dates;
}

export function buildFoodSitemap(entries) {
  const urls = [...entries]
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'))
    .map(entry => {
      const url = escapeXml(new URL(entry.path, SITE_ORIGIN).href);
      const date = validSitemapDate(entry.lastmod) ? '\n    <lastmod>' + entry.lastmod + '</lastmod>' : '';
      return '  <url>\n    <loc>' + url + '</loc>' + date + '\n  </url>';
    })
    .join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls + '\n</urlset>\n';
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
  if (!resolvedTarget.startsWith(`${foodRoot}${path.sep}`) || !['cat', 'dog', 'brand'].includes(path.basename(resolvedTarget))) {
    throw new Error(`생성 폴더 범위가 올바르지 않습니다: ${resolvedTarget}`);
  }
}

export async function writeGeneratedPages({ repoRoot = DEFAULT_REPO_ROOT, catFeeds, dogFeeds, sitemapDate = new Date().toISOString().slice(0, 10) }) {
  // Capture previous URLs before deleting generated directories.
  const previousProductPaths = await collectLegacyProductPaths(repoRoot);
  const templatePath = path.join(repoRoot, 'food', 'index.html');
  const rawTemplate = await readFile(templatePath, 'utf8');
  const productTemplate = replaceBrandFinderContent(
    rawTemplate,
    '<p class="food-brand-finder__placeholder">브랜드 목록은 사료 찾기에서 확인할 수 있습니다.</p>'
  );
  const generatedRoots = [
    path.join(repoRoot, 'food', 'cat'),
    path.join(repoRoot, 'food', 'dog'),
    path.join(repoRoot, 'food', 'brand')
  ];
  generatedRoots.forEach(target => assertGeneratedRoot(repoRoot, target));
  if (!validSitemapDate(sitemapDate)) throw new Error('Invalid sitemap date');
  const [oldDates, oldSignatures, gitDates] = await Promise.all([
    previousSitemapDates(repoRoot),
    previousContentSignatures(generatedRoots),
    gitPageDates(repoRoot)
  ]);
  const pageLastmod = (urlPath, html) => {
    const previous = oldSignatures.get(urlPath);
    if (!previous || previous !== sitemapContentSignature(html)) return sitemapDate;
    return oldDates.get(urlPath) || gitDates.get(urlPath) || null;
  };
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
      const html = renderProductPage(productTemplate, feed, species, feeds);
      await writeFile(outputPath, html, 'utf8');
      entries.push({ path: productPath, species, id: String(feed.id), kind: 'product', lastmod: pageLastmod(productPath, html) });
    }
  }

  const brandGroups = collectBrandGroups(catFeeds, dogFeeds);
  for (const { brand, items } of brandGroups) {
    const brandPath = buildBrandPath(brand);
    if (seenPaths.has(brandPath)) throw new Error(`중복 브랜드 URL이 생성되었습니다: ${brandPath}`);
    seenPaths.add(brandPath);
    const outputPath = path.join(repoRoot, brandPath.replace(/^\//, ''), 'index.html');
    await mkdir(path.dirname(outputPath), { recursive: true });
    const html = renderBrandHub(brand, items, rawTemplate);
    await writeFile(outputPath, html, 'utf8');
    entries.push({ path: brandPath, id: brand.id || brand.slug, kind: 'brand', lastmod: pageLastmod(brandPath, html) });
  }

  const rootIndex = replaceBrandFinderContent(rawTemplate, renderBrandFinder(brandGroups));
  await writeFile(templatePath, rootIndex, 'utf8');
  await restoreLegacyProductUrls(repoRoot, previousProductPaths, entries);
  // Legacy redirect pages are intentionally excluded from the canonical sitemap.
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
