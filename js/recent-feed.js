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

function createRegistrationStepHeading(number, title, description) {
  const heading = document.createElement('div');
  heading.className = 'pc-registration-step-heading';
  heading.innerHTML = `
    <span class="pc-registration-step-heading__number" aria-hidden="true">${number}</span>
    <div>
      <h3>${title}</h3>
      ${description ? `<p>${description}</p>` : ''}
    </div>`;
  return heading;
}

function createFeedPhotoExamples() {
  const examples = document.createElement('div');
  examples.id = 'feedPhotoExamples';
  examples.className = 'pc-feed-photo-examples';
  examples.innerHTML = `
    <section class="pc-feed-photo-example-group pc-feed-photo-example-group--invalid" aria-labelledby="feedPhotoInvalidTitle">
      <div class="pc-feed-photo-example-heading">
        <span class="pc-feed-photo-example-mark" aria-hidden="true">×</span>
        <h4 id="feedPhotoInvalidTitle">이런 경우는 불가능해요</h4>
      </div>
      <div class="pc-feed-photo-example-grid pc-feed-photo-example-grid--invalid">
        <article class="pc-feed-photo-example-card">
          <div class="pc-label-mock pc-label-mock--nutrition-only" aria-hidden="true">
            <strong>등록성분량</strong>
            <span><b>조단백질</b><i>12.0% 이상</i></span>
            <span><b>조지방</b><i>5.0% 이상</i></span>
            <span><b>수분</b><i>78.0% 이하</i></span>
            <span><b>칼슘</b><i>0.20% 이상</i></span>
          </div>
          <p><strong>제품명 없이</strong><br>성분만 있는 사진</p>
        </article>
        <article class="pc-feed-photo-example-card">
          <div class="pc-label-mock pc-label-mock--name-only" aria-hidden="true">
            <span class="pc-label-mock__brand">프루브</span>
            <strong>CHICKEN RECIPE</strong>
            <small>COMPLETE FOOD</small>
          </div>
          <p><strong>제품명만 있고</strong><br>성분 정보가 없는 사진</p>
        </article>
      </div>
    </section>

    <section class="pc-feed-photo-example-group pc-feed-photo-example-group--valid" aria-labelledby="feedPhotoValidTitle">
      <div class="pc-feed-photo-example-heading">
        <span class="pc-feed-photo-example-mark" aria-hidden="true">✓</span>
        <h4 id="feedPhotoValidTitle">이런 경우가 가능해요!</h4>
      </div>
      <article class="pc-feed-photo-example-card pc-feed-photo-example-card--valid">
        <div class="pc-label-mock pc-label-mock--complete" aria-hidden="true">
          <div class="pc-label-mock__product">
            <span>제품명</span>
            <strong>프루브 닭고기 레시피</strong>
          </div>
          <div class="pc-label-mock__complete-grid">
            <div>
              <b>원재료 전성분</b>
              <i></i><i></i><i></i><i></i>
            </div>
            <div>
              <b>등록성분량</b>
              <span>조단백 38.0%</span>
              <span>조지방 18.0%</span>
              <span>수분 10.0%</span>
            </div>
          </div>
        </div>
        <p><strong>제품명 · 영양성분 · 원재료 전성분</strong><br>세 가지가 모두 한 장에 선명하게 나온 사진</p>
      </article>
    </section>

    <p class="pc-feed-photo-shooting-tip">
      라벨을 정면에서 촬영하고, 빛 반사 없이 작은 글씨까지 선명하게 보여주세요.
    </p>`;
  return examples;
}

