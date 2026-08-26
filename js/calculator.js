function getAgeMonths(birth, today = new Date()) {
  const monthDelta = (today.getFullYear() - birth.getFullYear()) * 12
    + (today.getMonth() - birth.getMonth());
  const dayFraction = (today.getDate() - birth.getDate()) / 30.4375;
  return Math.max(0, monthDelta + dayFraction);
}

function getDogAdultTransitionMonths(expectedAdultWeight) {
  if (expectedAdultWeight <= 10) return 10;
  if (expectedAdultWeight <= 25) return 12;
  if (expectedAdultWeight <= 45) return 15;
  return 18;
}

function getDogGrowthFactor(weightRatio, ageProgress) {
  if (weightRatio < 0.5) return { factor: 3.0, stage: '성장 초기' };
  if (weightRatio < 0.8) return { factor: 2.5, stage: '성장 중기' };
  if (ageProgress < 0.9) return { factor: 2.0, stage: '성장 후기' };
  return { factor: 1.8, stage: '성견 전환기' };
}

function getFediafPuppyEnergy(weight, expectedAdultWeight) {
  const weightRatio = Math.min(weight / expectedAdultWeight, 1);
  const coefficient = Math.max(119.1, 254.1 - (135 * weightRatio));
  return {
    DER: Math.round(coefficient * Math.pow(weight, 0.75)),
    coefficient,
    weightRatio
  };
}

function getDogCaloriePlan(weight, birthStr, neutered, options = {}, today = new Date()) {
  const birth = new Date(`${birthStr}T00:00:00`);
  const months = getAgeMonths(birth, today);
  const ageDays = Math.max(0, Math.floor((today - birth) / 86400000));
  const RER = 70 * Math.pow(weight, 0.75);
  const expectedAdultWeight = Number(options.expectedAdultWeight) || null;
  const transitionMonths = expectedAdultWeight ? getDogAdultTransitionMonths(expectedAdultWeight) : 12;
  const isGrowing = months < transitionMonths;
  const weightRatio = expectedAdultWeight ? Math.min(weight / expectedAdultWeight, 1.5) : null;
  const ageProgress = Math.min(months / transitionMonths, 1);
  let factor;
  let label;
  let stage = '';

  if (options.lactating) {
    factor = 3.0;
    label = '수유 상태 반영';
    stage = '수유기';
  } else if (options.pregnant) {
    factor = 2.0;
    label = '임신 상태 반영';
    stage = '임신기';
  } else if (options.diet) {
    factor = 1.0;
    label = '체중 감량';
    stage = '감량 모드';
  } else if (isGrowing && expectedAdultWeight) {
    const growth = getDogGrowthFactor(weightRatio, ageProgress);
    const fediaf = getFediafPuppyEnergy(weight, expectedAdultWeight);
    factor = fediaf.coefficient / 70;
    label = `${growth.stage} · 예상 성견 체중 ${expectedAdultWeight}kg`;
    stage = growth.stage;
  } else if (isGrowing) {
    factor = months < 4 ? 3.0 : 2.0;
    label = months < 4 ? '생후 4개월 미만 성장기' : '성장기';
    stage = '성장기';
  } else {
    const base = neutered ? 1.6 : 1.8;
    const activityAdjustment = { low: -0.2, normal: 0, high: 0.4 }[options.activity] || 0;
    factor = Number(Math.max(1.2, base + activityAdjustment).toFixed(2));
    label = `${neutered ? '중성화' : '비중성화'} 성견 · 활동량 ${options.activity === 'low' ? '적음' : options.activity === 'high' ? '많음' : '보통'}`;
    stage = '성견';
  }

  const DER = isGrowing && expectedAdultWeight && !options.lactating && !options.pregnant && !options.diet
    ? getFediafPuppyEnergy(weight, expectedAdultWeight).DER
    : Math.round(RER * factor);
  return {
    DER, RER, months, ageDays, factor, label, stage, isGrowing, expectedAdultWeight,
    weightRatio, transitionMonths,
    detail: isGrowing && expectedAdultWeight && !options.lactating && !options.pregnant && !options.diet
      ? `FEDIAF 성장기 공식 · 현재 체중 ${weight}kg ÷ 예상 성견 체중 ${expectedAdultWeight}kg (${label})`
      : `RER ${Math.round(RER)} × ${factor.toFixed(2)} (${label})`,
    dietNotice: options.diet ? '감량은 현재 체중의 RER을 시작값으로 사용합니다. 체중 감소 속도를 확인하며 조정하세요.' : ''
  };
}

function getCaloriePlan(weight, birthStr, neutered, diet, today = new Date(), species = 'cat', options = {}) {
  if (species === 'dog') {
    return getDogCaloriePlan(weight, birthStr, neutered, { ...options, diet }, today);
  }
  const birth  = new Date(birthStr);
  const months = getAgeMonths(birth, today);
  const RER    = 70 * Math.pow(weight, 0.75);
  let f_age, label;

  const adultFactor = neutered ? 1.2 : 1.4;
  const interpolate = (value, start, end, startFactor, endFactor) =>
    startFactor + ((value - start) / (end - start)) * (endFactor - startFactor);

  // Growth anchors are continuous at 4, 9 and 12 months.
  if (months < 4) {
    f_age = interpolate(months, 0, 4, 2.75, 2.1); label = '초기 성장기';
  } else if (months < 9) {
    f_age = interpolate(months, 4, 9, 2.1, 1.9); label = '중기 성장기';
  } else if (months < 12) {
    f_age = interpolate(months, 9, 12, 1.9, adultFactor); label = '후기 성장기';
  } else if (months >= 132) {
    f_age = 1.1; label = '노령묘';
  } else {
    f_age = adultFactor;
    label = neutered ? '중성화 성묘' : '비중성화 성묘';
  }

  const f_neuter = 1.0;
  const f_diet = diet ? 0.9 : 1.0;

  let DER;
  let detail;
  let dietNotice = '';

  if (diet) {
    let finalFactor;
    let finalLabel;

    finalFactor = f_age * f_diet;
    finalLabel = `${label} · 다이어트`;

    DER = Math.round(RER * finalFactor);
    detail = `RER ${Math.round(RER)} × ${finalFactor} (${finalLabel})`;
  } else {
    DER = Math.round(RER * f_age * f_neuter);
    detail = `RER ${Math.round(RER)} × ${f_age} (${label})`;
    if (f_neuter < 1) detail += ` × ${f_neuter} (중성화)`;
  }

  return { DER, RER, months, f_age, f_neuter, f_diet, label, detail, dietNotice };
}

function getWetDefaultPercentages(slotCount) {
  if (slotCount <= 1) return [100];
  if (slotCount === 2) return [50, 50];
  return [35, 35, 30];
}

if (typeof module !== 'undefined') {
  module.exports = { getAgeMonths, getDogAdultTransitionMonths, getDogGrowthFactor, getFediafPuppyEnergy, getDogCaloriePlan, getCaloriePlan, getMealRatios, getWetDefaultPercentages };
}

function updateCalorie() {
  // DER preview is intentionally reserved for the result step.
  document.getElementById('calBox')?.classList.add('hidden');
}

