function quotePostgrestFilterValue(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildFeedSearchPattern(query) {
  return quotePostgrestFilterValue(`*${query}*`);
}

function getActiveFeedTable() {
  return state.selectedPetSpecies === 'dog' ? 'dog_feeds' : 'feeds';
}

function getFeedSearchColumns() {
  return '제품명,제조사,메인단백질,final_me,eb_칼슘,eb_인,수분,전성분,완전식여부,verified,verification_status,searchable_before_review';
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

  const { data, error } = await sb
    .from(getActiveFeedTable())
    .select(getFeedSearchColumns())
    .eq('type', type)
    .or('verified.eq.true,searchable_before_review.eq.true')
    .gt('final_me', 0)
    .or(`제품명.ilike.${buildFeedSearchPattern(searchQuery)},제조사.ilike.${buildFeedSearchPattern(searchQuery)}`)
    .limit(10);

  if (error) {
    list.innerHTML = `<div class="p-3 text-red-400 text-xs">${escapeFeedPickerHtml(error.message)}</div>`;
    list.classList.remove('hidden');
    return;
  }

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
  const provisional = isProvisionalFeed(feedData);
  const feed = {
    name: feedData.제품명,
    display: feedData.제조사 ? `${feedData.제조사} | ${feedData.제품명}` : feedData.제품명,
    kcal: feedData.final_me,
    ebCa: feedData.eb_칼슘 || 0,
    ebP: feedData.eb_인 || 0,
    moisture: feedData.수분 ?? null,
    ingredients: feedData.전성분 || '',
    complete: feedData.완전식여부 || '',
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

async function fetchFeedPickerFeeds(type) {
  const { data, error } = await sb
    .from(getActiveFeedTable())
    .select(getFeedSearchColumns())
    .eq('type', type)
    .or('verified.eq.true,searchable_before_review.eq.true')
    .gt('final_me', 0)
    .range(0, 999);

  if (error) throw error;
  return data || [];
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
  const filter = feedPickerState.nameFilter.trim().toLocaleLowerCase('ko');
  const feeds = (feedPickerState.cache[feedPickerState.type] || []).filter(feed => {
    if (!filter) return true;
    return String(feed.제품명 || '').toLocaleLowerCase('ko').includes(filter)
      || String(feed.제조사 || '').toLocaleLowerCase('ko').includes(filter);
  });
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
  selectFeed(feedPickerState.type, feedPickerState.slotId, feedData, null);
  closeFeedPicker();
}

window.openFeedPicker = openFeedPicker;
window.closeFeedPicker = closeFeedPicker;
window.setFeedPickerSort = setFeedPickerSort;
window.selectFeedFromPicker = selectFeedFromPicker;

function setUploadType(type) {
  state.uploadType = type;
  const dryButton = document.getElementById('upDryBtn');
  const wetButton = document.getElementById('upWetBtn');
  if (!dryButton || !wetButton) return;
  dryButton.classList.toggle('is-active', type === 'dry');
  dryButton.setAttribute('aria-pressed', String(type === 'dry'));
  wetButton.classList.toggle('is-active', type === 'wet');
  wetButton.setAttribute('aria-pressed', String(type === 'wet'));
}

let selectedFeedImageFile = null;
let isUploadingFeedImage = false;
let isSubmittingTextFeed = false;

function handleUploadFileChange(input) {
  selectedFeedImageFile = input.files?.[0] || null;
  const message = document.getElementById('uploadMsg');
  if (message && selectedFeedImageFile) {
    message.innerHTML = `<p class="text-xs text-blue-400 font-bold mt-2">선택됨: ${escapeFeedPickerHtml(selectedFeedImageFile.name)}</p>`;
  }
}

async function uploadFeedImageToAppsScript() {
  const input = document.getElementById('uploadInput');
  const file = selectedFeedImageFile || input?.files?.[0];
  if (!file) {
    alert('분석할 사료 사진을 먼저 선택해주세요.');
    return;
  }

  const message = document.getElementById('uploadMsg');
  if (message) message.innerHTML = '<p class="text-xs text-blue-400 font-bold mt-2">분석 중입니다.</p>';

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result.split(',')[1]);
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'upload',
      base64Data: base64,
      mimeType: file.type,
      fileName: file.name,
      type: state.uploadType,
      species: state.selectedPetSpecies === 'dog' ? 'dog' : 'cat'
    })
  });
  const result = await parseAppsScriptResponse(response);

  if (result.성공) {
    if (message) message.innerHTML = '<p class="text-xs text-green-500 font-bold mt-2">임시 등록 완료 — 검수 전 표시로 검색할 수 있습니다.</p>';
    selectedFeedImageFile = null;
    if (input) input.value = '';
    invalidateFeedPickerCache(state.uploadType);
  } else if (message) {
    message.innerHTML = `<p class="text-xs text-orange-400 font-bold mt-2">실패: ${escapeFeedPickerHtml(result.안내 || result.오류 || '알 수 없는 오류')}</p>`;
  }
}

