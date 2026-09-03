(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const PAGE_SIZE = 24;
  const MAPPING_PAGE_SIZE = 1000;
  const CATEGORY_ORDER = ['protein_source', 'life_stage', 'management_purpose', 'processing_method', 'ingredient_condition', 'preparation_type'];
  const CATEGORY_LABELS = {
    protein_source: '주 단백질원',
    life_stage: '생애주기',
    management_purpose: '수의사의 진단을 바탕으로 처방되는 기능성 사료',
    processing_method: '제조 방식',
    ingredient_condition: '원재료 조건',
    preparation_type: '급여 형태'
  };
  const CATEGORY_TAB_LABELS = {
    protein_source: '단백질',
    life_stage: '생애',
    management_purpose: '기능',
    processing_method: '제조',
    ingredient_condition: '원재료',
    preparation_type: '급여'
  };
  const LIST_COLUMNS = [
    'id', 'type', '제조사', '제품명', '완전식여부', '메인단백질',
    'final_me', 'ca_p_ratio', 'verified', 'searchable_before_review',
    'brand_id', 'brands(name,official_url)'
  ].join(',');

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const state = {
    species: 'cat',
    tags: [],
    selectedTagIds: [],
    activeCategory: '',
    tagSearchQueries: {},
    matchingFeedIds: [],
    allRows: [],
    rows: [],
    total: 0,
    loading: false,
    requestSerial: 0
  };
  const els = {};

  function $(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatNumber(value, digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits }).format(number);
  }
  function normalizeConditionSearch(value) {
    return String(value || '').trim().toLocaleLowerCase('ko-KR');
  }
  function getSpeciesLabel() { return state.species === 'dog' ? '강아지' : '고양이'; }
  function getTable() { return state.species === 'dog' ? 'dog_feeds' : 'feeds'; }
  function getMappingConfig() {
    return state.species === 'dog'
      ? { table: 'dog_feed_food_tags', feedColumn: 'dog_feed_id' }
      : { table: 'feed_food_tags', feedColumn: 'feed_id' };
  }
  function getBrand(feed) {
    const relation = Array.isArray(feed.brands) ? feed.brands[0] : feed.brands;
    return relation?.name || feed.제조사 || '브랜드 정보 없음';
  }
  function splitProductName(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
    return match ? { primary: match[1].trim(), secondary: match[2].trim() } : { primary: text || '제품명 정보 없음', secondary: '' };
  }
  function getTypeLabel(type) { return type === 'wet' ? '습식사료' : type === 'dry' ? '건사료' : '형태 확인중'; }
  function formatKcal(value) { return Number.isFinite(Number(value)) ? `${formatNumber(value, 1)} kcal/kg` : '—'; }
  function formatRatio(value) { return Number(value) > 0 ? `${formatNumber(value, 2)} : 1` : '—'; }

  function cacheElements() {
    els.species = $('conditionSpecies');
    els.reset = $('conditionReset');
    els.folders = $('conditionFolders');
    els.selected = $('conditionSelected');
    els.status = $('conditionStatus');
    els.resultCount = $('conditionResultCount');
    els.resultGuide = $('conditionResultGuide');
    els.results = $('conditionResultList');
    els.resultStatus = $('conditionResultStatus');
    els.loadMore = $('conditionLoadMore');
  }

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    state.species = params.get('species') === 'dog' ? 'dog' : 'cat';
    state.selectedTagIds = [...new Set(String(params.get('tags') || '').split(',').filter(Boolean))].slice(0, 20);
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (state.species === 'dog') params.set('species', 'dog');
    if (state.selectedTagIds.length) params.set('tags', state.selectedTagIds.join(','));
    const query = params.toString();
    history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }

  function syncSpecies() {
    els.species.querySelectorAll('[data-species]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.species === state.species));
    });
  }

  async function loadTags() {
    const { data, error } = await sb.from('food_tags')
      .select('id,label_ko,category,sort_order,is_active')
      .eq('is_active', true)
      .in('category', CATEGORY_ORDER)
      .order('sort_order', { ascending: true });
    if (error) {
      state.selectedTagIds = [];
      writeUrl();
      els.status.textContent = '조건을 불러오지 못했습니다.';
      renderInitialResults();
      return false;
    }
    state.tags = (data || []).filter(tag => tag.id && tag.label_ko && CATEGORY_LABELS[tag.category]);
    const available = new Set(state.tags.map(tag => String(tag.id)));
    state.selectedTagIds = state.selectedTagIds.filter(id => available.has(id));
    if (!state.activeCategory) {
      state.activeCategory = CATEGORY_ORDER.find(category => state.tags.some(tag => tag.category === category)) || '';
    }
    els.status.textContent = '';
    renderFinder();
    return true;
  }

  function renderFinder() {
    const categories = CATEGORY_ORDER.filter(category => state.tags.some(tag => tag.category === category));
    els.folders.innerHTML = categories.map((category, index) => {
      const count = state.selectedTagIds.filter(id => state.tags.find(tag => String(tag.id) === id)?.category === category).length;
      const active = category === state.activeCategory;
      const tags = state.tags.filter(tag => tag.category === category);
      const query = String(state.tagSearchQueries[category] || '');
      const normalizedQuery = normalizeConditionSearch(query);
      const visibleCount = tags.filter(tag => !normalizedQuery || normalizeConditionSearch(tag.label_ko).includes(normalizedQuery)).length;
      return `<section class="condition-folder${active ? ' is-open' : ''}" style="--tab-index:${index};--layer-z:${active ? 60 : 10 + index}">
        <button class="condition-folder__tab" type="button" data-category="${category}" aria-expanded="${active}">
          <span>${CATEGORY_TAB_LABELS[category]}</span>${count ? `<b>${count}</b>` : ''}
        </button>
        <div class="condition-folder__body" ${active ? '' : 'hidden'}>
          <h2>${CATEGORY_LABELS[category]}</h2>
          <label class="condition-tag-search">
            <span class="sr-only">${CATEGORY_LABELS[category]} 조건 검색</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
            <input type="search" data-condition-search data-category="${category}" value="${escapeHtml(query)}" placeholder="조건 검색" autocomplete="off" spellcheck="false">
            <button class="condition-tag-search__clear" type="button" data-condition-search-clear data-category="${category}" ${query ? '' : 'hidden'}>지우기</button>
          </label>
          <div class="condition-tags">${tags.map(tag => {
            const selected = state.selectedTagIds.includes(String(tag.id));
            const searchText = normalizeConditionSearch(tag.label_ko);
            const hidden = normalizedQuery && !searchText.includes(normalizedQuery);
            return `<button type="button" data-tag-id="${escapeHtml(tag.id)}" data-tag-search-text="${escapeHtml(searchText)}" aria-pressed="${selected}" ${hidden ? 'hidden' : ''}>${escapeHtml(tag.label_ko)}${selected ? '<span aria-hidden="true">✓</span>' : ''}</button>`;
          }).join('')}<p class="condition-tags-empty" ${visibleCount ? 'hidden' : ''}>일치하는 조건이 없습니다.</p></div>
        </div>
      </section>`;
    }).join('');

    const selected = state.selectedTagIds.map(id => state.tags.find(tag => String(tag.id) === id)).filter(Boolean);
    els.reset.hidden = !selected.length;
    els.selected.hidden = !selected.length;
    els.selected.innerHTML = selected.length ? `<p><strong>선택한 조건</strong><span>${selected.length}개 조건의 교집합</span></p><div>${selected.map(tag => `<button type="button" data-remove-tag-id="${escapeHtml(tag.id)}">${escapeHtml(tag.label_ko)}<span aria-hidden="true">×</span></button>`).join('')}</div>` : '';
  }

  function applyConditionTagSearch(input) {
    const body = input.closest('.condition-folder__body');
    if (!body) return;
    const query = normalizeConditionSearch(input.value);
    let visibleCount = 0;
    body.querySelectorAll('[data-tag-id]').forEach(button => {
      const visible = !query || String(button.dataset.tagSearchText || '').includes(query);
      button.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    const empty = body.querySelector('.condition-tags-empty');
    if (empty) empty.hidden = visibleCount > 0;
    const clear = body.querySelector('[data-condition-search-clear]');
    if (clear) clear.hidden = !input.value;
  }

  function renderInitialResults() {
    state.rows = [];
    state.allRows = [];
    state.total = 0;
    els.resultCount.textContent = `0개의 ${getSpeciesLabel()} 사료`;
    els.resultGuide.textContent = '조건을 선택하면 검색 결과가 표시됩니다.';
    els.results.innerHTML = '<div class="condition-initial-empty">폴더를 열고 하나 이상의 조건을 선택해 주세요.</div>';
    els.resultStatus.textContent = '';
    els.loadMore.hidden = true;
  }

  async function resolveFeedIds() {
    if (!state.selectedTagIds.length) return [];
    const { table, feedColumn } = getMappingConfig();
    const rows = [];
    for (let from = 0; ; from += MAPPING_PAGE_SIZE) {
      const { data, error } = await sb.from(table)
        .select(`${feedColumn},tag_id`)
        .in('tag_id', state.selectedTagIds)
        .order('tag_id', { ascending: true })
        .order(feedColumn, { ascending: true })
        .range(from, from + MAPPING_PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < MAPPING_PAGE_SIZE) break;
    }
    const required = new Set(state.selectedTagIds);
    const byFeed = new Map();
    rows.forEach(row => {
      const feedId = String(row[feedColumn] || '');
      const tagId = String(row.tag_id || '');
      if (!feedId || !required.has(tagId)) return;
      if (!byFeed.has(feedId)) byFeed.set(feedId, new Set());
      byFeed.get(feedId).add(tagId);
    });
    return [...byFeed.entries()].filter(([, ids]) => ids.size === required.size).map(([id]) => id);
  }

  async function loadMatchingFeeds(ids) {
    const rows = [];
    const chunkSize = 100;
    for (let index = 0; index < ids.length; index += chunkSize) {
      const { data, error } = await sb.from(getTable())
        .select(LIST_COLUMNS)
        .or('verified.eq.true,searchable_before_review.eq.true')
        .in('id', ids.slice(index, index + chunkSize));
      if (error) throw error;
      rows.push(...(data || []));
    }
    return rows.sort((a, b) => {
      const brandOrder = getBrand(a).localeCompare(getBrand(b), 'ko');
      return brandOrder || String(a.제품명 || '').localeCompare(String(b.제품명 || ''), 'ko');
    });
  }

  async function loadResults(reset) {
    if (!state.selectedTagIds.length) {
      renderInitialResults();
      return;
    }
    if (state.loading && !reset) return;
    if (!reset) {
      state.rows = state.allRows.slice(0, state.rows.length + PAGE_SIZE);
      renderResults();
      return;
    }
    const serial = ++state.requestSerial;
    state.loading = true;
    els.resultStatus.textContent = '';
    els.loadMore.hidden = true;
    if (reset) {
      state.rows = [];
      state.allRows = [];
      state.total = 0;
      els.resultCount.textContent = `${getSpeciesLabel()} 사료를 찾는 중입니다.`;
      els.resultGuide.textContent = `${state.selectedTagIds.length}개 조건의 교집합을 확인하고 있어요.`;
      els.results.innerHTML = Array.from({ length: 4 }, () => '<div class="food-skeleton" aria-hidden="true"></div>').join('');
      try {
        const ids = await resolveFeedIds();
        if (serial !== state.requestSerial) return;
        state.matchingFeedIds = ids;
      } catch (error) {
        if (serial !== state.requestSerial) return;
        state.loading = false;
        els.results.innerHTML = '';
        els.resultCount.textContent = '조건 검색을 완료하지 못했습니다.';
        els.resultStatus.textContent = error.message || '잠시 후 다시 시도해 주세요.';
        return;
      }
    }
    if (!state.matchingFeedIds.length) {
      state.loading = false;
      renderResults();
      return;
    }
    try {
      const rows = await loadMatchingFeeds(state.matchingFeedIds);
      if (serial !== state.requestSerial) return;
      state.allRows = rows;
      state.rows = rows.slice(0, PAGE_SIZE);
      state.total = rows.length;
      state.loading = false;
      renderResults();
    } catch (error) {
      if (serial !== state.requestSerial) return;
      state.loading = false;
      els.results.innerHTML = '';
      els.resultStatus.textContent = error.message || '검색 결과를 불러오지 못했습니다.';
    }
  }

  function renderResults() {
    els.resultCount.textContent = `${formatNumber(state.total)}개의 ${getSpeciesLabel()} 사료`;
    els.resultGuide.textContent = `${state.selectedTagIds.length}개 조건을 모두 만족하는 결과입니다.`;
    if (!state.rows.length) {
      els.results.innerHTML = '<div class="food-empty"><strong>조건을 만족하는 사료가 없습니다.</strong><span>선택한 조건을 하나씩 줄여보세요.</span></div>';
      els.loadMore.hidden = true;
      return;
    }
    els.results.innerHTML = state.rows.map(renderRow).join('');
    els.loadMore.hidden = state.rows.length >= state.total;
  }

  function renderRow(feed) {
    const brand = getBrand(feed);
    const product = splitProductName(feed.제품명);
    const meta = [getTypeLabel(feed.type), feed.완전식여부 || '분류 확인중', feed.메인단백질 || '주 단백질 확인중'];
    return `<a class="food-result" href="/food/?species=${state.species}&id=${encodeURIComponent(feed.id)}" aria-label="${escapeHtml(brand)} ${escapeHtml(product.primary)} 상세 보기"><span class="food-result__brand">${escapeHtml(brand)}</span><span class="food-result__title-wrap"><span class="food-result__title">${escapeHtml(product.primary)}${feed.verified === true ? '' : '<span class="food-review-badge">검수 전</span>'}</span>${product.secondary ? `<span class="food-result__secondary-title">${escapeHtml(product.secondary)}</span>` : ''}<span class="food-result__meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</span></span><span class="food-result__stats"><span class="food-result-stat"><span class="food-result-stat__label">열량</span><span class="food-result-stat__value">${escapeHtml(formatKcal(feed.final_me))}</span></span><span class="food-result-stat"><span class="food-result-stat__label">Ca:P</span><span class="food-result-stat__value">${escapeHtml(formatRatio(feed.ca_p_ratio))}</span></span><svg class="food-result__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg></span></a>`;
  }

  function toggleTag(id) {
    state.selectedTagIds = state.selectedTagIds.includes(id)
      ? state.selectedTagIds.filter(value => value !== id)
      : [...state.selectedTagIds, id];
    state.matchingFeedIds = [];
    writeUrl();
    renderFinder();
    loadResults(true);
  }

  function bindEvents() {
    els.species.addEventListener('click', event => {
      const button = event.target.closest('[data-species]');
      if (!button || button.dataset.species === state.species) return;
      state.species = button.dataset.species;
      state.matchingFeedIds = [];
      syncSpecies();
      writeUrl();
      loadResults(true);
    });
    els.folders.addEventListener('input', event => {
      const input = event.target.closest('[data-condition-search]');
      if (!input) return;
      const category = String(input.dataset.category || state.activeCategory || '');
      if (category) state.tagSearchQueries[category] = input.value;
      applyConditionTagSearch(input);
    });
    els.folders.addEventListener('click', event => {
      const clearButton = event.target.closest('[data-condition-search-clear]');
      if (clearButton) {
        const body = clearButton.closest('.condition-folder__body');
        const input = body?.querySelector('[data-condition-search]');
        if (!input) return;
        input.value = '';
        const category = String(input.dataset.category || state.activeCategory || '');
        if (category) state.tagSearchQueries[category] = '';
        applyConditionTagSearch(input);
        input.focus();
        return;
      }
      const tagButton = event.target.closest('[data-tag-id]');
      if (tagButton) {
        toggleTag(String(tagButton.dataset.tagId));
        return;
      }
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.activeCategory = button.dataset.category;
      renderFinder();
    });
    els.selected.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-tag-id]');
      if (button) toggleTag(String(button.dataset.removeTagId));
    });
    els.reset.addEventListener('click', () => {
      state.selectedTagIds = [];
      state.matchingFeedIds = [];
      writeUrl();
      renderFinder();
      renderInitialResults();
    });
    els.loadMore.addEventListener('click', () => loadResults(false));
  }

  async function init() {
    cacheElements();
    readUrl();
    syncSpecies();
    bindEvents();
    renderInitialResults();
    const loaded = await loadTags();
    if (loaded && state.selectedTagIds.length) await loadResults(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
