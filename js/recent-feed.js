let recentFeedRequestId = 0;
const recentFeedNames = { dry: '', wet: '' };

function normalizeRecentFeedName(value) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return String(value.name || value.제품명 || value.feed_name || '').trim();
}

function setRecentFeedButton(type, name) {
  recentFeedNames[type] = name;
  const button = document.getElementById(type === 'dry' ? 'recentDryFeedButton' : 'recentWetFeedButton');
  if (!button) return;
  button.classList.toggle('hidden', !name);
  button.textContent = name ? `최근 사용 · ${name}` : '';
  button.title = name ? `최근 사용: ${name}` : '';
  button.setAttribute('aria-label', name ? `최근 사용한 ${type === 'dry' ? '건사료' : '습식사료'} ${name} 선택` : '');
}

function resetRecentFeedButtons() {
  recentFeedRequestId += 1;
  setRecentFeedButton('dry', '');
  setRecentFeedButton('wet', '');
}

async function loadRecentFeedsForCat(petId) {
  resetRecentFeedButtons();
  const user = state.currentUser;
  if (!user?.id || !petId) return;
  const requestId = recentFeedRequestId;
  const { data, error } = await sb.from('feeding_records')
    .select('result_data, created_at')
    .eq('user_id', user.id).eq('pet_id', petId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.warn('최근 사용 사료를 불러오지 못했습니다.', error);
    return;
  }
  if (requestId !== recentFeedRequestId || state.selectedSavedCatId !== petId || state.currentUser?.id !== user.id) return;
  const dryName = data?.result_data?.건사료_결과?.[0]?.이름 || '';
  const wetName = data?.result_data?.습식사료_결과?.[0]?.이름 || '';
  setRecentFeedButton('dry', normalizeRecentFeedName(dryName));
  setRecentFeedButton('wet', normalizeRecentFeedName(wetName));
}

async function selectRecentFeed(type) {
  const name = recentFeedNames[type];
  if (!name) return;
  const { data, error } = await sb.from(getActiveFeedTable())
    .select(getFeedSearchColumns())
    .eq('type', type).eq('verified', true).gt('final_me', 0)
    .eq('제품명', name).limit(1).maybeSingle();
  if (!error && data) {
    const slotId = type === 'dry' ? 0 : state.wetSlotIds[0];
    if (slotId != null) selectFeed(type, slotId, data, null);
    return;
  }
  openFeedPicker(type, type === 'dry' ? 0 : state.wetSlotIds[0]);
  feedPickerState.nameFilter = name;
  await ensureFeedPickerFeeds(type);
  renderFeedPicker();
  const status = document.getElementById('feedPickerStatus');
  if (status && !getSortedFeedPickerFeeds().length) {
    status.textContent = `최근 사용한 “${name}” 제품을 찾지 못했어요.`;
    status.className = 'py-4 text-center text-sm font-bold text-gray-400';
  }
}


window.resetRecentFeedButtons = resetRecentFeedButtons;
window.loadRecentFeedsForCat = loadRecentFeedsForCat;
window.selectRecentFeed = selectRecentFeed;