function refineFeedRegistrationCopy() {
  const section = document.querySelector('.pc-upload-section');
  const typeRow = section?.querySelector('.pc-upload-type-row');
  const requestBox = section?.querySelector('.pc-text-feed-request');
  const divider = section?.querySelector('.pc-registration-divider');
  const picker = section?.querySelector('.pc-upload-picker');
  const analyzeButton = document.getElementById('uploadFeedBtn');
  const requestButton = document.getElementById('feedTextRequestBtn');
  if (!section || !typeRow || !requestBox || !picker || !analyzeButton || !requestButton) return;

  section.querySelectorAll(':scope > .pc-upload-description, :scope > .pc-upload-note')
    .forEach(element => element.remove());

  const help = requestBox.querySelector('.pc-text-feed-request__help');
  if (help) {
    help.textContent = '공식 제조사·수입사 자료를 우선 확인합니다. 국내 라벨이 없거나 자료가 충돌하면 별도 검수 후 반영됩니다.';
  }

  if (!document.getElementById('feedTextRegistrationStep')) {
    const stepOne = createRegistrationStepHeading(
      '1',
      '브랜드와 제품명으로 등록 요청',
      '라벨 사진이 없을 때 브랜드와 정확한 제품명을 입력해 주세요.'
    );
    stepOne.id = 'feedTextRegistrationStep';
    requestBox.insertAdjacentElement('beforebegin', stepOne);
  }

  divider?.remove();

  if (!document.getElementById('feedPhotoRegistrationStep')) {
    const stepTwo = createRegistrationStepHeading(
      '2',
      '라벨 사진으로 등록 요청',
      '제품명과 성분 정보를 한 장에서 확인할 수 있는 라벨 사진을 올려주세요.'
    );
    stepTwo.id = 'feedPhotoRegistrationStep';
    picker.insertAdjacentElement('beforebegin', stepTwo);
  }

  let guide = document.getElementById('feedPhotoUploadGuide');
  if (!guide) {
    guide = document.createElement('div');
    guide.id = 'feedPhotoUploadGuide';
    guide.className = 'pc-photo-upload-guide';
    document.getElementById('feedPhotoRegistrationStep')?.insertAdjacentElement('afterend', guide);
  }
  guide.innerHTML = `
    <p class="pc-upload-description">
      제품명, 영양성분, 원재료 전성분이 모두 보이는 사진 <strong>1장</strong>을 올려주세요.<br>
      여러 면에 나뉘어 있다면 <strong>한 장의 이미지로 합쳐서</strong> 업로드해 주세요.
    </p>
    <p class="pc-upload-note">업로드 및 분석까지 최대 30초 걸릴 수 있습니다. 중복 업로드를 피해주세요.</p>`;

  requestButton.classList.add('pc-registration-primary-button');
  analyzeButton.classList.add('pc-registration-primary-button');

  if (!document.getElementById('feedPhotoExamples')) {
    analyzeButton.insertAdjacentElement('afterend', createFeedPhotoExamples());
  }
}

function getUploadTypePalette() {
  if (state.selectedPetSpecies === 'dog') {
    return {
      dry: { strong: '#A66A3F', soft: '#F7EFEA', ink: '#6F5143' },
      wet: { strong: '#58A66A', soft: '#EEF7F0', ink: '#388255' }
    };
  }

  return {
    dry: { strong: '#FF9F43', soft: '#FFF4E8', ink: '#B85A00' },
    wet: { strong: '#3D8BFF', soft: '#EDF5FF', ink: '#1F5CC4' }
  };
}

function applyUploadTypeButtonStyle(button, palette, active) {
  if (!button) return;
  button.style.backgroundColor = active ? palette.soft : '#FFFFFF';
  button.style.borderColor = active ? palette.strong : palette.soft;
  button.style.color = palette.ink;
  button.style.boxShadow = active ? `0 4px 12px ${palette.strong}24` : 'none';
  button.style.transform = active ? 'translateY(-1px)' : 'none';
  button.style.fontWeight = '900';
  button.style.transition = 'background-color .18s ease, color .18s ease, box-shadow .18s ease, transform .18s ease';
}

function updateUploadTypeButtons() {
  const dryButton = document.getElementById('upDryBtn');
  const wetButton = document.getElementById('upWetBtn');
  if (!dryButton || !wetButton) return;

  const palette = getUploadTypePalette();
  const activeType = state.uploadType === 'wet' ? 'wet' : 'dry';

  dryButton.textContent = '건사료';
  wetButton.textContent = '습식사료';
  dryButton.setAttribute('aria-label', '건사료 등록 선택');
  wetButton.setAttribute('aria-label', '습식사료 등록 선택');

  applyUploadTypeButtonStyle(dryButton, palette.dry, activeType === 'dry');
  applyUploadTypeButtonStyle(wetButton, palette.wet, activeType === 'wet');
}

