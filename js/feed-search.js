function quotePostgrestFilterValue(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildFeedSearchPattern(query) {
  return quotePostgrestFilterValue(`*${query}*`);
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
    .from('feeds')
    .select('제품명, 제조사, final_me, eb_칼슘, eb_인, 수분')
    .eq('type', type)
    .eq('verified', true)
    .gt('final_me', 0)
    .or(`제품명.ilike.${buildFeedSearchPattern(searchQuery)},제조사.ilike.${buildFeedSearchPattern(searchQuery)}`)
    .limit(10);

  if (error) {
    list.innerHTML = `<div class="p-3 text-red-400 text-xs">${error.message}</div>`;
    list.classList.remove('hidden');
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="p-4 text-gray-400 text-xs text-center">검색 결과가 없습니다</div>`;
    list.classList.remove('hidden');
    return;
  }

  list.innerHTML = data.map((f, rowIdx) => {
    const display = f.제조사 ? `${f.제조사} | ${f.제품명}` : f.제품명;
    return `
      <div class="autocomplete-item p-4 border-b border-gray-50 cursor-pointer" data-row="${rowIdx}">
        <p class="font-bold text-sm text-gray-800">${display}</p>
        <p class="text-xs text-gray-400 mt-0.5">${f.final_me} kcal/kg${f.수분 != null ? ` · 수분 ${f.수분}%` : ''}</p>
      </div>`;
  }).join('');

  list._cache = { data, type, slotId, listId };
  list.classList.remove('hidden');

  list.onclick = (e) => {
    const item = e.target.closest('[data-row]');
    if (!item) return;
    const { data: cData, type: cType, slotId: cSlotId, listId: cListId } = list._cache;
    selectFeed(cType, cSlotId, cData[parseInt(item.dataset.row)], cListId);
  };
}

function selectFeed(type, slotId, feedData, listId) {
  const feed = {
    name:     feedData.제품명,
    display:  feedData.제조사 ? `${feedData.제조사} | ${feedData.제품명}` : feedData.제품명,
    kcal:     feedData.final_me,
    ebCa:     feedData.eb_칼슘  || 0,
    ebP:      feedData.eb_인    || 0,
    moisture: feedData.수분     ?? null
  };

  if (type === 'dry') {
    state.dryFeeds[slotId] = feed;
    document.getElementById(`dryInput${slotId + 1}`).value = feed.display;
    const sel = document.getElementById(`drySelected${slotId + 1}`);
    sel.textContent = `✓ ${feed.name} (${feed.kcal} kcal/kg)`;
    sel.classList.remove('hidden');
  } else {
    state.wetFeedMap[slotId] = feed;
    document.getElementById(`wetInput_${slotId}`).value = feed.display;
    const sel = document.getElementById(`wetSelected_${slotId}`);
    sel.textContent = `✓ ${feed.name} (${feed.kcal} kcal/kg)`;
    sel.classList.remove('hidden');
  }

  document.getElementById(listId)?.classList.add('hidden');
  markCalculationDirty();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.relative')) {
    document.querySelectorAll('[id^="dryList"],[id*="wetList_"]')
      .forEach(el => el.classList.add('hidden'));
  }
});


const feedPickerState = {
  type: null,
  slotId: null,
  nameFilter: '',
  sortBy: 'manufacturer',
  cache: {
    dry: null,
    wet: null
  },
  loading: {
    dry: false,
    wet: false
  },
  error: {
    dry: null,
    wet: null
  },
  requests: {
    dry: null,
    wet: null
  }
};

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
    .from('feeds')
    .select('제품명,제조사,메인단백질,final_me,eb_칼슘,eb_인,수분')
    .eq('type', type)
    .eq('verified', true)
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

  if (feedPickerState.type === type) {
    renderFeedPicker();
  }

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

      if (feedPickerState.type === type) {
        renderFeedPicker();
      }
    });

  await feedPickerState.requests[type];
}

function setFeedPickerSort(sortBy) {
  feedPickerState.sortBy = sortBy === 'product' ? 'product' : 'manufacturer';
  renderFeedPicker();
}

function getSortedFeedPickerFeeds() {
  const filter = feedPickerState.nameFilter.trim().toLocaleLowerCase('ko');
  const feeds = (feedPickerState.cache[feedPickerState.type] || []).filter(feed =>
    !filter || String(feed.제품명 || '').toLocaleLowerCase('ko').includes(filter)
  );
  const sorted = feeds.slice();

  if (feedPickerState.sortBy === 'product') {
    return sorted.sort((a, b) => compareFeedText(a.제품명, b.제품명));
  }

  return sorted.sort((a, b) => {
    const manufacturerOrder = compareFeedText(a.제조사, b.제조사);
    if (manufacturerOrder !== 0) return manufacturerOrder;
    return compareFeedText(a.제품명, b.제품명);
  });
}

function renderFeedPickerSortButtons() {
  const manufacturerBtn = document.getElementById('feedPickerSortManufacturer');
  const productBtn = document.getElementById('feedPickerSortProduct');
  if (!manufacturerBtn || !productBtn) return;

  const activeClass = 'py-3 rounded-2xl text-sm font-black bg-[#2F6FED] text-white';
  const inactiveClass = 'py-3 rounded-2xl text-sm font-black bg-gray-100 text-gray-400';
  manufacturerBtn.className = feedPickerState.sortBy === 'manufacturer' ? activeClass : inactiveClass;
  productBtn.className = feedPickerState.sortBy === 'product' ? activeClass : inactiveClass;
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
      <p class="text-xs font-black text-gray-400">${escapeFeedPickerHtml(feed.제조사 || '제조사 정보 없음')}</p>
      <p class="text-base font-black text-gray-800 mt-1 leading-snug">${escapeFeedPickerHtml(feed.제품명 || '제품명 정보 없음')}</p>
      <p class="inline-block mt-2 px-2.5 py-1 bg-white rounded-full text-[11px] font-black text-blue-400 border border-blue-50">
        ${escapeFeedPickerHtml(getFeedPickerMainProtein(feed))}
      </p>
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
  dryButton.classList.toggle('is-active', type === 'dry');
  dryButton.setAttribute('aria-pressed', String(type === 'dry'));
  wetButton.classList.toggle('is-active', type === 'wet');
  wetButton.setAttribute('aria-pressed', String(type === 'wet'));
}


let selectedFeedImageFile = null;
let isUploadingFeedImage = false;

function handleUploadFileChange(input) {
  if (!input.files?.length) {
    selectedFeedImageFile = null;
    return;
  }

  selectedFeedImageFile = input.files[0];
  const msgEl = document.getElementById('uploadMsg');
  if (msgEl) {
    msgEl.innerHTML = `<p class="text-xs text-blue-400 font-bold mt-2">📷 선택됨: ${selectedFeedImageFile.name}</p>`;
  }
}

async function uploadFeedImageToAppsScript() {
  const input = document.getElementById('uploadInput');
  const file = selectedFeedImageFile || input?.files?.[0];
  if (!file) {
    alert('분석할 사료 사진을 먼저 선택해주세요.');
    return;
  }

  const msgEl = document.getElementById('uploadMsg');
  if (msgEl) {
    msgEl.innerHTML = `<p class="text-xs text-blue-400 font-bold mt-2">📡 분석 중... 잠시 기다려주세요</p>`;
  }

  const base64 = await new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result.split(',')[1]);
    r.readAsDataURL(file);
  });

  console.log('[feed-upload] sending Apps Script request');

  const resp = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'upload',
      base64Data: base64,
      mimeType: file.type,
      fileName: file.name,
      type: state.uploadType
    })
  });
  const result = await resp.json();
  if (result.성공) {
    if (msgEl) {
      msgEl.innerHTML = `<p class="text-xs text-green-500 font-bold mt-2">✅ 전송 완료 — 검수 후 목록에 반영됩니다.</p>`;
    }
    selectedFeedImageFile = null;
    if (input) input.value = '';
  } else if (msgEl) {
    msgEl.innerHTML = `<p class="text-xs text-orange-400 font-bold mt-2">⚠️ 실패: ${result.오류 || '알 수 없는 오류'}</p>`;
  }
}

async function handleFeedImageUpload(event) {
  event?.preventDefault();
  console.log('[feed-upload] button clicked');

  if (isUploadingFeedImage) {
    console.warn('이미지 업로드가 이미 진행 중입니다. 중복 요청을 무시합니다.');
    return;
  }

  isUploadingFeedImage = true;

  const uploadButton = document.getElementById('uploadFeedBtn');
  if (uploadButton) uploadButton.disabled = true;

  try {
    await uploadFeedImageToAppsScript();
  } catch (error) {
    console.error('Feed image upload failed:', error);
    alert('이미지 분석 중 오류가 발생했습니다.');
    const msgEl = document.getElementById('uploadMsg');
    if (msgEl) {
      msgEl.innerHTML = `<p class="text-xs text-red-400 font-bold mt-2">❌ 오류: 네트워크 문제 또는 서버 응답 없음</p>`;
    }
  } finally {
    isUploadingFeedImage = false;
    if (uploadButton) uploadButton.disabled = false;
  }
}
