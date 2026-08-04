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
    .select('제품명,제조사,final_me,eb_칼슘,eb_인,수분,verified,verification_status,searchable_before_review')
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

function removeInternalStorageName(message) {
  return String(message || '').replace(/Supabase\s*/gi, '');
}

function refineFeedRegistrationCopy() {
  const help = document.querySelector('.pc-text-feed-request__help');
  if (help) {
    help.textContent = '공식 제조사·수입사 자료를 우선 확인합니다. 국내 라벨이 없거나 자료가 충돌하면 별도 검수 후 반영됩니다.';
  }

  const divider = document.querySelector('.pc-registration-divider');
  const picker = document.querySelector('.pc-upload-picker');
  if (!divider || !picker || document.getElementById('feedPhotoUploadGuide')) return;

  const guide = document.createElement('div');
  guide.id = 'feedPhotoUploadGuide';
  guide.className = 'pc-photo-upload-guide';
  guide.innerHTML = `
    <p class="pc-upload-description">
      영양성분표가 모두 보이는 사진 <strong>1장</strong>을 올려주세요.<br>
      여러 장으로 나눠진 경우 <strong>한 장으로 만들어</strong> 업로드해주세요.
    </p>
    <p class="pc-upload-note">업로드 및 분석까지 최대 30초 걸릴 수 있습니다. 중복 업로드를 피해주세요.</p>`;
  divider.insertAdjacentElement('afterend', guide);
}

const originalRenderTextFeedRequestMessage = window.renderTextFeedRequestMessage;
if (typeof originalRenderTextFeedRequestMessage === 'function') {
  window.renderTextFeedRequestMessage = function (message, tone) {
    return originalRenderTextFeedRequestMessage(removeInternalStorageName(message), tone);
  };
}

window.resetRecentFeedButtons = resetRecentFeedButtons;
window.loadRecentFeedsForCat = loadRecentFeedsForCat;
window.selectRecentFeed = selectRecentFeed;

document.addEventListener('DOMContentLoaded', refineFeedRegistrationCopy);
