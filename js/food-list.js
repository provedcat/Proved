(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const PAGE_SIZE = 24;
  const TAG_CATEGORY_ORDER = [
    'protein_source', 'life_stage', 'management_purpose', 'processing_method',
    'ingredient_condition', 'preparation_type'
  ];
  const TAG_CATEGORY_LABELS = {
    protein_source: '주 단백질원',
    life_stage: '생애주기',
    management_purpose: '영양 관리',
    processing_method: '제조 방식',
    ingredient_condition: '원재료 조건',
    preparation_type: '급여 형태'
  };

  const foodSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const state = {
    species: 'cat',
    type: 'all',
    role: 'all',
    sort: 'brand',
    query: '',
    total: 0,
    rows: [],
    loading: false,
    requestSerial: 0,
    tags: [],
    selectedTagIds: [],
    activeTagCategory: '',
    matchingFeedIds: null,
    tagsLoading: false
  };

  const listColumns = [
    'id', 'type', '제조사', '제품명', '완전식여부', '메인단백질',
    'final_me', 'ca_p_ratio', 'verified', 'verification_status',
    'searchable_before_review', 'brand_id', 'brands(name,official_url)'
  ].join(',');

  const detailColumns = [
    'id', 'type', '제조사', '원산지', '제품명', '완전식여부', '메인단백질', '전성분',
    '조단백', '조지방', '조회분', '조섬유', '수분', '칼슘', '인', 'ca_p_ratio',
    'dm_단백', 'dm_지방', 'dm_회분', 'dm_섬유', 'dm_칼슘', 'dm_인', '겔화제',
    'final_me', 'cal_unit', 'cal_source', 'eb_단백', 'eb_지방', 'eb_탄수화물',
    'eb_칼슘', 'eb_인', 'verified', 'verification_status', 'searchable_before_review',
    'calorie_confidence', 'calorie_note', 'needs_calorie_review', 'brand_id',
    'brands(name,official_url)'
  ].join(',');

  const els = {};
  let searchTimer = null;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeEnum(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function quotePostgrestFilterValue(value) {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  function buildSearchPattern(query) {
    return quotePostgrestFilterValue(`*${query}*`);
  }

  function getTable() {
    return state.species === 'dog' ? 'dog_feeds' : 'feeds';
  }

  function getSpeciesLabel(species = state.species) {
    return species === 'dog' ? '강아지' : '고양이';
  }

  function getTypeLabel(type) {
    return type === 'wet' ? '습식사료' : type === 'dry' ? '건사료' : '형태 확인중';
  }

  function getFeedSemanticClass(feed) {
    const type = feed?.type === 'wet' ? 'wet' : feed?.type === 'dry' ? 'dry' : '';
    return type ? `is-${state.species}-${type}` : '';
  }

  function getRoleLabel(role) {
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

  function formatKcal(value) {
    if (!isPresent(value)) return '—';
    return `${formatNumber(value, 1)} kcal/kg`;
  }

  function formatPercent(value, maxFraction = 2) {
    if (!isPresent(value)) return '—';
    return `${formatNumber(value, maxFraction)}%`;
  }

  function formatRatio(value) {
    if (!isPresent(value) || Number(value) <= 0) return '—';
    return `${formatNumber(value, 2)} : 1`;
  }

  function safeHttpUrl(value) {
    const text = String(value || '').trim();
    return /^https?:\/\//i.test(text) ? text : null;
  }

  function getBrand(feed) {
    const relation = Array.isArray(feed?.brands) ? feed.brands[0] : feed?.brands;
    return {
      name: relation?.name || feed?.제조사 || '브랜드 정보 없음',
      officialUrl: safeHttpUrl(relation?.official_url)
    };
  }

  function splitProductName(name) {
    const text = String(name || '').trim();
    const match = text.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
    if (!match) return { primary: text || '제품명 정보 없음', secondary: '' };
    return { primary: match[1].trim(), secondary: match[2].trim() };
  }

  function isProvisional(feed) {
    return feed?.verified !== true;
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.species = normalizeEnum(params.get('species'), ['cat', 'dog'], 'cat');
    state.type = normalizeEnum(params.get('type'), ['all', 'dry', 'wet'], 'all');
    state.role = normalizeEnum(params.get('role'), ['all', '주식', '보조식'], 'all');
    state.sort = normalizeEnum(params.get('sort'), ['brand', 'product'], 'brand');
    state.query = String(params.get('q') || '').trim().slice(0, 120);
    state.selectedTagIds = [...new Set(String(params.get('tags') || '').split(',').filter(Boolean))].slice(0, 20);
  }

  function writeListStateToUrl(replace = true) {
    const params = new URLSearchParams();
    if (state.species !== 'cat') params.set('species', state.species);
    if (state.type !== 'all') params.set('type', state.type);
    if (state.role !== 'all') params.set('role', state.role);
    if (state.sort !== 'brand') params.set('sort', state.sort);
    if (state.query) params.set('q', state.query);
    if (state.selectedTagIds.length) params.set('tags', state.selectedTagIds.join(','));
    const queryString = params.toString();
    const url = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
  }

  function removeTagsFromCurrentUrl() {
    const params = new URLSearchParams(window.location.search);
    params.delete('tags');
    const queryString = params.toString();
    history.replaceState({}, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}`);
  }

  function writeDetailUrl(id) {
    const params = new URLSearchParams();
    params.set('species', state.species);
    params.set('id', id);
    if (state.type !== 'all') params.set('type', state.type);
    if (state.role !== 'all') params.set('role', state.role);
    if (state.sort !== 'brand') params.set('sort', state.sort);
    if (state.query) params.set('q', state.query);
    if (state.selectedTagIds.length) params.set('tags', state.selectedTagIds.join(','));
    history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
  }

  function cacheElements() {
    els.listView = $('foodListView');
    els.detailView = $('foodDetailView');
    els.searchInput = $('foodSearchInput');
    els.searchClear = $('foodSearchClear');
    els.speciesFilters = $('foodSpeciesFilters');
    els.typeFilters = $('foodTypeFilters');
    els.roleFilters = $('foodRoleFilters');
    els.sortSelect = $('foodSortSelect');
    els.results = $('foodResults');
    els.resultsCount = $('foodResultsHeading');
    els.listStatus = $('foodListStatus');
    els.loadMore = $('foodLoadMore');
    els.back = $('foodBackToList');
    els.detailContent = $('foodDetailContent');
    els.detailStatus = $('foodDetailStatus');
    els.conditionFolders = $('foodConditionFolders');
    els.conditionPanel = $('foodConditionPanel');
    els.selectedConditions = $('foodSelectedConditions');
    els.conditionStatus = $('foodConditionStatus');
    els.conditionReset = $('foodConditionReset');
  }

  function syncControls() {
    els.searchInput.value = state.query;
    els.searchClear.hidden = !state.query;
    els.sortSelect.value = state.sort;
    renderConditionFinder();
    document.querySelectorAll('[data-species]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.species === state.species));
    });
    document.querySelectorAll('[data-type]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.type === state.type));
    });
    document.querySelectorAll('[data-role]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.role === state.role));
    });
  }

  function bindEvents() {
    els.searchInput.addEventListener('input', () => {
      state.query = els.searchInput.value.trim().slice(0, 120);
      els.searchClear.hidden = !state.query;
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        writeListStateToUrl(true);
        loadFeeds(true);
      }, 280);
    });

    els.searchClear.addEventListener('click', () => {
      clearTimeout(searchTimer);
      state.query = '';
      els.searchInput.value = '';
      els.searchClear.hidden = true;
      writeListStateToUrl(true);
      loadFeeds(true);
      els.searchInput.focus();
    });

    els.speciesFilters.addEventListener('click', event => {
      const button = event.target.closest('[data-species]');
      if (!button || button.dataset.species === state.species) return;
      state.species = button.dataset.species;
      syncControls();
      writeListStateToUrl(true);
      loadFeeds(true);
    });

    els.typeFilters.addEventListener('click', event => {
      const button = event.target.closest('[data-type]');
      if (!button || button.dataset.type === state.type) return;
      state.type = button.dataset.type;
      syncControls();
      writeListStateToUrl(true);
      loadFeeds(true);
    });

    els.roleFilters.addEventListener('click', event => {
      const button = event.target.closest('[data-role]');
      if (!button || button.dataset.role === state.role) return;
      state.role = button.dataset.role;
      syncControls();
      writeListStateToUrl(true);
      loadFeeds(true);
    });

    els.sortSelect.addEventListener('change', () => {
      state.sort = normalizeEnum(els.sortSelect.value, ['brand', 'product'], 'brand');
      writeListStateToUrl(true);
      loadFeeds(true);
    });

    els.conditionFolders.addEventListener('click', event => {
      const button = event.target.closest('[data-tag-category]');
      if (!button) return;
      state.activeTagCategory = state.activeTagCategory === button.dataset.tagCategory ? '' : button.dataset.tagCategory;
      renderConditionFinder();
    });

    els.conditionPanel.addEventListener('click', event => {
      const button = event.target.closest('[data-tag-id]');
      if (!button) return;
      toggleTag(button.dataset.tagId);
    });

    els.selectedConditions.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-tag-id]');
      if (button) toggleTag(button.dataset.removeTagId);
    });

    els.conditionReset.addEventListener('click', () => {
      state.selectedTagIds = [];
      state.matchingFeedIds = null;
      renderConditionFinder();
      writeListStateToUrl(true);
      loadFeeds(true);
    });

    els.results.addEventListener('click', event => {
      const button = event.target.closest('[data-feed-id]');
      if (!button) return;
      openDetail(button.dataset.feedId);
    });

    els.loadMore.addEventListener('click', () => loadFeeds(false));
    els.back.addEventListener('click', () => showList(false));

    window.addEventListener('popstate', () => {
      readStateFromUrl();
      syncControls();
      const id = new URLSearchParams(window.location.search).get('id');
      if (id) loadDetail(id);
      else showList(true);
    });
  }

  function renderSkeletons() {
    els.results.innerHTML = Array.from({ length: 5 }, () => '<div class="food-skeleton" aria-hidden="true"></div>').join('');
  }

  function compareTags(a, b) {
    const orderA = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 9999;
    const orderB = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 9999;
    return orderA - orderB || String(a.label_ko).localeCompare(String(b.label_ko), 'ko');
  }

  async function loadConditionTags() {
    state.tagsLoading = true;
    els.conditionStatus.textContent = '조건을 불러오는 중입니다.';
    const { data, error } = await foodSb
      .from('food_tags')
      .select('id,label_ko,category,sort_order,is_active')
      .eq('is_active', true)
      .in('category', TAG_CATEGORY_ORDER)
      .order('sort_order', { ascending: true });

    state.tagsLoading = false;
    if (error) {
      if (state.selectedTagIds.length) {
        state.selectedTagIds = [];
        state.matchingFeedIds = null;
        removeTagsFromCurrentUrl();
      }
      els.conditionStatus.textContent = '조건을 불러오지 못했습니다.';
      renderConditionFinder();
      return;
    }

    state.tags = (data || []).filter(tag => tag.id && tag.label_ko && TAG_CATEGORY_LABELS[tag.category]);
    const availableIds = new Set(state.tags.map(tag => String(tag.id)));
    state.selectedTagIds = state.selectedTagIds.filter(id => availableIds.has(String(id)));
    els.conditionStatus.textContent = '';
    renderConditionFinder();
  }

  function renderConditionFinder() {
    if (!els.conditionFolders) return;
    const categories = TAG_CATEGORY_ORDER.filter(category => state.tags.some(tag => tag.category === category));
    if (!categories.length) {
      els.conditionFolders.innerHTML = state.tagsLoading ? '' : '<p class="food-condition-empty">사용 가능한 조건이 아직 없습니다.</p>';
      els.conditionPanel.hidden = true;
      els.selectedConditions.hidden = true;
      els.conditionReset.hidden = true;
      return;
    }

    const orderedCategories = state.activeTagCategory
      ? [state.activeTagCategory, ...categories.filter(category => category !== state.activeTagCategory)]
      : categories;
    els.conditionFolders.innerHTML = orderedCategories.map((category, index) => {
      const count = state.selectedTagIds.filter(id => state.tags.find(tag => String(tag.id) === id)?.category === category).length;
      const active = category === state.activeTagCategory;
      return `<button class="food-condition-folder${active ? ' is-open' : ''}" type="button" data-tag-category="${escapeHtml(category)}" aria-expanded="${active}" style="--folder-index:${index}">
        <span>${escapeHtml(TAG_CATEGORY_LABELS[category])}</span>${count ? `<b>${count}</b>` : ''}
      </button>`;
    }).join('');

    const activeTags = state.tags.filter(tag => tag.category === state.activeTagCategory).sort(compareTags);
    els.conditionPanel.hidden = !activeTags.length;
    els.conditionPanel.innerHTML = activeTags.length ? `
      <div class="food-condition-panel__heading"><strong>${escapeHtml(TAG_CATEGORY_LABELS[state.activeTagCategory])}</strong><span>여러 조건을 함께 선택할 수 있어요.</span></div>
      <div class="food-condition-tags">${activeTags.map(tag => {
        const selected = state.selectedTagIds.includes(String(tag.id));
        return `<button type="button" data-tag-id="${escapeHtml(tag.id)}" aria-pressed="${selected}">${escapeHtml(tag.label_ko)}${selected ? '<span aria-hidden="true">✓</span>' : ''}</button>`;
      }).join('')}</div>` : '';

    const selectedTags = state.selectedTagIds.map(id => state.tags.find(tag => String(tag.id) === id)).filter(Boolean);
    els.selectedConditions.hidden = !selectedTags.length;
    els.conditionReset.hidden = !selectedTags.length;
    els.selectedConditions.innerHTML = selectedTags.length ? `
      <p><strong>선택한 조건</strong><span>${selectedTags.length}개 조건의 교집합</span></p>
      <div>${selectedTags.map(tag => `<button type="button" data-remove-tag-id="${escapeHtml(tag.id)}">${escapeHtml(tag.label_ko)}<span aria-hidden="true">×</span></button>`).join('')}</div>` : '';
  }

  function toggleTag(tagId) {
    const id = String(tagId || '');
    if (!state.tags.some(tag => String(tag.id) === id)) return;
    state.selectedTagIds = state.selectedTagIds.includes(id)
      ? state.selectedTagIds.filter(value => value !== id)
      : [...state.selectedTagIds, id];
    state.matchingFeedIds = null;
    renderConditionFinder();
    writeListStateToUrl(true);
    loadFeeds(true);
  }

  async function resolveMatchingFeedIds() {
    if (!state.selectedTagIds.length) return null;
    const mappingTable = state.species === 'dog' ? 'dog_feed_food_tags' : 'feed_food_tags';
    const feedIdColumn = state.species === 'dog' ? 'dog_feed_id' : 'feed_id';
    const PAGE_LIMIT = 1000;
    const data = [];
    for (let from = 0; ; from += PAGE_LIMIT) {
      const { data: page, error } = await foodSb
        .from(mappingTable)
        .select(`${feedIdColumn},tag_id`)
        .in('tag_id', state.selectedTagIds)
        .order('tag_id', { ascending: true })
        .order(feedIdColumn, { ascending: true })
        .range(from, from + PAGE_LIMIT - 1);
      if (error) throw error;
      data.push(...(page || []));
      if (!page || page.length < PAGE_LIMIT) break;
    }

    const required = new Set(state.selectedTagIds);
    const matchesByFeed = new Map();
    data.forEach(row => {
      const feedId = String(row[feedIdColumn] || '');
      const tagId = String(row.tag_id || '');
      if (!feedId || !required.has(tagId)) return;
      if (!matchesByFeed.has(feedId)) matchesByFeed.set(feedId, new Set());
      matchesByFeed.get(feedId).add(tagId);
    });
    return [...matchesByFeed.entries()]
      .filter(([, ids]) => ids.size === required.size)
      .map(([feedId]) => feedId);
  }

  function buildListQuery(from, to) {
    let query = foodSb
      .from(getTable())
      .select(listColumns, { count: 'exact' })
      .or('verified.eq.true,searchable_before_review.eq.true');

    if (state.type !== 'all') query = query.eq('type', state.type);
    if (state.role !== 'all') query = query.eq('완전식여부', state.role);
    if (state.query) {
      const pattern = buildSearchPattern(state.query);
      query = query.or(`제품명.ilike.${pattern},제조사.ilike.${pattern}`);
    }
    if (Array.isArray(state.matchingFeedIds)) {
      query = state.matchingFeedIds.length ? query.in('id', state.matchingFeedIds) : query.eq('id', '00000000-0000-0000-0000-000000000000');
    }

    if (state.sort === 'product') {
      query = query.order('제품명', { ascending: true }).order('제조사', { ascending: true });
    } else {
      query = query.order('제조사', { ascending: true }).order('제품명', { ascending: true });
    }

    return query.range(from, to);
  }

  async function loadFeeds(reset) {
    if (state.loading && !reset) return;
    const serial = ++state.requestSerial;
    state.loading = true;
    els.listStatus.textContent = '';
    els.loadMore.hidden = true;

    if (reset) {
      state.rows = [];
      state.total = 0;
      renderSkeletons();
      els.resultsCount.textContent = `${getSpeciesLabel()} 사료를 불러오는 중입니다.`;
    } else {
      els.loadMore.textContent = '불러오는 중…';
      els.loadMore.hidden = false;
      els.loadMore.disabled = true;
    }

    if (reset) {
      try {
        const matchingFeedIds = await resolveMatchingFeedIds();
        if (serial !== state.requestSerial) return;
        state.matchingFeedIds = matchingFeedIds;
      } catch (error) {
        if (serial !== state.requestSerial) return;
        state.loading = false;
        els.results.innerHTML = '';
        els.resultsCount.textContent = '사료 목록';
        els.listStatus.textContent = `조건 검색을 완료하지 못했습니다. ${error.message || ''}`.trim();
        return;
      }
    }

    const from = reset ? 0 : state.rows.length;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await buildListQuery(from, to);

    if (serial !== state.requestSerial) return;
    state.loading = false;
    els.loadMore.disabled = false;
    els.loadMore.textContent = '더 보기';

    if (error) {
      if (reset) els.results.innerHTML = '';
      els.listStatus.textContent = `사료 목록을 불러오지 못했습니다. ${error.message || ''}`.trim();
      els.resultsCount.textContent = '사료 목록';
      return;
    }

    state.rows = reset ? (data || []) : state.rows.concat(data || []);
    state.total = Number(count) || 0;
    renderResults();
  }

  function renderResults() {
    const species = getSpeciesLabel();
    const searchSuffix = state.query ? ` · “${state.query}” 검색` : '';
    const conditionSuffix = state.selectedTagIds.length ? ` · 조건 ${state.selectedTagIds.length}개` : '';
    els.resultsCount.textContent = `${formatNumber(state.total, 0)}개의 ${species} 사료${searchSuffix}${conditionSuffix}`;

    if (!state.rows.length) {
      els.results.innerHTML = `
        <div class="food-empty">
          <strong>검색 결과가 없습니다.</strong>
          <span>${state.selectedTagIds.length ? '선택한 조건을 하나씩 줄여보세요.' : '브랜드 또는 제품명을 바꿔 검색해 보세요.'}</span>
        </div>`;
      els.loadMore.hidden = true;
      return;
    }

    els.results.innerHTML = state.rows.map(renderResultRow).join('');
    els.loadMore.hidden = state.rows.length >= state.total;
  }

  function renderResultRow(feed) {
    const brand = getBrand(feed);
    const product = splitProductName(feed.제품명);
    const meta = [getTypeLabel(feed.type), getRoleLabel(feed.완전식여부), feed.메인단백질 || '주 단백질 확인중'];
    const semanticClass = getFeedSemanticClass(feed);
    return `
      <button class="food-result" type="button" data-feed-id="${escapeHtml(feed.id)}" aria-label="${escapeHtml(brand.name)} ${escapeHtml(product.primary)} 상세 보기">
        <span class="food-result__brand">${escapeHtml(brand.name)}</span>
        <span class="food-result__title-wrap">
          <span class="food-result__title">${escapeHtml(product.primary)}${isProvisional(feed) ? '<span class="food-review-badge">검수 전</span>' : ''}</span>
          ${product.secondary ? `<span class="food-result__secondary-title">${escapeHtml(product.secondary)}</span>` : ''}
          <span class="food-result__meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</span>
        </span>
        <span class="food-result__stats">
          <span class="food-result-stat food-result-stat--energy ${semanticClass}"><span class="food-result-stat__label">열량</span><span class="food-result-stat__value">${escapeHtml(formatKcal(feed.final_me))}</span></span>
          <span class="food-result-stat"><span class="food-result-stat__label">Ca:P</span><span class="food-result-stat__value">${escapeHtml(formatRatio(feed.ca_p_ratio))}</span></span>
          <svg class="food-result__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>
        </span>
      </button>`;
  }

  async function openDetail(id) {
    if (!id) return;
    writeDetailUrl(id);
    await loadDetail(id);
  }

  async function loadDetail(id) {
    els.listView.hidden = true;
    els.detailView.hidden = false;
    els.detailContent.innerHTML = '';
    els.detailStatus.textContent = '제품 정보를 불러오는 중입니다.';
    window.scrollTo({ top: 0, behavior: 'auto' });

    const { data, error } = await foodSb
      .from(getTable())
      .select(detailColumns)
      .eq('id', id)
      .or('verified.eq.true,searchable_before_review.eq.true')
      .maybeSingle();

    if (error || !data) {
      els.detailStatus.textContent = error
        ? `제품 정보를 불러오지 못했습니다. ${error.message || ''}`.trim()
        : '제품 정보를 찾지 못했습니다.';
      return;
    }

    els.detailStatus.textContent = '';
    renderDetail(data);
  }

  function showList(fromPopState) {
    document.title = '고양이·강아지 사료 목록 | 프루브';
    els.detailView.hidden = true;
    els.listView.hidden = false;
    els.detailContent.innerHTML = '';
    els.detailStatus.textContent = '';

    if (!fromPopState) writeListStateToUrl(false);
    if (!state.rows.length) loadFeeds(true);
    requestAnimationFrame(() => {
      const top = els.listView.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top - 12), behavior: 'auto' });
    });
  }

  function renderDetail(feed) {
    const brand = getBrand(feed);
    const product = splitProductName(feed.제품명);
    const semanticClass = getFeedSemanticClass(feed);
    const basic = [
      ['대상', getSpeciesLabel()],
      ['형태', getTypeLabel(feed.type)],
      ['분류', getRoleLabel(feed.완전식여부)],
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

    const verificationLabel = feed.verified === true ? '검수 완료' : '검수 전';
    const calorieSourceLabel = getCalorieSourceLabel(feed.cal_source);
    const officialLink = brand.officialUrl
      ? `<a class="food-brand-link" href="${escapeHtml(brand.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(brand.name)} 공식 홈페이지 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"></path><path d="m10 14 9-9"></path><path d="M19 13v6H5V5h6"></path></svg></a>`
      : '';

    document.title = `${product.primary} | 프루브 사료 목록`;

    els.detailContent.innerHTML = `
      <article class="food-detail-article">
        <header class="food-detail-hero">
          <div class="food-detail-hero__brand-row">
            <p class="food-detail-brand">${escapeHtml(brand.name)}${isProvisional(feed) ? '<span class="food-review-badge">검수 전</span>' : ''}</p>
            ${officialLink}
          </div>
          <h1 id="foodDetailTitle">${escapeHtml(product.primary)}</h1>
          ${product.secondary ? `<p class="food-detail-hero__secondary">${escapeHtml(product.secondary)}</p>` : ''}
          <a class="food-compare-link" href="/food/compare/?species=${escapeHtml(state.species)}&ids=${encodeURIComponent(feed.id)}">
            다른 제품과 비교하기
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>
          </a>
        </header>

        <section class="food-detail-section" aria-labelledby="foodBasicHeading">
          ${sectionHeading('01', '기본 정보', 'foodBasicHeading')}
          <dl class="food-basic-grid">
            ${basic.map(([label, value]) => `<div class="food-basic-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
          </dl>
        </section>

        <section class="food-detail-section" aria-labelledby="foodMetricsHeading">
          ${sectionHeading('02', '핵심 수치', 'foodMetricsHeading')}
          <div class="food-metric-grid">
            ${metricCard('energy', '열량', formatNumber(feed.final_me, 1), 'kcal/kg', energyIcon(), semanticClass)}
            ${metricCard('moisture', '수분', formatNumber(feed.수분, 2), '%', moistureIcon())}
            ${metricCard('protein', '단백질 · DM', formatNumber(feed.dm_단백, 2), '%', proteinIcon())}
            ${metricCard('ratio', '칼슘 : 인', isPresent(feed.ca_p_ratio) ? formatNumber(feed.ca_p_ratio, 2) : '—', isPresent(feed.ca_p_ratio) ? ': 1' : '', ratioIcon())}
          </div>
        </section>

        ${nutritionRows.length ? `
        <section class="food-detail-section" aria-labelledby="foodNutritionHeading">
          ${sectionHeading('03', '영양 정보', 'foodNutritionHeading')}
          <table class="food-nutrition-table">
            <thead><tr><th scope="col">항목</th><th scope="col">등록 값</th><th scope="col">건물 기준 DM</th></tr></thead>
            <tbody>
              ${nutritionRows.map(([label, asFed, dm]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(formatPercent(asFed, label === '칼슘' || label === '인' ? 3 : 2))}</td><td>${dm === null ? '—' : escapeHtml(formatPercent(dm, label === '칼슘' || label === '인' ? 3 : 2))}</td></tr>`).join('')}
            </tbody>
          </table>
          <p class="food-table-note">DM은 수분을 제외한 건물 기준 환산값입니다. 등록 값은 데이터베이스에 저장된 수치를 그대로 표시합니다.</p>
        </section>` : ''}

        ${(isPresent(feed.칼슘) || isPresent(feed.인) || isPresent(feed.ca_p_ratio)) ? `
        <section class="food-detail-section" aria-labelledby="foodMineralHeading">
          ${sectionHeading('04', '칼슘 · 인', 'foodMineralHeading')}
          <div class="food-mineral-grid">
            ${mineralCard('Ca · 칼슘', formatPercent(feed.칼슘, 3), isPresent(feed.eb_칼슘) ? `${formatNumber(feed.eb_칼슘, 2)} g / 1,000 kcal` : '열량 기준 정보 없음')}
            ${mineralCard('P · 인', formatPercent(feed.인, 3), isPresent(feed.eb_인) ? `${formatNumber(feed.eb_인, 2)} g / 1,000 kcal` : '열량 기준 정보 없음')}
            ${mineralCard('Ca:P', formatRatio(feed.ca_p_ratio), '칼슘과 인의 등록 수치 비율')}
          </div>
        </section>` : ''}

        ${feed.전성분 ? `
        <section class="food-detail-section" aria-labelledby="foodIngredientsHeading">
          ${sectionHeading('05', '원재료', 'foodIngredientsHeading')}
          <p class="food-ingredients">${escapeHtml(feed.전성분)}</p>
          ${feed.겔화제 ? `<div class="food-additive-row"><strong>겔화제 · 점증제</strong><span>${escapeHtml(feed.겔화제)}</span></div>` : ''}
        </section>` : ''}

        <section class="food-detail-section" aria-labelledby="foodSourceHeading">
          ${sectionHeading(feed.전성분 ? '06' : '05', '정보 상태', 'foodSourceHeading')}
          <dl class="food-source-list">
            <div class="food-source-row"><dt>영양정보</dt><dd class="${feed.verified === true ? '' : 'is-review'}">${escapeHtml(verificationLabel)}</dd></div>
            <div class="food-source-row"><dt>열량</dt><dd>${escapeHtml(calorieSourceLabel)}</dd></div>
            ${feed.calorie_note ? `<div class="food-source-row"><dt>열량 메모</dt><dd>${escapeHtml(feed.calorie_note)}</dd></div>` : ''}
          </dl>
        </section>
      </article>`;
  }

  function sectionHeading(number, title, id) {
    return `<div class="food-section-heading"><span>${number}</span><h2 id="${id}">${escapeHtml(title)}</h2></div>`;
  }

  function metricCard(kind, label, value, unit, icon, modifier = '') {
    return `<div class="food-metric food-metric--${kind} ${modifier}">${icon}<div><span class="food-metric__label">${escapeHtml(label)}</span><span class="food-metric__value">${escapeHtml(value)}</span>${unit ? `<span class="food-metric__unit">${escapeHtml(unit)}</span>` : ''}</div></div>`;
  }

  function mineralCard(label, value, sub) {
    return `<div class="food-mineral-item"><p class="food-mineral-item__label">${escapeHtml(label)}</p><p class="food-mineral-item__value">${escapeHtml(value)}</p><p class="food-mineral-item__sub">${escapeHtml(sub)}</p></div>`;
  }

  function getCalorieSourceLabel(source) {
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

  function energyIcon() {
    return '<svg class="food-metric__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M26 5 13 27h10l-2 16 14-24H25z"></path></svg>';
  }

  function moistureIcon() {
    return '<svg class="food-metric__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5S11 20 11 30a13 13 0 0 0 26 0C37 20 24 5 24 5Z"></path><path d="M18 31c1 4 4 6 8 6"></path></svg>';
  }

  function proteinIcon() {
    return '<svg class="food-metric__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M10 31c0-10 8-18 18-18 7 0 12 4 12 10 0 10-10 18-21 18-6 0-9-4-9-10Z"></path><path d="M27 22c4-2 8 0 8 4 0 5-5 9-10 9-4 0-6-2-6-5 0-4 4-7 8-8Z"></path></svg>';
  }

  function ratioIcon() {
    return '<svg class="food-metric__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8v30"></path><path d="M12 15h24"></path><path d="m15 15-6 12h12z"></path><path d="m33 15-6 12h12z"></path><path d="M16 40h16"></path></svg>';
  }

  async function init() {
    cacheElements();
    readStateFromUrl();
    syncControls();
    bindEvents();

    const detailId = new URLSearchParams(window.location.search).get('id');
    const conditionTagsPromise = loadConditionTags();
    if (detailId) {
      await loadDetail(detailId);
      return;
    }
    if (state.selectedTagIds.length) await conditionTagsPromise;
    await loadFeeds(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