function updateCalculatorSpeciesCopy(species = state.selectedPetSpecies || 'cat') {
  const isDog = species === 'dog';
  const speciesLabel = isDog ? '강아지' : '고양이';
  const nameLabel = document.querySelector('label[for="catName"]');
  const weightInput = document.getElementById('catWeight');

  if (nameLabel) nameLabel.innerHTML = `이름 <span class="pc-optional">선택</span>`;
  if (weightInput) weightInput.max = isDog ? '150' : '20';
  document.getElementById('dogActivityField')?.classList.toggle('hidden', !isDog);
  document.querySelectorAll('[data-pet-species-copy]').forEach(element => {
    element.textContent = speciesLabel;
  });
  updateDogConditionalFields();
  updateBcsImage();
}

const BCS_DESCRIPTIONS = {
  5: '갈비뼈가 만져지고, 위에서 봤을 때 허리가 보이며 복부가 적당히 들어간 이상적인 체형입니다.',
  6: '갈비뼈는 만져지지만 지방층이 조금 두꺼워지고, 허리선이 덜 뚜렷한 체형입니다.',
  7: '갈비뼈를 만지기 어려워지며 허리선이 뚜렷하지 않고 복부 지방이 증가한 체형입니다.',
  8: '갈비뼈가 두꺼운 지방층 아래에 있어 잘 만져지지 않고 허리선이 거의 보이지 않는 체형입니다.',
  9: '갈비뼈를 만지기 매우 어렵고 허리선이 없으며 복부와 몸통에 뚜렷한 지방 축적이 보이는 체형입니다.'
};

function updateBcsImage() {
  const value = Number(document.getElementById('bcsValue')?.value);
  const species = state.selectedPetSpecies || 'cat';
  const image = document.getElementById('bcsSelectedImage');
  document.querySelectorAll('[data-bcs-card-image]').forEach(cardImage => {
    cardImage.onload = () => cardImage.classList.remove('hidden');
    cardImage.onerror = () => cardImage.classList.add('hidden');
    cardImage.src = `/images/bcs/${species}-bcs-${cardImage.dataset.bcsCardImage}.webp`;
    cardImage.alt = `${species === 'dog' ? '강아지' : '고양이'} BCS ${cardImage.dataset.bcsCardImage} 단계 예시`;
  });
  if (!image || !value) return;
  image.onload = () => image.classList.remove('hidden');
  image.onerror = () => image.classList.add('hidden');
  image.src = `/images/bcs/${species}-bcs-${value}.webp`;
  image.alt = `${species === 'dog' ? '강아지' : '고양이'} BCS ${value} 단계 예시`;
}