async function handleFeedImageUpload(event) {
  event?.preventDefault();
  if (isUploadingFeedImage) return;
  isUploadingFeedImage = true;

  const button = document.getElementById('uploadFeedBtn');
  if (button) button.disabled = true;

  try {
    await uploadFeedImageToAppsScript();
  } catch (error) {
    console.error('Feed image upload failed:', error);
    const message = document.getElementById('uploadMsg');
    if (message) message.innerHTML = '<p class="text-xs text-red-400 font-bold mt-2">네트워크 또는 분석 서버 오류가 발생했습니다.</p>';
  } finally {
    isUploadingFeedImage = false;
    if (button) button.disabled = false;
  }
}

function injectFeedRegistrationStyles() {
  if (document.getElementById('feedRegistrationStyles')) return;
  const style = document.createElement('style');
  style.id = 'feedRegistrationStyles';
  style.textContent = `
    .pc-text-feed-request { margin-top: 18px; padding: 18px; background: #f8fafc; border: 1px solid #e8edf5; border-radius: 18px; }
    .pc-text-feed-request__label { display: block; margin-bottom: 8px; color: #374151; font-size: 14px; font-weight: 800; }
    .pc-text-feed-request__input { width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid #dfe5ee; border-radius: 14px; background: #fff; color: #1f2937; font-size: 16px; outline: none; }
    .pc-text-feed-request__input:focus { border-color: #2F6FED; box-shadow: 0 0 0 3px rgba(47,111,237,.10); }
    .pc-text-feed-request__button { width: 100%; min-height: 48px; margin-top: 10px; border-radius: 14px; background: #2F6FED; color: #fff; font-size: 14px; font-weight: 900; }
    .pc-text-feed-request__button:disabled { opacity: .55; cursor: wait; }
    .pc-text-feed-request__help { margin-top: 8px; color: #7b8492; font-size: 12px; font-weight: 650; line-height: 1.55; }
    .pc-registration-divider { display: flex; align-items: center; gap: 10px; margin: 22px 0 16px; color: #9aa2ad; font-size: 11px; font-weight: 800; }
    .pc-registration-divider::before, .pc-registration-divider::after { content: ''; flex: 1; height: 1px; background: #edf0f4; }
    .pc-feed-result-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 800; font-size: 14px; color: #1f2937; }
    .pc-feed-review-badge { flex: 0 0 auto; display: inline-flex; align-items: center; min-height: 22px; padding: 2px 8px; border: 1px solid #ead9ab; border-radius: 999px; background: #fffaf0; color: #9a6a00; font-size: 10px; font-weight: 900; }
    .pc-selected-feed--provisional { color: #8a6400 !important; }
  `;
  document.head.appendChild(style);
}

function initializeTextFeedRegistration() {
  const section = document.querySelector('.pc-upload-section');
  const typeRow = section?.querySelector('.pc-upload-type-row');
  const picker = section?.querySelector('.pc-upload-picker');
  if (!section || !typeRow || !picker || document.getElementById('feedTextRequestInput')) return;

  injectFeedRegistrationStyles();
  const heading = section.querySelector('h2');
  const description = section.querySelector('.pc-upload-description');
  const note = section.querySelector('.pc-upload-note');
  if (heading) heading.textContent = '사료가 없나요?';
  if (description) description.innerHTML = '브랜드와 제품명을 입력하면 공식 자료를 찾아 임시 등록합니다.';
  if (note) note.textContent = '검수 전 제품은 검색 결과에 표시되며, 최종 승인 후 표시가 사라집니다.';

  const requestBox = document.createElement('div');
  requestBox.className = 'pc-text-feed-request';
  requestBox.innerHTML = `
    <label class="pc-text-feed-request__label" for="feedTextRequestInput">브랜드와 제품명</label>
    <input id="feedTextRequestInput" class="pc-text-feed-request__input" type="text" maxlength="120"
      autocomplete="off" placeholder="예: 지위픽 고등어 앤 램 캔">
    <button id="feedTextRequestBtn" type="button" class="pc-text-feed-request__button">제품명으로 등록</button>
    <p class="pc-text-feed-request__help">브랜드와 정확한 제품명을 함께 입력해주세요.<br>예: 조공 소피캣 닭</p>
    <div id="feedTextRequestMsg" aria-live="polite"></div>`;
  typeRow.insertAdjacentElement('afterend', requestBox);

  const divider = document.createElement('div');
  divider.className = 'pc-registration-divider';
  divider.textContent = '또는 라벨 사진으로 등록';
  picker.insertAdjacentElement('beforebegin', divider);

  document.getElementById('feedTextRequestBtn')?.addEventListener('click', handleTextFeedRequest);
  document.getElementById('feedTextRequestInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleTextFeedRequest();
    }
  });
}

