function normalizeFeedSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[()\[\]{}\/\\,._·&+\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeFeedSearchQuery(value) {
  return [...new Set(normalizeFeedSearchText(value).split(' ').filter(Boolean))];
}

function buildFeedSearchText(feed, type) {
  const resolvedType = type || feed?.type;
  const typeTerms = resolvedType === 'dry'
    ? '건식 드라이 dry'
    : resolvedType === 'wet' ? '습식 wet 캔 파우치' : '';
  return normalizeFeedSearchText([
    feed?.제조사,
    feed?.제품명,
    feed?.메인단백질,
    feed?.완전식여부,
    typeTerms
  ].filter(Boolean).join(' '));
}

function matchesFeedSearch(feed, rawQuery, type) {
  const tokens = tokenizeFeedSearchQuery(rawQuery);
  if (!tokens.length) return true;
  const text = buildFeedSearchText(feed, type);
  return tokens.every(token => text.includes(token));
}

function feedSearchRelevance(feed, rawQuery, type) {
  const tokens = tokenizeFeedSearchQuery(rawQuery);
  const phrase = normalizeFeedSearchText(rawQuery);
  const product = normalizeFeedSearchText(feed?.제품명);
  const maker = normalizeFeedSearchText(feed?.제조사);
  const text = buildFeedSearchText(feed, type);
  let score = 0;
  if (phrase && product.includes(phrase)) score += 120;
  if (phrase && maker.includes(phrase)) score += 100;
  tokens.forEach(token => {
    if (product.includes(token)) score += 24;
    if (maker.includes(token)) score += 18;
    if (product.startsWith(token)) score += 6;
    if (maker.startsWith(token)) score += 5;
    if (text.includes(token)) score += 2;
  });
  return score;
}

function getActiveFeedTable() {
  return state.selectedPetSpecies === 'dog' ? 'dog_feeds' : 'feeds';
}

function getFeedSearchColumns() {
  return 'id,제품명,제조사,메인단백질,final_me,eb_칼슘,eb_인,수분,전성분,완전식여부,calorie_source_detail,calorie_source_url,needs_calorie_review,verified,verification_status,searchable_before_review';
}

function isProvisionalFeed(feed) {
  return feed?.verified !== true;
}

function getProvisionalBadgeHtml(feed) {
  if (!isProvisionalFeed(feed)) return '';
  return '<span class="pc-feed-review-badge">검수 전</span>';
}

async function searchFeed(type, query, listId, slotId) {
  const list = document.getElementById(listId);
  if (!list) return;

  const searchQuery = String(query || '').trim();
  if (searchQuery.length < 1) {
    list.classList.add('hidden');
    return;
  }

  try {
    await ensureFeedPickerFeeds(type);
  } catch (error) {
    list.innerHTML = `<div class="p-3 text-red-400 text-xs">${escapeFeedPickerHtml(error.message)}</div>`;
    list.classList.remove('hidden');
    return;
  }

  if (feedPickerState.error[type]) {
    list.innerHTML = `<div class="p-3 text-red-400 text-xs">${escapeFeedPickerHtml(feedPickerState.error[type].message || '검색 결과를 불러오지 못했습니다.')}</div>`;
    list.classList.remove('hidden');
    return;
  }

  let data = (feedPickerState.cache[type] || [])
    .filter(feed => matchesFeedSearch(feed, searchQuery, type))
    .sort((a, b) =>
      feedSearchRelevance(b, searchQuery, type) - feedSearchRelevance(a, searchQuery, type)
      || compareFeedText(a.제조사, b.제조사)
      || compareFeedText(a.제품명, b.제품명)
    );

  if (!data?.length) {
    list.innerHTML = `
      <div class="p-4 text-gray-400 text-xs text-center">
        검색 결과가 없습니다.<br>
        아래의 제품명 등록을 이용해 주세요.
      </div>`;
    list.classList.remove('hidden');
    return;
  }

  list.innerHTML = data.map((feed, rowIdx) => {
    const display = feed.제조사 ? `${feed.제조사} | ${feed.제품명}` : feed.제품명;
    return `
      <button type="button" class="autocomplete-item w-full p-4 border-b border-gray-50 text-left" data-row="${rowIdx}">
        <span class="pc-feed-result-title">
          <span>${escapeFeedPickerHtml(display)}</span>
          ${getProvisionalBadgeHtml(feed)}
        </span>
        <span class="block text-xs text-gray-400 mt-1">
          ${escapeFeedPickerHtml(feed.final_me)} kcal/kg${feed.수분 != null ? ` · 수분 ${escapeFeedPickerHtml(feed.수분)}%` : ''}
        </span>
      </button>`;
  }).join('');

  list._cache = { data, type, slotId, listId };
  list.classList.remove('hidden');
  list.onclick = event => {
    const item = event.target.closest('[data-row]');
    if (!item) return;
    const cache = list._cache;
    const feedData = cache?.data?.[Number(item.dataset.row)];
    if (feedData) selectFeed(cache.type, cache.slotId, feedData, cache.listId);
  };
}

function selectFeed(type, slotId, feedData, listId) {
  const existing = type === 'dry'
    ? state.dryFeeds.some((item, index) => index !== slotId && item?.id === feedData.id)
    : Object.entries(state.wetFeedMap).some(([id, item]) => Number(id) !== Number(slotId) && item?.id === feedData.id);
  if (existing) {
    const message = type === 'dry'
      ? '이미 선택한 건사료입니다. 다른 제품을 선택해 주세요.'
      : '이미 선택한 습식사료입니다. 다른 제품을 선택해 주세요.';
    showCalculatorError(type === 'dry' ? 'dryFeedError' : 'wetFeedError', message, type === 'dry' ? `dryInput${slotId + 1}` : `wetInput_${slotId}`);
    return false;
  }
  const provisional = isProvisionalFeed(feedData);
  const feed = {
    id: feedData.id,
    name: feedData.제품명,
    display: feedData.제조사 ? `${feedData.제조사} | ${feedData.제품명}` : feedData.제품명,
    kcal: feedData.final_me,
    ebCa: feedData.eb_칼슘 || 0,
    ebP: feedData.eb_인 || 0,
    moisture: feedData.수분 ?? null,
    ingredients: feedData.전성분 || '',
    complete: feedData.완전식여부 || '',
    lifeStage: `${feedData.제품명 || ''} ${feedData.전성분 || ''}`,
    estimatedCalories: /추정|계산|estimated|calculated/i.test(feedData.calorie_source_detail || '') && !feedData.calorie_source_url,
    needsCalorieReview: feedData.needs_calorie_review === true,
    provisional,
    verificationStatus: feedData.verification_status || (provisional ? 'pending_review' : 'approved')
  };
  const suffix = provisional ? ' · 검수 전' : '';

  if (type === 'dry') {
    state.dryFeeds[slotId] = feed;
    const input = document.getElementById(`dryInput${slotId + 1}`);
    if (input) input.value = feed.display;
    const selected = document.getElementById(`drySelected${slotId + 1}`);
    if (selected) {
      selected.textContent = `✓ ${feed.name} (${feed.kcal} kcal/kg)${suffix}`;
      selected.classList.toggle('pc-selected-feed--provisional', provisional);
      selected.classList.remove('hidden');
    }
  } else {
    state.wetFeedMap[slotId] = feed;
    const input = document.getElementById(`wetInput_${slotId}`);
    if (input) input.value = feed.display;
    const selected = document.getElementById(`wetSelected_${slotId}`);
    if (selected) {
      selected.textContent = `✓ ${feed.name} (${feed.kcal} kcal/kg)${suffix}`;
      selected.classList.toggle('pc-selected-feed--provisional', provisional);
      selected.classList.remove('hidden');
    }
  }

  document.getElementById(listId)?.classList.add('hidden');
  markCalculationDirty();
  return true;
}

document.addEventListener('click', event => {
  if (!event.target.closest('.relative')) {
    document.querySelectorAll('[id^="dryList"],[id*="wetList_"]')
      .forEach(element => element.classList.add('hidden'));
  }
});

const feedPickerState = {
  type: null,
  slotId: null,
  nameFilter: '',
  sortBy: 'manufacturer',
  cache: { dry: null, wet: null },
  loading: { dry: false, wet: false },
  error: { dry: null, wet: null },
  requests: { dry: null, wet: null }
};

function resetFeedSearchForSpecies() {
  state.dryFeeds = [null, null];
  state.wetFeedMap = {};
  feedPickerState.cache = { dry: null, wet: null };
  feedPickerState.requests = { dry: null, wet: null };
  feedPickerState.error = { dry: null, wet: null };

  document.querySelectorAll('[id^="dryInput"], [id^="wetInput_"]').forEach(input => {
    input.value = '';
  });
  document.querySelectorAll('[id^="drySelected"], [id^="wetSelected_"]').forEach(item => {
    item.textContent = '';
    item.classList.remove('pc-selected-feed--provisional');
    item.classList.add('hidden');
  });
  if (typeof resetRecentFeedButtons === 'function') resetRecentFeedButtons();
  if (typeof markCalculationDirty === 'function') markCalculationDirty();
}

function escapeFeedPickerHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFeedPickerMainProtein(feed) {
  const value = String(feed?.메인단백질 ?? '').trim();
  return value || '정보 없음';
}

function compareFeedText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ko');
}

