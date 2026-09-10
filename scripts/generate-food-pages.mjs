import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://proved.kr';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJxcGtsdnRnbmhyZG16eHpsc3RwcCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc1OTYxNTIyLCJleHAiOjIwOTE1Mzc1MjJ9.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';

export function buildProductSlug(value) {
  return String(value || 'product').normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';
}

export function buildProductPath(feed, species) {
  return `/food/${species}/${buildProductSlug(feed?.제품명 || 'product')}--${String(feed?.id || '').slice(0, 8).toLowerCase()}/`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderProductPage(feed, species) {
  const productPath = buildProductPath(feed, species);
  const canonical = `${SITE}${productPath}`;
  const brand = feed.제조사 || '브랜드 정보 없음';
  const name = feed.제품명 || '제품명 정보 없음';
  const speciesLabel = species === 'dog' ? '강아지' : '고양이';
  const typeLabel = feed.type === 'wet' ? '습식사료' : feed.type === 'dry' ? '건사료' : '형태 확인중';
  const roleLabel = feed.완전식여부 || '분류 확인중';
  const proteinLabel = feed.메인단백질 || '주 단백질 확인중';
  const energyLabel = Number.isFinite(Number(feed.final_me)) ? `${Number(feed.final_me).toLocaleString('ko-KR')} kcal/kg` : '—';
  const ratioLabel = Number(feed.ca_p_ratio) > 0 ? `${Number(feed.ca_p_ratio).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} : 1` : '—';
  const description = `${brand} ${name}의 사료 형태, 주 단백질, 열량, 칼슘·인 비율과 영양정보를 프루브에서 확인하세요.`;
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name, brand: { '@type': 'Brand', name: brand }, url: canonical }).replace(/</g, '\\u003c');
  const config = JSON.stringify({ id: feed.id, species, path: productPath }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(name)} | 프루브</title><meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}"><meta property="og:type" content="product"><meta property="og:site_name" content="프루브">
<meta property="og:title" content="${escapeHtml(name)} | 프루브"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/icons/icon-512.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(name)} | 프루브"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${SITE}/icons/icon-512.png">
<script type="application/ld+json">${jsonLd}</script><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<script>window.__PROVED_FOOD_PAGE__=${config}</script><script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<link rel="stylesheet" href="/css/proved-header.css"><link rel="stylesheet" href="/css/food-list.css"><link rel="stylesheet" href="/css/proved-colors.css"><link rel="stylesheet" href="/css/food-detail-refinements.css"><link rel="stylesheet" href="/css/food-mobile-nutrition-v2.css"><link rel="stylesheet" href="/css/product-tag-blob.css"><link rel="stylesheet" href="/css/product-tag-blob-organic-v3.css"><link rel="stylesheet" href="/css/food-detail-color-restoration.css">
<script defer src="/js/food-route.js"></script><script defer src="/js/proved-header.js"></script><script defer src="/js/food-list.js"></script><script defer src="/js/food-detail-refinements.js"></script><script defer src="/js/food-mobile-nutrition-v2.js"></script><script defer src="/js/product-tag-blob.js"></script><script defer src="/js/food-basic-extra-tags.js"></script><script defer src="/js/food-detail-visual-polish.js"></script><script defer src="/js/product-tag-blob-organic-v3.js"></script>
</head><body><div class="food-shell"><header data-proved-header="food"></header><main class="food-main"><section id="foodDetailView" class="food-detail-view" aria-labelledby="foodDetailTitle"><div class="food-detail-toolbar"><a id="foodBackToList" class="food-back-button" href="/food/">사료 찾기로 돌아가기</a></div><div id="foodDetailContent"><article class="food-detail-article"><header class="food-detail-hero"><p class="food-detail-brand">${escapeHtml(brand)}</p><h1 id="foodDetailTitle">${escapeHtml(name)}</h1><a class="food-compare-link" href="/food/compare/?species=${species}&amp;ids=${encodeURIComponent(feed.id)}">다른 제품과 비교하기</a></header><section class="food-detail-section" aria-labelledby="foodBasicHeading"><div class="food-section-heading"><span>01</span><h2 id="foodBasicHeading">기본 정보</h2></div><dl class="food-basic-grid"><div class="food-basic-item"><dt>대상</dt><dd>${speciesLabel}</dd></div><div class="food-basic-item"><dt>형태</dt><dd>${typeLabel}</dd></div><div class="food-basic-item"><dt>분류</dt><dd>${escapeHtml(roleLabel)}</dd></div><div class="food-basic-item"><dt>주 단백질</dt><dd>${escapeHtml(proteinLabel)}</dd></div><div class="food-basic-item"><dt>열량</dt><dd>${energyLabel}</dd></div><div class="food-basic-item"><dt>Ca:P</dt><dd>${ratioLabel}</dd></div></dl></section></article></div><div id="foodDetailStatus" class="food-detail-status" role="status" aria-live="polite"></div></section></main><footer data-proved-footer></footer></div></body></html>`;
}

async function fetchTable(table) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id,type,제조사,제품명,완전식여부,메인단백질,final_me,ca_p_ratio,verified,searchable_before_review&or=(verified.eq.true,searchable_before_review.eq.true)&order=id&offset=${offset}&limit=1000`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!response.ok) throw new Error(`${table}: ${response.status}`);
    const page = await response.json(); rows.push(...page); if (page.length < 1000) break;
  }
  return rows;
}

export async function generateFoodPages({ root = ROOT, feedsBySpecies } = {}) {
  const catalog = feedsBySpecies || { cat: await fetchTable('feeds'), dog: await fetchTable('dog_feeds') };
  const urls = [];
  for (const species of ['cat', 'dog']) {
    const dir = path.join(root, 'food', species);
    await fs.rm(dir, { recursive: true, force: true }); await fs.mkdir(dir, { recursive: true });
    for (const feed of catalog[species]) {
      const productPath = buildProductPath(feed, species); const output = path.join(root, productPath, 'index.html');
      await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, renderProductPage(feed, species)); urls.push(`${SITE}${productPath}`);
    }
  }
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
  await fs.writeFile(path.join(root, 'sitemap-foods.xml'), sitemap); return { count: urls.length, urls };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateFoodPages().then(({ count }) => console.log(`Generated ${count} product pages.`));