function invalidateFeedPickerCache(type) {
  if (type !== 'dry' && type !== 'wet') return;
  feedPickerState.cache[type] = null;
  feedPickerState.error[type] = null;
  feedPickerState.requests[type] = null;
}

async function parseAppsScriptResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`분석 서버 응답을 읽지 못했습니다. HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(data.오류 || `HTTP ${response.status}`);
  return data;
}

function renderTextFeedRequestMessage(message, tone) {
  const container = document.getElementById('feedTextRequestMsg');
  if (!container) return;
  const toneClass = {
    success: 'text-green-600',
    warning: 'text-orange-500',
    error: 'text-red-500',
    info: 'text-blue-500'
  }[tone] || 'text-gray-500';
  container.innerHTML = `<p class="mt-3 text-xs font-bold leading-relaxed ${toneClass}">${escapeFeedPickerHtml(message)}</p>`;
}

async function handleTextFeedRequest() {
  if (isSubmittingTextFeed) return;
  const input = document.getElementById('feedTextRequestInput');
  const button = document.getElementById('feedTextRequestBtn');
  const query = String(input?.value || '').trim();

  const queryParts = query.split(/\s+/).filter(Boolean);
  if (queryParts.length < 2) {
    renderTextFeedRequestMessage('브랜드와 정확한 제품명을 함께 입력해주세요. 예: 조공 소피캣 닭', 'warning');
    input?.focus();
    return;
  }

  isSubmittingTextFeed = true;
  if (button) {
    button.disabled = true;
    button.textContent = '제품 정보 검색 중...';
  }
  renderTextFeedRequestMessage('제품 자료를 검색하고 필요한 정보를 확인하고 있습니다.', 'info');

  try {
    const species = state.selectedPetSpecies === 'dog' ? 'dog' : 'cat';
    const { data: requestId, error: requestError } = await sb.rpc('create_feed_request', {
      p_request_text: query,
      p_species: species,
      p_feed_type: state.uploadType
    });

    if (requestError || !requestId) {
      throw new Error(requestError?.message || '등록 요청 기록을 만들지 못했습니다.');
    }

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'text_request',
        request_id: requestId,
        query,
        type: state.uploadType,
        species,
        user_id: state.currentUser?.id || null,
        identification_requirements: {
          brand_and_product_confirmed: true,
          single_product_identified: true,
          trusted_source_confirmed: true
        }
      })
    });
    const result = await parseAppsScriptResponse(response);

    const validation = result.validation || result.제품식별검증 || {};
    const needsMoreInfo =
      result.needs_more_info === true ||
      result.추가정보필요 === true ||
      result.outcome === 'needs_more_info' ||
      result.status === 'needs_more_info' ||
      Object.values(validation).some(value => value === false);

    if (needsMoreInfo) {
      renderTextFeedRequestMessage(
        result.안내 || '브랜드와 정확한 제품명을 함께 입력해주세요. 예: 조공 소피캣 닭',
        'warning'
      );
      input?.focus();
      return;
    }

    if (result.중복) {
      const status = result.verified ? '이미 등록된 제품입니다.' : '이미 검수 전 제품으로 등록되어 있습니다.';
      renderTextFeedRequestMessage(`${status} ${result.제품명 || ''}`.trim(), result.verified ? 'success' : 'warning');
      return;
    }

    if (!result.성공) {
      renderTextFeedRequestMessage(result.오류 || '제품 정보를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
      return;
    }

    invalidateFeedPickerCache(state.uploadType);
    const names = Array.isArray(result.제품명) ? result.제품명.join(', ') : (result.제품명 || query);
    const message = result.검색가능 === false
      ? `${names} 자료를 저장했습니다. 수치가 부족하거나 충돌해 Supabase 검수 후 검색에 표시됩니다.`
      : `${names} 임시 등록 완료 — 검색 결과에서 ‘검수 전’ 표시로 사용할 수 있습니다.`;
    renderTextFeedRequestMessage(message, result.검색가능 === false ? 'warning' : 'success');
    if (input) input.value = '';
  } catch (error) {
    console.error('Text feed request failed:', error);
    renderTextFeedRequestMessage('제품 정보를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    isSubmittingTextFeed = false;
    if (button) {
      button.disabled = false;
      button.textContent = '제품명으로 등록';
    }
  }
}

window.setUploadType = setUploadType;
window.handleUploadFileChange = handleUploadFileChange;
window.handleFeedImageUpload = handleFeedImageUpload;
window.handleTextFeedRequest = handleTextFeedRequest;

document.addEventListener('DOMContentLoaded', initializeTextFeedRegistration);