function setFeedPickerBodyScrollLock(isLocked) {
  document.body.style.overflow = isLocked ? 'hidden' : '';
}

function openFeedPicker(type, slotId) {
  feedPickerState.nameFilter = '';
  feedPickerState.type = type;
  feedPickerState.slotId = slotId;
  feedPickerState.error[type] = null;

  const modal = document.getElementById('feedPickerModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }
  setFeedPickerBodyScrollLock(true);
  renderFeedPicker();
  ensureFeedPickerFeeds(type);
}

function closeFeedPicker() {
  const modal = document.getElementById('feedPickerModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  setFeedPickerBodyScrollLock(false);
}

async function fetchAllSearchableFeeds(type) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from(getActiveFeedTable())
      .select(getFeedSearchColumns())
      .eq('type', type)
      .or('verified.eq.true,searchable_before_review.eq.true')
      .gt('final_me', 0)
      .order('제조사')
      .order('제품명')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchFeedPickerFeeds(type) {
  return fetchAllSearchableFeeds(type);
}

async function ensureFeedPickerFeeds(type) {
  if (feedPickerState.cache[type] !== null) {
    if (feedPickerState.type === type) renderFeedPicker();
    return;
  }

  if (feedPickerState.requests[type]) {
    await feedPickerState.requests[type];
    if (feedPickerState.type === type) renderFeedPicker();
    return;
  }

  feedPickerState.loading[type] = true;
  feedPickerState.error[type] = null;
  if (feedPickerState.type === type) renderFeedPicker();

  feedPickerState.requests[type] = fetchFeedPickerFeeds(type)
    .then(data => {
      feedPickerState.cache[type] = data;
    })
    .catch(error => {
      feedPickerState.error[type] = error;
    })
    .finally(() => {
      feedPickerState.loading[type] = false;
      feedPickerState.requests[type] = null;
      if (feedPickerState.type === type) renderFeedPicker();
    });

  await feedPickerState.requests[type];
}

function setFeedPickerSort(sortBy) {
  feedPickerState.sortBy = sortBy === 'product' ? 'product' : 'manufacturer';
  renderFeedPicker();
}

function getSortedFeedPickerFeeds() {
  const filter = feedPickerState.nameFilter.trim();
  const feeds = (feedPickerState.cache[feedPickerState.type] || []).filter(feed =>
    !filter || matchesFeedSearch(feed, filter, feedPickerState.type)
  );
  const sorted = feeds.slice();

  if (feedPickerState.sortBy === 'product') {
    return sorted.sort((a, b) => compareFeedText(a.제품명, b.제품명));
  }

  return sorted.sort((a, b) => {
    const manufacturerOrder = compareFeedText(a.제조사, b.제조사);
    return manufacturerOrder !== 0 ? manufacturerOrder : compareFeedText(a.제품명, b.제품명);
  });
}

window.getActiveFeedTable = getActiveFeedTable;
window.resetFeedSearchForSpecies = resetFeedSearchForSpecies;

function renderFeedPickerSortButtons() {
  const manufacturerButton = document.getElementById('feedPickerSortManufacturer');
  const productButton = document.getElementById('feedPickerSortProduct');
  if (!manufacturerButton || !productButton) return;

  const activeClass = 'py-3 rounded-2xl text-sm font-black bg-[#2F6FED] text-white';
  const inactiveClass = 'py-3 rounded-2xl text-sm font-black bg-gray-100 text-gray-400';
  manufacturerButton.className = feedPickerState.sortBy === 'manufacturer' ? activeClass : inactiveClass;
  productButton.className = feedPickerState.sortBy === 'product' ? activeClass : inactiveClass;
}

function renderFeedPicker() {
  const title = document.getElementById('feedPickerTitle');
  const status = document.getElementById('feedPickerStatus');
  const list = document.getElementById('feedPickerList');
  if (!title || !status || !list) return;

  const type = feedPickerState.type;
  const isLoading = feedPickerState.loading[type];
  const error = feedPickerState.error[type];
  title.textContent = type === 'wet' ? '습식사료 제품 목록' : '건사료 제품 목록';
  renderFeedPickerSortButtons();

  if (isLoading) {
    status.textContent = '제품 목록을 불러오는 중이에요...';
    status.className = 'py-4 text-center text-sm font-bold text-gray-400';
    list.innerHTML = '';
    return;
  }

  if (error) {
    status.textContent = `제품 목록을 불러오지 못했어요. ${error.message || ''}`.trim();
    status.className = 'py-4 text-center text-sm font-bold text-red-400';
    list.innerHTML = '';
    return;
  }

  const feeds = getSortedFeedPickerFeeds();
  if (!feeds.length && feedPickerState.cache[type] !== null) {
    status.textContent = '표시할 제품이 없습니다.';
    status.className = 'py-4 text-center text-sm font-bold text-gray-400';
    list.innerHTML = '';
    return;
  }

  status.className = 'hidden';
  status.textContent = '';
  list.innerHTML = feeds.map((feed, index) => `
    <button type="button" onclick="selectFeedFromPicker(${index})"
      class="w-full min-h-[72px] text-left p-4 bg-gray-50 border border-gray-100 rounded-2xl active:bg-blue-50">
      <span class="pc-feed-result-title">
        <span class="text-xs font-black text-gray-400">${escapeFeedPickerHtml(feed.제조사 || '제조사 정보 없음')}</span>
        ${getProvisionalBadgeHtml(feed)}
      </span>
      <span class="block text-base font-black text-gray-800 mt-1 leading-snug">${escapeFeedPickerHtml(feed.제품명 || '제품명 정보 없음')}</span>
      <span class="inline-block mt-2 px-2.5 py-1 bg-white rounded-full text-[11px] font-black text-blue-400 border border-blue-50">
        ${escapeFeedPickerHtml(getFeedPickerMainProtein(feed))}
      </span>
    </button>
  `).join('');
}

function selectFeedFromPicker(index) {
  const feedData = getSortedFeedPickerFeeds()[index];
  if (!feedData) return;
  if (selectFeed(feedPickerState.type, feedPickerState.slotId, feedData, null)) closeFeedPicker();
}

window.openFeedPicker = openFeedPicker;
window.closeFeedPicker = closeFeedPicker;
window.setFeedPickerSort = setFeedPickerSort;
window.selectFeedFromPicker = selectFeedFromPicker;