function enhanceFeedTypeSelector() {
  const typeRow = document.querySelector('.pc-upload-type-row');
  if (!typeRow) return;

  if (!document.getElementById('feedTypeSelectionGuide')) {
    const guide = document.createElement('p');
    guide.id = 'feedTypeSelectionGuide';
    guide.className = 'pc-feed-type-selection-guide';
    guide.innerHTML = '제품명 등록과 사진 업로드 전 <strong>건사료</strong> 또는 <strong>습식사료</strong>를 선택해 주세요.';
    typeRow.insertAdjacentElement('beforebegin', guide);
  }

  if (!document.getElementById('feedTypeSelectionStyles')) {
    const style = document.createElement('style');
    style.id = 'feedTypeSelectionStyles';
    style.textContent = `
      .pc-feed-type-selection-guide {
        margin: 18px 0 10px;
        color: #4B5563;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.55;
      }
      .pc-feed-type-selection-guide strong {
        color: #1F2937;
        font-weight: 900;
      }
      .pc-upload-type-row {
        gap: 10px;
      }
      .pc-upload-type-button {
        min-height: 48px;
        border-width: 1px;
      }
      .pc-registration-step-heading {
        display: flex;
        align-items: flex-start;
        gap: 11px;
        margin: 26px 0 12px;
      }
      .pc-registration-step-heading__number {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: #2F6FED;
        color: #FFFFFF;
        font-size: 13px;
        font-weight: 900;
        line-height: 1;
      }
      .pc-registration-step-heading h3 {
        margin: 1px 0 0;
        color: #1F2937;
        font-size: 16px;
        font-weight: 900;
        line-height: 1.35;
      }
      .pc-registration-step-heading p {
        margin: 5px 0 0;
        color: #7B8492;
        font-size: 12px;
        font-weight: 650;
        line-height: 1.55;
      }
      .pc-text-feed-request {
        margin-top: 0 !important;
      }
      .pc-registration-primary-button {
        width: 100% !important;
        min-height: 50px !important;
        padding: 0 16px !important;
        border: 0 !important;
        border-radius: 12px !important;
        background: #2F6FED !important;
        color: #FFFFFF !important;
        font-size: 15px !important;
        font-weight: 900 !important;
        line-height: 1.2 !important;
        box-shadow: none !important;
      }
      .pc-registration-primary-button:disabled {
        opacity: .55 !important;
        cursor: wait;
      }
      .pc-photo-upload-guide {
        margin-bottom: 14px;
      }
      .pc-feed-photo-examples {
        display: grid;
        gap: 12px;
        margin-top: 18px;
      }
      .pc-feed-photo-example-group {
        padding: 15px;
        border: 1px solid #E4E9F1;
        border-radius: 14px;
        background: #FFFFFF;
      }
      .pc-feed-photo-example-group--invalid {
        border-color: #F1D2D6;
        background: #FFF9FA;
      }
      .pc-feed-photo-example-group--valid {
        border-color: #C9E5D2;
        background: #F8FCF9;
      }
      .pc-feed-photo-example-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .pc-feed-photo-example-heading h4 {
        margin: 0;
        color: #263141;
        font-size: 14px;
        font-weight: 900;
      }
      .pc-feed-photo-example-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #E8505B;
        color: #FFFFFF;
        font-size: 15px;
        font-weight: 900;
        line-height: 1;
      }
      .pc-feed-photo-example-group--valid .pc-feed-photo-example-mark {
        background: #26A15B;
        font-size: 13px;
      }
      .pc-feed-photo-example-grid--invalid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .pc-feed-photo-example-card {
        min-width: 0;
      }
      .pc-feed-photo-example-card > p {
        margin: 9px 0 0;
        color: #687384;
        font-size: 11px;
        font-weight: 650;
        line-height: 1.5;
        text-align: center;
      }
      .pc-feed-photo-example-card > p strong {
        color: #374151;
        font-weight: 900;
      }
      .pc-label-mock {
        min-height: 118px;
        overflow: hidden;
        border: 1px solid #D8DEE8;
        border-radius: 10px;
        background: #F7F5F0;
        color: #333333;
      }
      .pc-label-mock--nutrition-only {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 12px;
        background: #F5F1E9;
        font-size: 9px;
      }
      .pc-label-mock--nutrition-only > strong {
        padding-bottom: 5px;
        border-bottom: 1px solid #B8B0A2;
        font-size: 10px;
      }
      .pc-label-mock--nutrition-only > span {
        display: flex;
        justify-content: space-between;
        gap: 5px;
      }
      .pc-label-mock--nutrition-only b,
      .pc-label-mock--nutrition-only i {
        font-style: normal;
        font-weight: 700;
      }
      .pc-label-mock--name-only {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 16px 8px;
        background: #EAF1F8;
        text-align: center;
      }
      .pc-label-mock__brand {
        margin-bottom: 10px;
        color: #52657D;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: .12em;
      }
      .pc-label-mock--name-only > strong {
        color: #203A5B;
        font-size: 14px;
        font-weight: 900;
        line-height: 1.15;
      }
      .pc-label-mock--name-only > small {
        margin-top: 8px;
        color: #6B7B8F;
        font-size: 7px;
        font-weight: 800;
        letter-spacing: .08em;
      }
      .pc-label-mock--complete {
        min-height: 142px;
        padding: 11px;
        background: #F6F4EE;
      }
      .pc-label-mock__product {
        display: grid;
        grid-template-columns: 50px 1fr;
        gap: 7px;
        align-items: center;
        padding-bottom: 9px;
        border-bottom: 1px solid #B9B3A8;
        font-size: 9px;
      }
      .pc-label-mock__product span {
        font-weight: 800;
      }
      .pc-label-mock__product strong {
        font-size: 10px;
        font-weight: 900;
      }
      .pc-label-mock__complete-grid {
        display: grid;
        grid-template-columns: 1.25fr .9fr;
        gap: 10px;
        padding-top: 10px;
      }
      .pc-label-mock__complete-grid > div {
        min-width: 0;
        font-size: 8px;
      }
      .pc-label-mock__complete-grid b {
        display: block;
        margin-bottom: 7px;
        font-size: 9px;
      }
      .pc-label-mock__complete-grid i {
        display: block;
        width: 100%;
        height: 5px;
        margin-top: 5px;
        border-radius: 999px;
        background: #D3CEC4;
      }
      .pc-label-mock__complete-grid i:nth-child(3) { width: 86%; }
      .pc-label-mock__complete-grid i:nth-child(4) { width: 93%; }
      .pc-label-mock__complete-grid i:nth-child(5) { width: 68%; }
      .pc-label-mock__complete-grid span {
        display: block;
        margin-top: 5px;
        white-space: nowrap;
      }
      .pc-feed-photo-shooting-tip {
        margin: 0;
        padding: 12px 13px;
        border-radius: 11px;
        background: #F3F6FA;
        color: #657083;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.55;
      }
      @media (max-width: 380px) {
        .pc-feed-photo-example-grid--invalid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  updateUploadTypeButtons();
}

const originalRenderTextFeedRequestMessage = window.renderTextFeedRequestMessage;
if (typeof originalRenderTextFeedRequestMessage === 'function') {
  window.renderTextFeedRequestMessage = function (message, tone) {
    return originalRenderTextFeedRequestMessage(removeInternalStorageName(message), tone);
  };
}

const originalSetUploadType = window.setUploadType;
if (typeof originalSetUploadType === 'function') {
  window.setUploadType = function (type) {
    const result = originalSetUploadType(type);
    updateUploadTypeButtons();
    return result;
  };
}

const originalResetFeedSearchForSpecies = window.resetFeedSearchForSpecies;
if (typeof originalResetFeedSearchForSpecies === 'function') {
  window.resetFeedSearchForSpecies = function () {
    const result = originalResetFeedSearchForSpecies();
    requestAnimationFrame(updateUploadTypeButtons);
    return result;
  };
}

window.resetRecentFeedButtons = resetRecentFeedButtons;
window.loadRecentFeedsForCat = loadRecentFeedsForCat;
window.selectRecentFeed = selectRecentFeed;
window.updateUploadTypeButtons = updateUploadTypeButtons;

document.addEventListener('DOMContentLoaded', () => {
  enhanceFeedTypeSelector();
  refineFeedRegistrationCopy();
  setTimeout(updateUploadTypeButtons, 300);
});

document.addEventListener('click', () => {
  requestAnimationFrame(updateUploadTypeButtons);
});
