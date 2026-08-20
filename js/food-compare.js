(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const compareSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const params = new URLSearchParams(window.location.search);
  const state = {
    species: params.get('species') === 'dog' ? 'dog' : 'cat',
    ids: [...new Set(String(params.get('ids') || '').split(',').map(value => value.trim()).filter(Boolean))].slice(0, 2),
    feeds: [],
    replaceIndex: 1,
    searchTimer: null,
    lastFocused: null
  };

  const detailColumns = [
    'id', 'type', '제조사', '원산지', '제품명', '완전식여부', '메인단백질', '전성분',
    '조단백', '조지방', '조회분', '조섬유', '수분', '칼슘', '인', 'ca_p_ratio',
    'dm_단백', 'dm_지방', 'dm_회분', 'dm_섬유', 'dm_칼슘', 'dm_인', '겔화제',
    'final_me', 'eb_단백', 'eb_지방', 'eb_탄수화물', 'eb_칼슘', 'eb_인',
    'verified', 'searchable_before_review', 'brand_id', 'brands(name,official_url)'
  ].join(',');
  const searchColumns = [
    'id', 'type', '제조사', '제품명', '완전식여부', '메인단백질',
    'verified', 'searchable_before_review', 'brand_id', 'brands(name,official_url)'
  ].join(',');

  const els = {};
  function $(id) { return document.getElementById(id); }
  function getTable() { return state.species === 'dog' ? 'dog_feeds' : 'feeds'; }
  function getSpeciesLabel() { return state.species === 'dog' ? '강아지' : '고양이'; }
  function getTypeLabel(type) { return type === 'wet' ? '습식사료' : type === 'dry' ? '건사료' : '형태 확인중'; }
  function isPresent(value) { return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function quotePostgrestFilterValue(value) {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  function formatNumber(value, maxFraction = 2) {
    if (!isPresent(value)) return null;
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: maxFraction }).format(Number(value));
  }
  function formatValue(value, unit, digits = 2) {
    const number = formatNumber(value, digits);
    return number === null ? null : `${number}${unit}`;
  }
  function getBrand(feed) {
    const relation = Array.isArray(feed?.brands) ? feed.brands[0] : feed?.brands;
    return relation?.name || feed?.제조사 || '브랜드 정보 없음';
  }
  function getProductMarker(index) { return index === 0 ? 'A 제품' : 'B 제품'; }
  function getFeedIndex(feed) { return state.feeds.indexOf(feed); }
  function getShortName(feed) {
    const index = getFeedIndex(feed);
    return index >= 0 ? getProductMarker(index) : getBrand(feed);
  }
  function comparisonTableHead() {
    return `<thead><tr><th>항목</th><th>A 제품</th><th>B 제품</th></tr></thead>`;
  }
  function missingCell() { return '<span class="is-missing">비교할 정보가 부족합니다</span>'; }
  function valueCell(value, unit, digits = 2) {
    const formatted = formatValue(value, unit, digits);
    return formatted === null ? missingCell() : escapeHtml(formatted);
  }
  function makeRow(label, first, second, unit, digits = 2) {
    return `<tr><th scope="row">${escapeHtml(label)}</th><td>${valueCell(first, unit, digits)}</td><td>${valueCell(second, unit, digits)}</td></tr>`;
  }
  function insightMissing() {
    return '<p class="food-compare-insight is-missing">비교할 정보가 부족합니다.</p>';
  }
  function compareInsight(first, second, label, unit, basis, digits = 1, higherWord = '높아요') {
    if (!isPresent(first) || !isPresent(second)) return insightMissing();
    const a = Number(first);
    const b = Number(second);
    const nameA = getShortName(state.feeds[0]);
    const nameB = getShortName(state.feeds[1]);
    const difference = Math.abs(a - b);
    const threshold = Math.max(Math.abs(a), Math.abs(b), 1) * 0.02;
    if (difference <= threshold) {
      return `<p class="food-compare-insight">${escapeHtml(basis)} 두 제품의 ${escapeHtml(label)}은 큰 차이가 없어요.</p>`;
    }
    const higherName = a > b ? nameA : nameB;
    const lowerName = a > b ? nameB : nameA;
    return `<p class="food-compare-insight">${escapeHtml(basis)} ${escapeHtml(higherName)}의 ${escapeHtml(label)}이 ${escapeHtml(lowerName)}보다 약 ${escapeHtml(formatNumber(difference, digits))}${escapeHtml(unit)} ${escapeHtml(higherWord)}.</p>`;
  }
  function pairValueInsight(first, second, label, unit, basis, digits = 1) {
    if (!isPresent(first) || !isPresent(second)) return insightMissing();
    return `<p class="food-compare-insight">${escapeHtml(basis)} ${escapeHtml(getShortName(state.feeds[0]))}은 ${escapeHtml(label)} 약 ${escapeHtml(formatNumber(first, digits))}${escapeHtml(unit)}, ${escapeHtml(getShortName(state.feeds[1]))}은 약 ${escapeHtml(formatNumber(second, digits))}${escapeHtml(unit)}입니다.</p>`;
  }
  function dmInsight(a, b) {
    if (!isPresent(a.dm_단백) || !isPresent(b.dm_단백) || !isPresent(a.dm_지방) || !isPresent(b.dm_지방)) return insightMissing();
    const proteinDifference = Number(a.dm_단백) - Number(b.dm_단백);
    const fatDifference = Number(a.dm_지방) - Number(b.dm_지방);
    if (proteinDifference === 0 && fatDifference === 0) {
      return '<p class="food-compare-insight">수분을 제외한 단백질과 지방 표시는 두 제품이 같아요.</p>';
    }
    const proteinHigher = proteinDifference === 0 ? null : proteinDifference > 0 ? getShortName(a) : getShortName(b);
    const fatHigher = fatDifference === 0 ? null : fatDifference > 0 ? getShortName(a) : getShortName(b);
    if (!proteinHigher) {
      return `<p class="food-compare-insight">수분을 제외한 단백질 표시는 같고, 지방은 ${escapeHtml(fatHigher)}이 더 높게 표시됩니다.</p>`;
    }
    if (!fatHigher) {
      return `<p class="food-compare-insight">수분을 제외한 지방 표시는 같고, 단백질은 ${escapeHtml(proteinHigher)}이 더 높게 표시됩니다.</p>`;
    }
    if (proteinHigher === fatHigher) {
      return `<p class="food-compare-insight">수분을 제외하면 ${escapeHtml(proteinHigher)}의 단백질과 지방이 모두 더 높게 표시됩니다.</p>`;
    }
    return `<p class="food-compare-insight">수분을 제외하면 단백질은 ${escapeHtml(proteinHigher)}, 지방은 ${escapeHtml(fatHigher)}이 더 높게 표시됩니다.</p>`;
  }
  function per100Kcal(feed, key) { return isPresent(feed?.[key]) ? Number(feed[key]) / 10 : null; }
  function waterPer100Kcal(feed) {
    if (!isPresent(feed?.수분) || !isPresent(feed?.final_me) || Number(feed.final_me) <= 0) return null;
    return 1000 * Number(feed.수분) / Number(feed.final_me);
  }

  function cacheElements() {
    els.content = $('foodCompareContent');
    els.status = $('foodCompareStatus');
    els.back = $('foodCompareBack');
    els.modal = $('foodCompareSearchModal');
    els.searchInput = $('foodCompareSearchInput');
    els.searchResults = $('foodCompareSearchResults');
    els.searchStatus = $('foodCompareSearchStatus');
    els.searchClose = $('foodCompareSearchClose');
    els.shell = document.querySelector('.food-compare-shell');
    els.modalDialog = els.modal.querySelector('.food-compare-modal__dialog');
  }

  function bindEvents() {
    els.searchClose.addEventListener('click', closeSearchModal);
    els.modal.querySelector('[data-close-compare-search]').addEventListener('click', closeSearchModal);
    els.searchInput.addEventListener('input', () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(searchFeeds, 260);
    });
    els.searchResults.addEventListener('click', event => {
      const button = event.target.closest('[data-compare-feed-id]');
      if (button) selectSearchResult(button.dataset.compareFeedId);
    });
    els.content.addEventListener('click', event => {
      const button = event.target.closest('[data-change-product]');
      if (!button) return;
      state.replaceIndex = Number(button.dataset.changeProduct) === 0 ? 0 : 1;
      openSearchModal(button);
    });
    els.content.addEventListener('input', event => {
      if (event.target.matches('[data-simulation-grams]')) updateSimulation();
    });
    document.addEventListener('keydown', handleModalKeydown);
  }

  function updateUrl() {
    const next = new URLSearchParams();
    next.set('species', state.species);
    if (state.ids.length) next.set('ids', state.ids.join(','));
    history.replaceState({}, '', `${window.location.pathname}?${next.toString()}`);
  }

  async function loadFeeds() {
    if (!state.ids.length) {
      els.status.textContent = '먼저 비교할 제품을 선택해주세요.';
      state.replaceIndex = 0;
      renderEmptySelection();
      openSearchModal();
      return;
    }
    const { data, error } = await compareSb.from(getTable()).select(detailColumns)
      .in('id', state.ids).or('verified.eq.true,searchable_before_review.eq.true');
    if (error) {
      els.status.textContent = `제품 정보를 불러오지 못했습니다. ${error.message || ''}`.trim();
      return;
    }
    const byId = new Map((data || []).map(feed => [String(feed.id), feed]));
    state.feeds = state.ids.map(id => byId.get(String(id))).filter(Boolean);
    if (state.feeds.length !== state.ids.length) {
      state.ids = state.feeds.map(feed => String(feed.id));
      updateUrl();
    }
    if (!state.feeds.length) {
      els.status.textContent = '비교할 제품을 다시 선택해주세요.';
      state.replaceIndex = 0;
      renderEmptySelection();
      openSearchModal();
      return;
    }
    if (state.feeds.length === 1) {
      els.status.textContent = '';
      state.replaceIndex = 1;
      renderWaitingProduct();
      openSearchModal();
      return;
    }
    els.status.textContent = '';
    renderComparison();
  }

  function renderWaitingProduct() {
    const feed = state.feeds[0];
    els.content.hidden = false;
    els.content.innerHTML = `<section class="food-compare-products">${renderProduct(feed, 0)}<article class="food-compare-product"><p class="food-compare-product__marker">B 제품</p><p class="food-compare-product__brand">비교 제품</p><h2>두 번째 제품을 선택해주세요.</h2><button class="food-compare-product__select" type="button" data-change-product="1">B 제품 선택</button></article></section>`;
  }

  function renderEmptySelection() {
    els.content.hidden = false;
    els.content.innerHTML = '<section class="food-compare-empty"><p>비교할 첫 번째 제품을 선택해주세요.</p><button class="food-compare-product__select" type="button" data-change-product="0">A 제품 선택</button></section>';
  }

  function renderProduct(feed, index) {
    return `<article class="food-compare-product">
      <p class="food-compare-product__marker">${getProductMarker(index)}</p>
      <p class="food-compare-product__brand">${escapeHtml(getBrand(feed))}</p>
      <h2>${escapeHtml(feed.제품명 || '제품명 정보 없음')}</h2>
      <p class="food-compare-product__meta">${escapeHtml(getSpeciesLabel())} · ${escapeHtml(getTypeLabel(feed.type))} · ${escapeHtml(feed.완전식여부 || '분류 확인중')}</p>
      <button class="food-compare-product__change" type="button" data-change-product="${index}">${getProductMarker(index)} 변경</button>
    </article>`;
  }

  function renderComparison() {
    const [a, b] = state.feeds;
    document.title = `${getBrand(a)} · ${getBrand(b)} 사료 비교 | 프루브`;
    els.back.href = `/food/?species=${encodeURIComponent(state.species)}&id=${encodeURIComponent(a.id)}`;
    els.content.hidden = false;
    els.content.innerHTML = `
      <section class="food-compare-products" aria-label="비교 제품">${renderProduct(a, 0)}${renderProduct(b, 1)}</section>
      <section class="food-compare-section" aria-labelledby="compareNutritionHeading">
        <div class="food-compare-section__heading"><span>01</span><h2 id="compareNutritionHeading">영양정보 비교</h2></div>
        ${renderDmGroup(a, b)}
        ${renderEnergyGroup(a, b)}
        ${renderMineralGroup(a, b)}
        ${renderMoistureGroup(a, b)}
        ${renderIngredientGroup(a, b)}
      </section>
      <section class="food-compare-section" aria-labelledby="compareSimulationHeading">
        <div class="food-compare-section__heading"><span>02</span><h2 id="compareSimulationHeading">급여량 기준 비교</h2></div>
        <p class="food-simulation-note">기본값은 100g입니다. 입력한 동일한 급여량을 두 제품에 적용해 비교합니다.</p>
        <div class="food-simulation-controls">
          ${renderSimulationControl()}
        </div>
        <div id="foodSimulationResult"></div>
      </section>
      <aside class="food-compare-disclaimer">
        <strong>비교 정보 안내</strong><br>
        이 비교는 제품 라벨에 표시된 보증성분과 등록된 열량을 기준으로 계산한 참고 정보입니다. 보증성분은 실제 측정값이 아니라 제조사가 보증하는 최소값 또는 최대값이므로, 실제 영양성분과 차이가 있을 수 있습니다. 탄수화물은 표시된 영양성분을 이용해 계산한 추정치입니다.
      </aside>`;
    updateSimulation();
  }

  function renderDmGroup(a, b) {
    return `<div class="food-compare-group"><h3>DM 영양성분</h3>
      ${dmInsight(a, b)}
      <table class="food-compare-table">${comparisonTableHead()}<tbody>
        ${makeRow('단백질', a.dm_단백, b.dm_단백, '%')}
        ${makeRow('지방', a.dm_지방, b.dm_지방, '%')}
        ${makeRow('섬유', a.dm_섬유, b.dm_섬유, '%')}
        ${makeRow('회분', a.dm_회분, b.dm_회분, '%')}
        ${makeRow('칼슘', a.dm_칼슘, b.dm_칼슘, '%', 3)}
        ${makeRow('인', a.dm_인, b.dm_인, '%', 3)}
      </tbody></table></div>`;
  }

  function renderEnergyGroup(a, b) {
    const proteinA = per100Kcal(a, 'eb_단백');
    const proteinB = per100Kcal(b, 'eb_단백');
    return `<div class="food-compare-group"><h3>같은 100kcal 기준</h3>
      ${pairValueInsight(proteinA, proteinB, '단백질', 'g', '같은 100kcal를 급여하면')}
      <table class="food-compare-table">${comparisonTableHead()}<tbody>
        ${makeRow('단백질', proteinA, proteinB, 'g')}
        ${makeRow('지방', per100Kcal(a, 'eb_지방'), per100Kcal(b, 'eb_지방'), 'g')}
        ${makeRow('탄수화물 추정치', per100Kcal(a, 'eb_탄수화물'), per100Kcal(b, 'eb_탄수화물'), 'g')}
      </tbody></table></div>`;
  }

  function renderMineralGroup(a, b) {
    return `<div class="food-compare-group"><h3>칼슘 · 인 <span class="food-compare-group__unit">단위: g/1,000kcal</span></h3>
      ${compareInsight(a.eb_인, b.eb_인, '인 함량', 'g', '같은 1,000kcal를 급여하면')}
      <table class="food-compare-table">${comparisonTableHead()}<tbody>
        ${makeRow('칼슘', a.eb_칼슘, b.eb_칼슘, '')}
        ${makeRow('인', a.eb_인, b.eb_인, '')}
        ${makeRow('칼슘:인', a.ca_p_ratio, b.ca_p_ratio, ' : 1')}
      </tbody></table></div>`;
  }

  function renderMoistureGroup(a, b) {
    const waterA = waterPer100Kcal(a);
    const waterB = waterPer100Kcal(b);
    return `<div class="food-compare-group"><h3>수분</h3>
      ${pairValueInsight(waterA, waterB, '수분을', 'ml', '같은 100kcal를 급여하면')}
      <table class="food-compare-table">${comparisonTableHead()}<tbody>
        ${makeRow('수분 함량', a.수분, b.수분, '%')}
        ${makeRow('100kcal당 수분', waterA, waterB, 'ml', 1)}
      </tbody></table></div>`;
  }

  function renderIngredientGroup(a, b) {
    if (!a.메인단백질 || !b.메인단백질) {
      return `<div class="food-compare-group"><h3>원재료</h3>${insightMissing()}<div class="food-compare-ingredients">${renderIngredient(a)}${renderIngredient(b)}</div></div>`;
    }
    const sameProtein = a.메인단백질 && b.메인단백질 && String(a.메인단백질).trim() === String(b.메인단백질).trim();
    const insight = sameProtein
      ? `두 제품 모두 ${escapeHtml(a.메인단백질)}을 주 단백질원으로 표시하고 있어요.`
      : `A 제품은 ${escapeHtml(a.메인단백질 || '주 단백질원 확인중')}, B 제품은 ${escapeHtml(b.메인단백질 || '주 단백질원 확인중')}을 주 단백질원으로 표시하고 있어요.`;
    return `<div class="food-compare-group"><h3>원재료</h3><p class="food-compare-insight">${insight}</p>
      <div class="food-compare-ingredients">${renderIngredient(a)}${renderIngredient(b)}</div></div>`;
  }

  function renderIngredient(feed) {
    const index = getFeedIndex(feed);
    return `<article class="food-compare-ingredient"><h4>${escapeHtml(getProductMarker(index))} <span>${escapeHtml(getBrand(feed))}</span></h4><dl>
      <div><dt>주 단백질원</dt><dd>${escapeHtml(feed.메인단백질 || '비교할 정보가 부족합니다')}</dd></div>
      <div><dt>겔화제 · 점증제</dt><dd>${escapeHtml(feed.겔화제 || '별도로 확인된 정보가 없습니다')}</dd></div>
      </dl><p class="food-compare-ingredient__full">${escapeHtml(feed.전성분 || '비교할 정보가 부족합니다')}</p></article>`;
  }

  function renderSimulationControl() {
    return `<div class="food-simulation-control"><label for="simulationGrams">공통 급여량</label>
      <input id="simulationGrams" class="food-simulation-input" data-simulation-grams type="number" value="100" min="1" max="1000" step="1" inputmode="decimal"><span class="food-simulation-unit">g</span></div>`;
  }

  function simulationValue(feed, grams, key) {
    if (!isPresent(grams) || !isPresent(feed?.[key])) return null;
    return grams * Number(feed[key]) / 100;
  }
  function simulationCalories(feed, grams) {
    if (!isPresent(grams) || !isPresent(feed?.final_me) || Number(feed.final_me) <= 0) return null;
    return grams * Number(feed.final_me) / 1000;
  }
  function updateSimulation() {
    const result = $('foodSimulationResult');
    if (!result || state.feeds.length !== 2) return;
    const input = $('simulationGrams');
    const value = Number(input?.value);
    const valid = input?.value !== '' && Number.isFinite(value) && value >= 1 && value <= 1000;
    input?.setAttribute('aria-invalid', valid ? 'false' : 'true');
    const grams = valid ? value : null;
    const [a, b] = state.feeds;
    const kcalA = simulationCalories(a, grams);
    const kcalB = simulationCalories(b, grams);
    const sentence = isPresent(kcalA) && isPresent(kcalB)
      ? `A 제품 ${formatNumber(grams, 0)}g은 약 ${formatNumber(kcalA, 1)}kcal, B 제품 ${formatNumber(grams, 0)}g은 약 ${formatNumber(kcalB, 1)}kcal입니다.`
      : '비교할 정보가 부족합니다.';
    result.innerHTML = `<p class="food-compare-insight${isPresent(kcalA) && isPresent(kcalB) ? '' : ' is-missing'}">${escapeHtml(sentence)}</p>
      <table class="food-compare-table"><thead><tr><th>항목</th><th>A 제품<br>${isPresent(grams) ? `${formatNumber(grams, 0)}g` : '급여량 확인 필요'}</th><th>B 제품<br>${isPresent(grams) ? `${formatNumber(grams, 0)}g` : '급여량 확인 필요'}</th></tr></thead><tbody>
        ${makeRow('섭취 열량', kcalA, kcalB, 'kcal', 1)}
        ${makeRow('단백질 섭취량', simulationValue(a, grams, '조단백'), simulationValue(b, grams, '조단백'), 'g', 1)}
        ${makeRow('지방 섭취량', simulationValue(a, grams, '조지방'), simulationValue(b, grams, '조지방'), 'g', 1)}
        ${makeRow('사료를 통한 수분', simulationValue(a, grams, '수분'), simulationValue(b, grams, '수분'), 'ml', 1)}
      </tbody></table>`;
  }

  function openSearchModal(trigger) {
    state.lastFocused = trigger || document.activeElement;
    els.modal.hidden = false;
    els.shell.inert = true;
    document.body.style.overflow = 'hidden';
    els.searchInput.value = '';
    els.searchResults.innerHTML = '';
    els.searchStatus.textContent = '제품 목록을 불러오는 중입니다.';
    searchFeeds();
    requestAnimationFrame(() => els.searchInput.focus());
  }
  function closeSearchModal() {
    els.modal.hidden = true;
    els.shell.inert = false;
    document.body.style.overflow = '';
    if (state.lastFocused && typeof state.lastFocused.focus === 'function') state.lastFocused.focus();
  }

  function handleModalKeydown(event) {
    if (els.modal.hidden) return;
    if (event.key === 'Escape') {
      closeSearchModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...els.modalDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hidden && element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function searchFeeds() {
    const queryText = els.searchInput.value.trim().slice(0, 120);
    els.searchStatus.textContent = '검색 중입니다.';
    let query = compareSb.from(getTable()).select(searchColumns)
      .or('verified.eq.true,searchable_before_review.eq.true')
      .order('제조사', { ascending: true }).order('제품명', { ascending: true }).limit(30);
    if (queryText) {
      const pattern = quotePostgrestFilterValue(`*${queryText}*`);
      query = query.or(`제품명.ilike.${pattern},제조사.ilike.${pattern}`);
    }
    const { data, error } = await query;
    if (error) {
      els.searchResults.innerHTML = '';
      els.searchStatus.textContent = `제품을 불러오지 못했습니다. ${error.message || ''}`.trim();
      return;
    }
    const currentId = state.ids[state.replaceIndex === 0 ? 1 : 0];
    const rows = (data || []).filter(feed => String(feed.id) !== String(currentId || ''));
    els.searchResults.innerHTML = rows.map(feed => `<button class="food-compare-search-result" type="button" data-compare-feed-id="${escapeHtml(feed.id)}">
      <span class="food-compare-search-result__brand">${escapeHtml(getBrand(feed))}</span><span><span class="food-compare-search-result__name">${escapeHtml(feed.제품명 || '제품명 정보 없음')}</span><span class="food-compare-search-result__meta">${escapeHtml(getTypeLabel(feed.type))} · ${escapeHtml(feed.완전식여부 || '분류 확인중')}</span></span></button>`).join('');
    els.searchStatus.textContent = rows.length ? '' : '검색 결과가 없습니다.';
  }

  async function selectSearchResult(id) {
    if (!id) return;
    if (state.replaceIndex === 0) state.ids[0] = id;
    else state.ids[1] = id;
    state.ids = state.ids.filter(Boolean).slice(0, 2);
    updateUrl();
    els.modal.hidden = true;
    els.shell.inert = false;
    document.body.style.overflow = '';
    els.content.hidden = true;
    els.status.textContent = '비교할 제품 정보를 불러오는 중입니다.';
    await loadFeeds();
  }

  async function init() {
    cacheElements();
    bindEvents();
    await loadFeeds();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