function initializeBcsChoices() {
  const diet = document.getElementById('isDiet');
  const field = document.getElementById('bcsField');
  const valueInput = document.getElementById('bcsValue');
  const description = document.getElementById('bcsDescription');
  const buttons = [...document.querySelectorAll('[data-bcs]')];
  if (field.dataset.initialized === 'true') {
    field._bcsSync?.();
    return;
  }
  field.dataset.initialized = 'true';
  const sync = () => {
    const value = Number(valueInput.value);
    field.classList.toggle('hidden', !diet.checked);
    field.setAttribute('aria-hidden', String(!diet.checked));
    buttons.forEach(button => {
      const selected = Number(button.dataset.bcs) === value;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    description.textContent = value ? BCS_DESCRIPTIONS[value] : '현재 체형과 가장 가까운 단계를 선택해 주세요.';
    updateBcsImage();
  };
  field._bcsSync = sync;
  buttons.forEach(button => button.addEventListener('click', () => {
    valueInput.value = button.dataset.bcs;
    valueInput.dispatchEvent(new Event('change', { bubbles: true }));
    sync();
  }));
  diet.addEventListener('change', () => {
    if (!diet.checked) valueInput.value = '';
    sync();
  });
  valueInput.addEventListener('change', sync);
  sync();
}

function updateDogConditionalFields() {
  const isDog = (state.selectedPetSpecies || 'cat') === 'dog';
  const birthValue = document.getElementById('catBirth')?.value;
  const birth = birthValue ? new Date(`${birthValue}T00:00:00`) : null;
  const months = birth && !Number.isNaN(birth.getTime()) ? getAgeMonths(birth) : null;
  document.getElementById('dogAdultWeightField')?.classList.toggle('hidden', !(isDog && months !== null && months < 18));
}

function markCalculationDirty() {
  updateFeedingPreview();
  if (!state.lastResult) return;
  state.isCalculationDirty = true;
  updateResultActionState();
}

function markCalculationFresh() {
  state.isCalculationDirty = false;
  updateResultActionState();
}

function updateResultActionState() {
  const hasResult = !!state.lastResult;
  const isFresh = hasResult && !state.isCalculationDirty;
  const shareOpenButton = document.getElementById('openShareModalBtn');
  if (shareOpenButton) {
    shareOpenButton.disabled = !isFresh;
    shareOpenButton.setAttribute('aria-disabled', String(!isFresh));
    shareOpenButton.classList.toggle('opacity-50', !isFresh);
    shareOpenButton.classList.toggle('cursor-not-allowed', !isFresh);
  }
  document.querySelectorAll('.share-btn-save, .share-btn-kakao').forEach(button => {
    button.disabled = !isFresh;
    button.setAttribute('aria-disabled', String(!isFresh));
  });
  updateSaveFeedingButtonVisibility();
  document.getElementById('resultDirtyNotice')?.classList.toggle('hidden', !state.isCalculationDirty);
}

function initializeCalculatorChoices() {
  const neuteredInput = document.getElementById('catNeutered');
  const buttons = document.querySelectorAll('[data-neutered]');
  const syncNeutered = () => buttons.forEach(button => {
    const selected = button.dataset.neutered === neuteredInput.value;
    button.setAttribute('aria-checked', String(selected));
    button.classList.toggle('is-selected', selected);
  });
  buttons.forEach(button => button.addEventListener('click', () => {
    neuteredInput.value = button.dataset.neutered;
    syncNeutered();
    neuteredInput.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  neuteredInput.addEventListener('change', syncNeutered);
  syncNeutered();

  const pregnant = document.getElementById('isPregnant');
  const lactating = document.getElementById('isLactating');
  pregnant.addEventListener('change', () => { if (pregnant.checked) lactating.checked = false; });
  lactating.addEventListener('change', () => { if (lactating.checked) pregnant.checked = false; });
  [pregnant, lactating, document.getElementById('catBirth'), document.getElementById('dogExpectedAdultWeight')]
    .forEach(element => element?.addEventListener('change', updateDogConditionalFields));

  const expectedAdultWeightInput = document.getElementById('dogExpectedAdultWeight');
  const expectedAdultWeightButtons = [...document.querySelectorAll('[data-adult-weight]')];
  const expectedAdultWeightUnknownButton = document.querySelector('[data-adult-weight-unknown]');
  const syncExpectedAdultWeightButtons = () => {
    const inputValue = Number(expectedAdultWeightInput?.value);
    const isUnknown = expectedAdultWeightInput?.dataset.unknown === 'true';
    expectedAdultWeightButtons.forEach(button => {
      const selected = !isUnknown && expectedAdultWeightInput?.value !== ''
        && inputValue === Number(button.dataset.adultWeight);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    expectedAdultWeightUnknownButton?.classList.toggle('is-selected', isUnknown);
    expectedAdultWeightUnknownButton?.setAttribute('aria-pressed', String(isUnknown));
  };
  expectedAdultWeightButtons.forEach(button => {
    button.addEventListener('click', () => {
      delete expectedAdultWeightInput.dataset.unknown;
      expectedAdultWeightInput.value = button.dataset.adultWeight;
      expectedAdultWeightInput.dispatchEvent(new Event('input', { bubbles: true }));
      expectedAdultWeightInput.dispatchEvent(new Event('change', { bubbles: true }));
      expectedAdultWeightInput.focus();
    });
  });
  expectedAdultWeightUnknownButton?.addEventListener('click', () => {
    expectedAdultWeightInput.value = '';
    expectedAdultWeightInput.dataset.unknown = 'true';
    expectedAdultWeightInput.dispatchEvent(new Event('input', { bubbles: true }));
    expectedAdultWeightInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expectedAdultWeightInput?.addEventListener('input', () => {
    if (expectedAdultWeightInput.value !== '') delete expectedAdultWeightInput.dataset.unknown;
    syncExpectedAdultWeightButtons();
  });
  syncExpectedAdultWeightButtons();
  initializeBcsChoices();
}

// -----------------------------------------------
// 비율 슬라이더
// -----------------------------------------------
function getMealRatios(sliderValue) {
  const dryPercent = Math.min(100, Math.max(0, Number(sliderValue)));
  return {
    dryPercent,
    wetPercent: 100 - dryPercent
  };
}

function updateRatio(v) {
  const { dryPercent, wetPercent } = getMealRatios(v);
  document.getElementById('dryPct').textContent = dryPercent;
  document.getElementById('wetPct').textContent = wetPercent;
  document.getElementById('ratioSlider')?.style.setProperty('--ratio-split', `${dryPercent}%`);
  updateFeedingPreview();
}

function setMobileCalculatorStep(index, shouldScroll = true) {
  if (!window.matchMedia('(max-width: 820px)').matches) return;
  const steps = [...document.querySelectorAll('#feedsStep, #petInfoStep, #ratioStep, #resultArea')];
  steps.forEach((step, stepIndex) => {
    step.classList.toggle('pc-mobile-current', stepIndex === index);
    step.classList.toggle('pc-mobile-collapsed', stepIndex !== index && !step.classList.contains('hidden'));
    step.dataset.mobileStepState = stepIndex < index ? 'complete' : stepIndex === index ? 'current' : 'upcoming';
  });
  if (shouldScroll) steps[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initializeMobileCalculatorFlow() {
  if (!window.matchMedia('(max-width: 820px)').matches) return;
  const steps = [...document.querySelectorAll('#feedsStep, #petInfoStep, #ratioStep')];
  if (!steps.length) return;
  ['사료 선택 완료', '반려동물 정보 완료', '이 비율로 계산'].forEach((label, index) => {
    const step = steps[index];
    const heading = step.querySelector('.pc-section-heading');
    const reopen = event => {
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      if (event.type === 'keydown') event.preventDefault();
      setMobileCalculatorStep(index);
    };
    heading?.setAttribute('role', 'button'); heading?.setAttribute('tabindex', '0');
    heading?.addEventListener('click', reopen); heading?.addEventListener('keydown', reopen);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'pc-mobile-step-next'; button.textContent = label;
    button.addEventListener('click', () => index < 2 ? setMobileCalculatorStep(index + 1) : calculate());
    step.appendChild(button);
  });
  setMobileCalculatorStep(0, false);
  updateMobileFeedingSummary();
}

function getTreatKcal() {
  return Math.max(0, Math.round(Number(document.getElementById('treatKcalInput')?.value) || 0));
}

function getSelectedWetEntries() {
  return state.wetSlotIds.map(sid => ({ sid, feed: state.wetFeedMap[sid] })).filter(entry => entry.feed);
}

function getAllocationPreview(foodKcal, dryRatio, wetRatio) {
  const switching = document.getElementById('drySwitching')?.checked;
  const dryFeeds = switching ? state.dryFeeds.filter(Boolean) : [state.dryFeeds[0]].filter(Boolean);
  const dryTotal = switching ? dryFeeds.reduce((sum, _, index) => sum + (Number(document.getElementById(`drySwPct${index + 1}`)?.value) || 0), 0) : 100;
  const dryGrams = dryFeeds.reduce((sum, feed, index) => {
    const share = switching ? (Number(document.getElementById(`drySwPct${index + 1}`)?.value) || 0) / (dryTotal || 100) : 1;
    return sum + Math.round((foodKcal * dryRatio * share) / (feed.kcal / 1000));
  }, 0);
  const wetEntries = getSelectedWetEntries();
  const additionalWetPct = wetEntries.slice(1).reduce((sum, { sid }) => sum + (Number(document.getElementById(`wetPct_${sid}`)?.value) || 0), 0);
  const wetGrams = wetEntries.reduce((sum, { sid, feed }, index) => {
    const share = wetEntries.length === 1 ? 1 : index === 0 ? (100 - additionalWetPct) / 100 : (Number(document.getElementById(`wetPct_${sid}`)?.value) || 0) / 100;
    return sum + Math.round((foodKcal * wetRatio * Math.max(0, share)) / (feed.kcal / 1000));
  }, 0);
  return { dryGrams, wetGrams, dryFeeds, wetEntries };
}

function updateFeedingPreview() {
  const dryName = document.getElementById('ratioDryFeedName');
  const wetName = document.getElementById('ratioWetFeedName');
  const dryFeeds = document.getElementById('drySwitching')?.checked ? state.dryFeeds.filter(Boolean) : [state.dryFeeds[0]].filter(Boolean);
  const wetEntries = getSelectedWetEntries();
  if (dryName) dryName.textContent = dryFeeds.length ? `${dryFeeds[0].name}${dryFeeds.length > 1 ? ` 외 ${dryFeeds.length - 1}개` : ''}` : '선택한 건사료 없음';
  if (wetName) wetName.textContent = wetEntries.length ? `${wetEntries[0].feed.name}${wetEntries.length > 1 ? ` 외 ${wetEntries.length - 1}개` : ''}` : '선택한 습식사료 없음';
  const weight = Number(document.getElementById('catWeight')?.value);
  const birthStr = document.getElementById('catBirth')?.value;
  const neutered = document.getElementById('catNeutered')?.value;
  if (!Number.isFinite(weight) || !birthStr || !['true', 'false'].includes(neutered)) {
    if (document.getElementById('previewDryGrams')) document.getElementById('previewDryGrams').textContent = '—';
    if (document.getElementById('previewWetGrams')) document.getElementById('previewWetGrams').textContent = '—';
    updateMobileFeedingSummary();
    return;
  }
  const species = state.selectedPetSpecies || 'cat';
  const plan = getCaloriePlan(weight, birthStr, neutered === 'true', document.getElementById('isDiet')?.checked, new Date(), species, {
    activity: document.querySelector('input[name="dogActivity"]:checked')?.value || 'normal',
    expectedAdultWeight: Number(document.getElementById('dogExpectedAdultWeight')?.value) || null,
    pregnant: document.getElementById('isPregnant')?.checked,
    lactating: document.getElementById('isLactating')?.checked
  });
  const treatKcal = Math.min(getTreatKcal(), plan.DER);
  const ratios = getMealRatios(document.getElementById('ratioSlider')?.value || 60);
  const preview = getAllocationPreview(plan.DER - treatKcal, ratios.dryPercent / 100, ratios.wetPercent / 100);
  const dryPreview = document.getElementById('previewDryGrams');
  const wetPreview = document.getElementById('previewWetGrams');
  if (dryPreview) dryPreview.textContent = preview.dryFeeds.length ? preview.dryGrams : '—';
  if (wetPreview) wetPreview.textContent = preview.wetEntries.length ? preview.wetGrams : '—';
  updateMobileFeedingSummary({ dryTotalGrams: preview.dryFeeds.length ? preview.dryGrams : '—', wetTotalGrams: preview.wetEntries.length ? preview.wetGrams : '—' });
  const share = document.getElementById('treatKcalShare');
  if (share) share.textContent = `하루 필요 열량의 ${(treatKcal / plan.DER * 100).toFixed(1)}%`;
}

// -----------------------------------------------
// 건사료 교체 토글
// -----------------------------------------------
function toggleDrySwitching() {
  const on   = document.getElementById('drySwitching').checked;
  const area = document.getElementById('dryArea2');
  const wrap = document.getElementById('drySwPctWrap1');
  if (on) {
    area.classList.remove('hidden');
    wrap.classList.remove('hidden');
    wrap.classList.add('flex');
  } else {
    area.classList.add('hidden');
    wrap.classList.remove('flex');
    wrap.classList.add('hidden');
    state.dryFeeds[1] = null;
    document.getElementById('dryInput2').value = '';
    document.getElementById('drySelected2').classList.add('hidden');
  }
  markCalculationDirty();
}

// -----------------------------------------------
// 습식사료 슬롯 추가
// -----------------------------------------------
function addWetSlot() {
  if (state.wetSlotIds.length >= 3) return;

  const slotId  = state.wetSlotIdCounter++;
  const isFirst = state.wetSlotIds.length === 0;
  state.wetSlotIds.push(slotId);

  const slot = document.createElement('div');
  slot.id        = `wetSlot_${slotId}`;
  slot.className = 'relative pc-wet-slot';

  slot.innerHTML = `
    <div class="pc-feed-input-row">
      <input type="text" id="wetInput_${slotId}" placeholder="습식사료 검색..."
        class="flex-1">
      ${!isFirst ? `
        <div class="pc-subratio">
          <input type="number" id="wetPct_${slotId}" value="50" min="0" max="100"
            class="pc-subratio-input">
          <span >%</span>
        </div>
        <button type="button" onclick="removeWetSlot(${slotId})"
          class="pc-remove-feed" aria-label="습식사료 삭제">✕</button>
      ` : ''}
    </div>
    <div class="pc-feed-action-row">
      <button type="button" onclick="openFeedPicker('wet', ${slotId})"
        class="pc-feed-picker-button">제품 목록에서 찾기</button>
      ${isFirst ? '<button type="button" id="recentWetFeedButton" class="pc-recent-feed-button hidden" onclick="selectRecentFeed(\'wet\')"></button>' : ''}
    </div>
    <div id="wetList_${slotId}"
      class="pc-search-list hidden">
    </div>
    <p id="wetSelected_${slotId}" class="pc-selected-feed hidden"></p>
  `;

  document.getElementById('wetSlots').appendChild(slot);

  const input = document.getElementById(`wetInput_${slotId}`);
  input.addEventListener('input', () => searchFeed('wet', input.value, `wetList_${slotId}`, slotId));
  input.addEventListener('focus', () => searchFeed('wet', input.value, `wetList_${slotId}`, slotId));
  const wetRatioInput = document.getElementById(`wetPct_${slotId}`);
  if (wetRatioInput) {
    wetRatioInput.addEventListener('input', markCalculationDirty);
    wetRatioInput.addEventListener('change', markCalculationDirty);
  }

  // Apply the requested preset once, immediately after a slot is added.
  const defaults = getWetDefaultPercentages(state.wetSlotIds.length);
  state.wetSlotIds.slice(1).forEach((id, index) => {
    const ratioInput = document.getElementById(`wetPct_${id}`);
    if (ratioInput) ratioInput.value = String(defaults[index + 1]);
  });
  markCalculationDirty();

  if (state.wetSlotIds.length >= 3) {
    document.getElementById('addWetBtn').classList.add('hidden');
  }
}

function removeWetSlot(slotId) {
  document.getElementById(`wetSlot_${slotId}`)?.remove();
  delete state.wetFeedMap[slotId];
  state.wetSlotIds = state.wetSlotIds.filter(id => id !== slotId);
  document.getElementById('addWetBtn').classList.remove('hidden');
  markCalculationDirty();
}

// -----------------------------------------------
// 급여량 계산
// -----------------------------------------------
function clearCalculatorErrors() {
  document.querySelectorAll('.pc-inline-error:not(#resultDirtyNotice)').forEach(el => { el.textContent = ''; el.classList.add('hidden'); });
  document.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
}

function showCalculatorError(id, message, focusId) {
  const error = document.getElementById(id);
  if (!error) return null;
  error.textContent = message;
  error.classList.remove('hidden');
  const focusTarget = document.getElementById(focusId) || error.closest('.pc-field, .pc-feed-panel');
  focusTarget?.setAttribute('aria-invalid', 'true');
  return focusTarget;
}

function calculate() {
  clearCalculatorErrors();
  const name = document.getElementById('catName').value.trim();
  const weight = Number(document.getElementById('catWeight').value);
  const birthStr = document.getElementById('catBirth').value;
  const neuteredValue = document.getElementById('catNeutered').value;
  const pregnant = document.getElementById('isPregnant').checked;
  const lactating = document.getElementById('isLactating').checked;
  const mealRatios = getMealRatios(document.getElementById('ratioSlider').value);
  const dryRatio = mealRatios.dryPercent / 100;
  const wetRatio = mealRatios.wetPercent / 100;
  const firstErrors = [];
  const species = state.selectedPetSpecies || 'cat';
  const speciesLabel = species === 'dog' ? '강아지' : '고양이';
  const maxWeight = species === 'dog' ? 150 : 20;
  const dietSelected = document.getElementById('isDiet').checked;
  const bcs = Number(document.getElementById('bcsValue')?.value);

  const birth = birthStr ? new Date(`${birthStr}T00:00:00`) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!birthStr) firstErrors.push(showCalculatorError('catBirthError', '생년월일을 입력해 주세요.', 'catBirth'));
  else if (birth > today) firstErrors.push(showCalculatorError('catBirthError', '미래 날짜는 생년월일로 선택할 수 없습니다.', 'catBirth'));
  if (!Number.isFinite(weight) || weight < 0.5 || weight > maxWeight) firstErrors.push(showCalculatorError('catWeightError', `체중은 0.5kg 이상 ${maxWeight}kg 이하로 입력해 주세요.`, 'catWeight'));
  if (!['true', 'false'].includes(neuteredValue)) firstErrors.push(showCalculatorError('catNeuteredError', '중성화 여부를 선택해 주세요.', 'catNeutered'));
  if (dietSelected && ![5, 6, 7, 8, 9].includes(bcs)) firstErrors.push(showCalculatorError('bcsError', '다이어트 계산을 위해 현재 BCS를 선택해 주세요.', 'bcsField'));
  const dogExpectedAdultWeight = Number(document.getElementById('dogExpectedAdultWeight')?.value);
  const dogAdultWeightUnknown = document.getElementById('dogExpectedAdultWeight')?.dataset.unknown === 'true';
  const dogAgeMonths = birth ? getAgeMonths(birth, today) : null;
  const dogNeedsAdultWeight = species === 'dog' && dogAgeMonths !== null && dogAgeMonths < 18;
  if (dogNeedsAdultWeight && !dogAdultWeightUnknown && (!Number.isFinite(dogExpectedAdultWeight) || dogExpectedAdultWeight < weight || dogExpectedAdultWeight > 150)) {
    firstErrors.push(showCalculatorError('dogAdultWeightError', '예상 성견 체중을 선택·입력하거나 ‘모르겠어요’를 눌러 주세요.', 'dogExpectedAdultWeight'));
  }
  if (species === 'cat' && (pregnant || lactating)) firstErrors.push(showCalculatorError('lifeStageError', '고양이 임신·수유 급여 기준은 현재 준비 중입니다.', pregnant ? 'isPregnant' : 'isLactating'));
  if (species === 'dog' && document.getElementById('isDiet').checked && (pregnant || lactating || dogNeedsAdultWeight)) {
    firstErrors.push(showCalculatorError('lifeStageError', '성장기·임신·수유 중에는 체중 감량 모드를 함께 사용할 수 없습니다.', 'isDiet'));
  }
  if (dryRatio > 0 && !state.dryFeeds[0]) firstErrors.push(showCalculatorError('dryFeedError', '건사료 비율이 있으므로 건사료를 선택해 주세요.', 'dryInput1'));
  const firstWetSlotId = state.wetSlotIds[0];
  const firstWetFeed = state.wetFeedMap[firstWetSlotId];
  const hasAdditionalWetFeed = state.wetSlotIds.slice(1).some(slotId => state.wetFeedMap[slotId]);
  if (wetRatio > 0 && hasAdditionalWetFeed && !firstWetFeed) {
    firstErrors.push(showCalculatorError('wetFeedError', '첫 번째 습식사료를 먼저 선택해 주세요.', `wetInput_${firstWetSlotId}`));
  }
  const wetEntries = state.wetSlotIds.map(sid => ({ sid, feed: state.wetFeedMap[sid] })).filter(entry => entry.feed);
  const duplicateDry = state.dryFeeds.filter(Boolean).find((feed, index, feeds) => feed.id != null && feeds.findIndex(item => item.id === feed.id) !== index);
  const duplicateWet = wetEntries.find((entry, index, entries) => entry.feed.id != null && entries.findIndex(item => item.feed.id === entry.feed.id) !== index);
  if (duplicateDry) firstErrors.push(showCalculatorError('dryFeedError', '이미 선택한 건사료입니다. 다른 제품을 선택해 주세요.', 'dryInput2'));
  if (duplicateWet) firstErrors.push(showCalculatorError('wetFeedError', '이미 선택한 습식사료입니다. 다른 제품을 선택해 주세요.', `wetInput_${duplicateWet.sid}`));
  if (wetRatio > 0 && wetEntries.length === 0) firstErrors.push(showCalculatorError('wetFeedError', '습식사료 비율이 있으므로 습식사료를 선택해 주세요.', `wetInput_${state.wetSlotIds[0]}`));
  const wetRatioValues = wetEntries.slice(1).map(entry => ({
    entry,
    input: document.getElementById(`wetPct_${entry.sid}`),
    rawValue: document.getElementById(`wetPct_${entry.sid}`)?.value ?? '',
    value: Number(document.getElementById(`wetPct_${entry.sid}`)?.value)
  }));
  const invalidWetRatio = wetRatioValues.find(({ rawValue, value }) => rawValue.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100);
  if (invalidWetRatio) {
    firstErrors.push(showCalculatorError('wetRatioError', '습식사료별 비율은 0% 이상 100% 이하의 숫자로 입력해 주세요.', `wetPct_${invalidWetRatio.entry.sid}`));
  }
  const additionalWetPct = wetRatioValues.reduce((sum, { value }) => sum + (Number.isFinite(value) ? value : 0), 0);
  if (!invalidWetRatio && wetEntries.length > 1 && additionalWetPct > 100) {
    firstErrors.push(showCalculatorError('wetRatioError', '추가한 습식사료의 비율 합계는 100%를 넘을 수 없습니다.', `wetPct_${wetEntries[1].sid}`));
  }
  const firstError = firstErrors.find(Boolean);
  if (firstError) { firstError.scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(() => firstError.focus?.({ preventScroll: true }), 250); return; }

  const diet = dietSelected;
  const caloriePlan = getCaloriePlan(weight, birthStr, neuteredValue === 'true', diet, new Date(), species, {
    activity: document.querySelector('input[name="dogActivity"]:checked')?.value || 'normal',
    expectedAdultWeight: dogAdultWeightUnknown ? null : dogExpectedAdultWeight,
    pregnant,
    lactating
  });
  const { DER } = caloriePlan;
  const legacyTreatPct = Number(document.querySelector('input[name="treatReservePct"]:checked')?.value || 0) / 100;
  const requestedTreatKcal = document.getElementById('treatKcalInput') ? getTreatKcal() : Math.round(DER * legacyTreatPct);
  const treatKcal = Math.min(requestedTreatKcal, DER);
  const treatReservePct = DER > 0 ? treatKcal / DER : 0;
  const foodKcal = DER - treatKcal;
  const switching = document.getElementById('drySwitching').checked;
  const resultData = { 건사료_결과: [], 습식사료_결과: [] };
  const resultCards = [];
  const dryFeeds = switching ? state.dryFeeds.filter(Boolean) : [state.dryFeeds[0]].filter(Boolean);
  const totalDrySubPct = switching ? dryFeeds.reduce((sum, _, i) => sum + (Number(document.getElementById(`drySwPct${i + 1}`)?.value) || 0), 0) : 100;
  dryFeeds.forEach((feed, index) => {
    const subPct = switching ? (Number(document.getElementById(`drySwPct${index + 1}`)?.value) || 0) / (totalDrySubPct || 100) : 1;
    const kcal = foodKcal * dryRatio * subPct;
    const grams = Math.round(kcal / (feed.kcal / 1000));
    if (grams > 0 || kcal > 0) resultData.건사료_결과.push({ 이름: feed.name, 급여량_g: grams, 담당칼로리: Math.round(kcal), 비율: Math.round(dryRatio * subPct * 100), 에너지기준_칼슘: feed.ebCa, 에너지기준_인: feed.ebP, 수분_pct: feed.moisture });
  });
  wetEntries.forEach(({ sid, feed }, index) => {
    let subPct;
    if (wetEntries.length === 1) subPct = 1;
    else if (index === 0) subPct = (100 - additionalWetPct) / 100;
    else subPct = Number(document.getElementById(`wetPct_${sid}`)?.value || 0) / 100;
    const kcal = foodKcal * wetRatio * subPct;
    const grams = Math.round(kcal / (feed.kcal / 1000));
    if (grams > 0 || kcal > 0) resultData.습식사료_결과.push({ 이름: feed.name, 급여량_g: grams, 담당칼로리: Math.round(kcal), 비율: Math.round(wetRatio * subPct * 100), 에너지기준_칼슘: feed.ebCa, 에너지기준_인: feed.ebP, 수분_pct: feed.moisture });
  });
  [...resultData.건사료_결과.map(item => ({...item, type:'건사료'})), ...resultData.습식사료_결과.map(item => ({...item, type:'습식사료'}))].forEach((item, index) => resultCards.push(`<article class="pc-result-card pc-result-card--${item.type === '건사료' ? 'dry' : 'wet'}"><span class="pc-feed-index">${String(index + 1).padStart(2, '0')}</span><div><span>${item.type === '건사료' ? 'DRY FOOD' : 'WET FOOD'}</span><h3>${item.이름}</h3><p>${item.담당칼로리} kcal · 식단 ${item.비율}%</p></div><strong>${item.급여량_g}<small>g</small></strong></article>`));
  const dryTotalGrams = resultData.건사료_결과.reduce((sum, item) => sum + item.급여량_g, 0);
  const wetTotalGrams = resultData.습식사료_결과.reduce((sum, item) => sum + item.급여량_g, 0);
  document.getElementById('resultTitle').textContent = '하루 급여 계획';
  document.getElementById('planPetName').textContent = name || (species === 'dog' ? '내 강아지' : '내 고양이');
  document.getElementById('planPetProfile').textContent = [weight ? `${weight} kg` : '', species === 'dog' ? 'DOG' : 'CAT'].filter(Boolean).join(' · ');
  const resultDate = new Date();
  document.getElementById('planDate').textContent = `${resultDate.getFullYear()}.${String(resultDate.getMonth() + 1).padStart(2, '0')}.${String(resultDate.getDate()).padStart(2, '0')}`;
  document.getElementById('resDER').textContent = DER;
  document.getElementById('resFoodKcal').textContent = foodKcal;
  document.getElementById('resTreatKcal').textContent = treatKcal;
  document.getElementById('resTreatRow').classList.toggle('hidden', treatKcal === 0);
  document.getElementById('resItems').innerHTML = resultCards.join('');
  renderCompactPlanAnalysis(resultData, weight);
  updateMobileFeedingSummary({ dryTotalGrams, wetTotalGrams, complete: true });
  renderDogCalculationContext(species, caloriePlan, [...dryFeeds, ...wetEntries.map(entry => entry.feed)]);
  const warningAllocations = [
    ...dryFeeds.map((feed, index) => ({ feed, share: dryRatio * (switching ? (Number(document.getElementById(`drySwPct${index + 1}`)?.value) || 0) / (totalDrySubPct || 100) : 1) })),
    ...wetEntries.map(({ sid, feed }, index) => ({ feed, share: wetRatio * (wetEntries.length === 1 ? 1 : index === 0 ? (100 - additionalWetPct) / 100 : Number(document.getElementById(`wetPct_${sid}`)?.value || 0) / 100) }))
  ];
  renderDietWarnings({ species, plan: caloriePlan, allocations: warningAllocations, treatKcal, diet, bcs });
  document.getElementById('resultArea').classList.remove('hidden');
  const capResult = document.getElementById('capResult');
  const waterResult = document.getElementById('waterResult');
  capResult.classList.add('hidden');
  capResult.innerHTML = '';
  waterResult.classList.add('hidden');
  waterResult.innerHTML = '';
  document.getElementById('capBtn').setAttribute('aria-expanded', 'false');
  document.getElementById('waterBtn').setAttribute('aria-expanded', 'false');
  state.lastResult = { species, DER, foodKcal, treatReservePct, treatKcal, dryRatio, wetRatio, caloriePlan, bcs: diet ? bcs : null, ...resultData };
  markCalculationFresh();
  state.lastSavedResultKey = null;
  updateSaveFeedingButtonVisibility();
  const resultArea = document.getElementById('resultArea');
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  resultArea.focus({ preventScroll: true });
  setMobileCalculatorStep(3, false);
}

function renderCompactPlanAnalysis(resultData, weight) {
  const feeds = [...resultData.건사료_결과, ...resultData.습식사료_결과];
  let calcium = 0, phosphorus = 0, water = 0;
  feeds.forEach(feed => {
    if (feed.에너지기준_칼슘 > 0 && feed.에너지기준_인 > 0) {
      calcium += feed.에너지기준_칼슘 * feed.담당칼로리;
      phosphorus += feed.에너지기준_인 * feed.담당칼로리;
    }
    if (feed.수분_pct > 0) water += feed.급여량_g * feed.수분_pct / 100;
  });
  const ratio = phosphorus > 0 ? calcium / phosphorus : null;
  const ratioOk = ratio !== null && ratio >= 1 && ratio <= 2;
  document.getElementById('planCapRatio').textContent = ratio === null ? '데이터 없음' : `${ratio.toFixed(2)} : 1`;
  document.getElementById('planCapStatus').textContent = ratio === null ? '' : (ratioOk ? '정상' : '확인 필요');
  const intake = Math.round(water * 10) / 10;
  const needMin = Math.round(weight * 44);
  const needMax = Math.round(weight * 55);
  const rate = needMin > 0 ? Math.round(intake / needMin * 100) : 0;
  document.getElementById('planWaterIntake').textContent = `${intake} ml`;
  document.getElementById('planWaterNeed').textContent = `필요 ${needMin}–${needMax} ml`;
  document.getElementById('planWaterRate').textContent = `${rate}%`;
}

function updateMobileFeedingSummary({ dryTotalGrams = null, wetTotalGrams = null, complete = false } = {}) {
  let bar = document.getElementById('mobileFeedingSummary');
  if (!bar) {
    bar = document.createElement('aside');
    bar.id = 'mobileFeedingSummary';
    bar.className = 'pc-mobile-feeding-summary';
    bar.setAttribute('aria-live', 'polite');
    document.body.appendChild(bar);
  }
  const dry = dryTotalGrams ?? document.getElementById('previewDryGrams')?.textContent ?? '—';
  const wet = wetTotalGrams ?? document.getElementById('previewWetGrams')?.textContent ?? '—';
  bar.innerHTML = `<span>${complete ? 'CALCULATED PLAN' : 'LIVE FEEDING AMOUNT'}</span><div><p>DRY <strong>${dry}<small>g</small></strong></p><p>WET <strong>${wet}<small>g</small></strong></p></div>`;
  bar.classList.toggle('is-complete', complete);
}

function renderDietWarnings({ species, plan, allocations, treatKcal, diet, bcs }) {
  const container = document.getElementById('dietWarnings');
  if (!container) return;
  const feeds = allocations.map(item => item.feed);
  const warnings = new Set();
  const ageText = feeds.map(feed => `${feed.name || ''} ${feed.lifeStage || ''}`).join(' ');
  const growing = species === 'dog' ? plan.isGrowing : plan.months < 12;
  const ageMismatch = growing
    ? /시니어|senior|노령|adult|어덜트/i.test(ageText)
    : /키튼|kitten|퍼피|puppy|성장기|growth/i.test(ageText);
  if (ageMismatch) {
    warnings.add('이 제품은 현재 반려동물의 생애단계와 맞는지 확인이 필요합니다.');
    warnings.add('선택한 사료 중 현재 나이와 맞지 않을 수 있는 제품이 있습니다.');
  }
  const nonCompleteLarge = allocations.some(({ feed, share }) => !/^(주식|완전식)$/i.test(String(feed.complete || '').trim()) && share >= 0.5);
  if (nonCompleteLarge) {
    warnings.add('완전식 여부가 확인되지 않은 제품이 하루 열량의 50%를 차지합니다.');
  }
  const nonStapleLarge = allocations.some(({ feed, share }) => /보조식|간식|토핑/i.test(String(feed.complete || '')) && share >= 0.3);
  if (nonStapleLarge) {
    warnings.add('주식이 아닌 제품이 식단에서 큰 비중을 차지합니다. 장기 급여 전 제품 용도를 확인해 주세요.');
  }
  if (feeds.some(feed => feed.estimatedCalories)) warnings.add('제조사 공식 열량이 아닌 추정 열량을 사용하는 제품이 포함되어 있습니다.');
  if (feeds.some(feed => feed.needsCalorieReview)) warnings.add('열량 재검토가 필요한 제품이 포함되어 있어 급여량은 참고용으로 확인해 주세요.');
  if (plan.DER > 0 && treatKcal / plan.DER > 0.1) warnings.add('간식 열량 비중이 높습니다. 주식 급여량이 줄어들 수 있습니다.');
  if (diet && bcs === 5) warnings.add('현재 선택한 BCS 5는 이상적인 체형입니다. 감량보다 유지가 적절할 수 있습니다.');
  container.innerHTML = [...warnings].map(message => `<li>${message}</li>`).join('');
  container.closest('.pc-diet-warning-box')?.classList.toggle('hidden', warnings.size === 0);
}

function renderDogCalculationContext(species, plan, selectedFeeds) {
  const lead = document.getElementById('resultLead');
  const basis = document.getElementById('dogCalculationBasis');
  const basisContent = document.getElementById('dogCalculationBasisContent');
  const warnings = document.getElementById('dogConditionalWarnings');
  const isDog = species === 'dog';

  lead.classList.toggle('hidden', !isDog);
  basis.classList.toggle('hidden', !isDog);
  warnings.classList.add('hidden');
  warnings.innerHTML = '';
  if (!isDog) return;

  lead.textContent = '현재 나이와 체중, 성장 상태를 반영한 하루 시작 열량입니다.';
  const ratioCopy = plan.weightRatio == null ? '' : ` · 현재 체중은 예상 성견 체중의 ${Math.round(plan.weightRatio * 100)}%`;
  const calculationCopy = plan.expectedAdultWeight
    ? `FEDIAF 성장기 공식 · 현재 체중 기준 계수 ${plan.factor.toFixed(2)}`
    : `예상 성견 체중 미확인 · 월령 기준 임시 계수 ${plan.factor.toFixed(2)}`;
  basisContent.innerHTML = `<p><strong>${plan.label}</strong>${ratioCopy}</p><p>정확한 월령 ${plan.months.toFixed(1)}개월 · 현재 체중 기준 RER ${Math.round(plan.RER)} kcal · ${calculationCopy}</p>${plan.dietNotice ? `<p>${plan.dietNotice}</p>` : ''}`;

  const warningItems = [];
  if (plan.isGrowing && (plan.expectedAdultWeight || 0) >= 25) {
    warningItems.push('대형견 성장기에는 칼슘을 임의로 추가하지 말고, 대형견 성장기용 완전사료의 권장 급여량을 우선 확인하세요.');
  }
  const rawOrBone = selectedFeeds.some(feed => /생식|raw|뼈|bone/i.test(`${feed.name || ''} ${feed.ingredients || ''}`));
  if (rawOrBone) {
    warningItems.push('생식 또는 뼈 포함 가능성이 있는 식단입니다. 칼슘·인 수치는 제품 자료를 확인하고, 뼈나 칼슘제를 별도로 더하지 마세요.');
  }
  if (warningItems.length) {
    warnings.innerHTML = warningItems.map(item => `<p>${item}</p>`).join('');
    warnings.classList.remove('hidden');
  }
}

if (typeof window !== 'undefined') window.addEventListener('DOMContentLoaded', () => {
  const calculatorPage = document.getElementById('calculatorPage');
  const feedsStep = document.getElementById('feedsStep');
  const petInfoStep = document.getElementById('petInfoStep');
  if (calculatorPage && feedsStep && petInfoStep) calculatorPage.insertBefore(feedsStep, petInfoStep);

  const resultLabel = document.querySelector('#resultArea > .pc-section-title');
  if (resultLabel) resultLabel.innerHTML = '<span>04</span> 오늘의 급여 계획';
  const shareButton = document.getElementById('openShareModalBtn');
  if (shareButton) shareButton.textContent = '이 문서 저장·공유';
  updateMobileFeedingSummary();

  const treatInput = document.getElementById('treatKcalInput');
  const changeTreat = amount => {
    treatInput.value = String(Math.max(0, (Number(treatInput.value) || 0) + amount));
    markCalculationDirty();
  };
  document.getElementById('treatKcalMinus')?.addEventListener('click', () => changeTreat(-5));
  document.getElementById('treatKcalPlus')?.addEventListener('click', () => changeTreat(5));
  treatInput?.addEventListener('input', markCalculationDirty);

  ['catBirth', 'catWeight', 'catNeutered', 'isDiet', 'isPregnant', 'isLactating', 'dogExpectedAdultWeight']
    .forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateFeedingPreview);
      document.getElementById(id)?.addEventListener('change', updateFeedingPreview);
    });
  document.querySelectorAll('input[name="dogActivity"]').forEach(input => input.addEventListener('change', updateFeedingPreview));
  updateRatio(document.getElementById('ratioSlider')?.value || 60);
  initializeMobileCalculatorFlow();
});

// -----------------------------------------------
// 칼슘/인 분석
// -----------------------------------------------
function analyzeCaP() {
  if (!state.lastResult) return;

  const NRC = state.selectedPetSpecies === 'dog'
    ? { 칼슘_권장: 1250, 인_권장: 1000, 비율_최소: 1.0, 비율_상한: 2.0, 기준: 'NRC 성견' }
    : { 칼슘_권장: 280, 인_권장: 250, 비율_최소: 1.0, 비율_상한: 2.0, 기준: 'NRC 성묘' };
  const 모든사료 = [
    ...state.lastResult.건사료_결과.map(s => ({ ...s, 종류: '건사료' })),
    ...state.lastResult.습식사료_결과.map(s => ({ ...s, 종류: '습식사료' }))
  ];

  let 총칼슘 = 0, 총인 = 0;
  const 결과목록 = [], 제외목록 = [];

  모든사료.forEach(s => {
    if (s.에너지기준_칼슘 && s.에너지기준_인 && s.에너지기준_칼슘 > 0) {
      const ca = s.에너지기준_칼슘 * s.담당칼로리;
      const p  = s.에너지기준_인   * s.담당칼로리;
      총칼슘 += ca; 총인 += p;
      결과목록.push({ ...s, ca_mg: Math.round(ca), p_mg: Math.round(p) });
    } else {
      제외목록.push(s.이름);
    }
  });

  const ratio = 총인 > 0 ? (총칼슘 / 총인).toFixed(2) : null;
  const caOk  = 총칼슘 >= NRC.칼슘_권장 * (state.lastResult.DER / 1000);
  const pOk   = 총인   >= NRC.인_권장   * (state.lastResult.DER / 1000);
  const rOk   = ratio  && parseFloat(ratio) >= NRC.비율_최소 && parseFloat(ratio) <= NRC.비율_상한;

  const sc = ok => ok ? 'is-ok' : 'is-check';
  const st = ok => ok ? '정상' : '확인 필요';
  const analysisIcon = '<svg class="pc-analysis-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M8 12h8M12 8v8"></path></svg>';

  const html = `
    <div class="pc-analysis-result pc-analysis-result--cap">
      <h3>${analysisIcon}<span>칼슘 · 인 분석</span></h3>
      <div class="pc-analysis-metrics">
        <div>
          <span>칼슘 섭취량</span><strong>${Math.round(총칼슘)} <small>mg/day</small></strong><em class="${sc(caOk)}">${st(caOk)}</em>
        </div>
        <div>
          <span>인 섭취량</span><strong>${Math.round(총인)} <small>mg/day</small></strong><em class="${sc(pOk)}">${st(pOk)}</em>
        </div>
      </div>
      <div class="pc-analysis-ratio">
        <span>칼슘 : 인 비율</span><strong class="${sc(rOk)}">${ratio ? ratio + ' : 1' : '계산 불가'}</strong><small>참고 범위 ${NRC.비율_최소}–${NRC.비율_상한} : 1 · ${ratio ? st(rOk) : '데이터 없음'}</small>
      </div>
      ${결과목록.map(s => `
        <div class="pc-analysis-row">
          <span>${s.이름}</span><strong>Ca ${s.ca_mg}mg · P ${s.p_mg}mg</strong>
        </div>`).join('')}
      ${제외목록.length ? `<p class="pc-analysis-note">데이터 없어 제외: ${제외목록.join(', ')}</p>` : ''}
      <p class="pc-analysis-note">${NRC.기준} 기준 참고값입니다.</p>
    </div>`;

  document.getElementById('capResult').innerHTML = html;
  document.getElementById('capResult').classList.remove('hidden');
  document.getElementById('capBtn').setAttribute('aria-expanded', 'true');
  document.getElementById('capResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

if (typeof window !== 'undefined') {
  window.updateCalculatorSpeciesCopy = updateCalculatorSpeciesCopy;
}

// -----------------------------------------------
// 수분 섭취량 분석
// -----------------------------------------------
function analyzeWater() {
  if (!state.lastResult) return;

  const weight    = parseFloat(document.getElementById('catWeight').value) || 0;
  const 권장_최소 = Math.round(weight * 44);
  const 권장_최대 = Math.round(weight * 55);
  const 모든사료 = [
    ...state.lastResult.건사료_결과.map(s => ({ ...s, 종류: '건사료' })),
    ...state.lastResult.습식사료_결과.map(s => ({ ...s, 종류: '습식사료' }))
  ];

  let 총수분_ml = 0;
  const 결과목록 = [], 제외목록 = [];

  모든사료.forEach(s => {
    if (s.수분_pct != null && s.수분_pct > 0) {
      const water_ml = parseFloat(((s.급여량_g * s.수분_pct) / 100).toFixed(1));
      총수분_ml += water_ml;
      결과목록.push({ ...s, water_ml });
    } else {
      제외목록.push(s.이름);
    }
  });

  총수분_ml = parseFloat(총수분_ml.toFixed(1));
  const ok         = 총수분_ml >= 권장_최소;
  const 부족분     = ok ? 0 : Math.round(권장_최소 - 총수분_ml);
  const 충족률     = 권장_최소 > 0 ? Math.round((총수분_ml / 권장_최소) * 100) : 0;
  const gaugeColor = 충족률 >= 100 ? '#22c55e' : 충족률 >= 70 ? '#f59e0b' : '#ef4444';
  const gaugeWidth = Math.min(충족률, 100);

  let statusMsg;
  if (총수분_ml === 0 && 결과목록.length === 0) statusMsg = '수분 데이터가 있는 사료가 없습니다.';
  else if (ok) statusMsg = '사료를 통한 수분 섭취가 참고 최소치를 충족합니다.';
  else statusMsg = `물그릇으로 약 ${부족분}ml 이상 추가 섭취를 권장합니다.`;

  const waterIcon = '<svg class="pc-analysis-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"></path></svg>';

  const html = `
    <div class="pc-analysis-result pc-analysis-result--water">
      <h3>${waterIcon}<span>수분 섭취량 분석</span></h3>
      <div class="pc-water-summary"><div><span>사료를 통한 수분 섭취</span><strong>${총수분_ml}<small>ml</small></strong></div><div><span>참고 범위</span><strong>${권장_최소}–${권장_최대}<small>ml</small></strong><small>체중 ${weight}kg 기준</small></div><div><span>충족 비율</span><strong>${충족률}<small>%</small></strong></div></div>
      <div class="pc-water-gauge"><i style="width:${gaugeWidth}%;background:${gaugeColor}"></i></div><p class="pc-water-status">${충족률}% · ${statusMsg}</p>
      ${결과목록.length > 0 ? `<div class="pc-analysis-rows">
        ${결과목록.map(s => {
          const barColor = s.종류 === '습식사료' ? '#3D8BFF' : '#FF9F43';
          return `<div class="pc-analysis-row" style="--feed-color:${barColor}"><span><small>${s.종류}</small>${s.이름}</span><strong>${s.water_ml}ml<small>${s.수분_pct}% × ${s.급여량_g}g</small></strong></div>`;
        }).join('')}
      </div>` : ''}
      ${제외목록.length ? `<p class="pc-analysis-note">수분 데이터 없어 제외: ${제외목록.join(', ')}</p>` : ''}
      <p class="pc-analysis-note">WSAVA 성묘 권장 수분 44–55ml/kg/day 참고값이며 물그릇 음수량은 포함하지 않습니다.</p>
    </div>`;

  document.getElementById('waterResult').innerHTML = html;
  document.getElementById('waterResult').classList.remove('hidden');
  document.getElementById('waterBtn').setAttribute('aria-expanded', 'true');
  document.getElementById('waterResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
