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
    factor = growth.factor;
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

  const DER = Math.round(RER * factor);
  return {
    DER, RER, months, ageDays, factor, label, stage, isGrowing, expectedAdultWeight,
    weightRatio, transitionMonths,
    detail: `RER ${Math.round(RER)} × ${factor.toFixed(2)} (${label})`,
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

  if (months < 4) {
    f_age = 2.75; label = '초기 성장기';
  } else if (months < 9) {
    f_age = 2.1; label = '중기 성장기';
  } else if (months < 12) {
    f_age = 1.9; label = '후기 성장기';
  } else if (months >= 132) {
    f_age = 1.1; label = '노령묘';
  } else {
    f_age = neutered ? 1.2 : 1.4;
    label = neutered ? '중성화 성묘' : '비중성화 성묘';
  }

  const isLateGrowth = months >= 9 && months < 12;
  const f_neuter = months < 12 && neutered ? 0.85 : 1.0;
  const f_diet = diet ? 0.9 : 1.0;

  let DER;
  let detail;
  let dietNotice = '';

  if (diet) {
    let finalFactor;
    let finalLabel;

    if (isLateGrowth && neutered) {
      finalFactor = 1.25;
      finalLabel = '후기 성장기 · 중성화 · 체중관리';
      dietNotice = '후기 성장기 고양이는 성장에 필요한 에너지가 남아 있어, 다이어트 모드에서는 성장기 계수를 그대로 곱하지 않고 체중관리 기준으로 계산합니다.';
    } else {
      finalFactor = f_age * f_neuter * f_diet;
      finalLabel = `${label}${f_neuter < 1 ? ' · 중성화' : ''} · 다이어트`;
    }

    DER = Math.round(RER * finalFactor);
    detail = `RER ${Math.round(RER)} × ${finalFactor} (${finalLabel})`;
  } else {
    DER = Math.round(RER * f_age * f_neuter);
    detail = `RER ${Math.round(RER)} × ${f_age} (${label})`;
    if (f_neuter < 1) detail += ` × ${f_neuter} (중성화)`;
  }

  return { DER, RER, months, f_age, f_neuter, f_diet, label, detail, dietNotice };
}

if (typeof module !== 'undefined') {
  module.exports = { getAgeMonths, getDogAdultTransitionMonths, getDogGrowthFactor, getDogCaloriePlan, getCaloriePlan, getMealRatios };
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

  if (nameLabel) nameLabel.textContent = `${speciesLabel} 이름`;
  if (weightInput) weightInput.max = isDog ? '150' : '20';
  document.getElementById('dogActivityField')?.classList.toggle('hidden', !isDog);
  document.querySelectorAll('[data-pet-species-copy]').forEach(element => {
    element.textContent = speciesLabel;
  });
  updateDogConditionalFields();
}

function updateDogConditionalFields() {
  const isDog = (state.selectedPetSpecies || 'cat') === 'dog';
  const birthValue = document.getElementById('catBirth')?.value;
  const birth = birthValue ? new Date(`${birthValue}T00:00:00`) : null;
  const months = birth && !Number.isNaN(birth.getTime()) ? getAgeMonths(birth) : null;
  const expectedAdultWeight = Number(document.getElementById('dogExpectedAdultWeight')?.value) || 25;
  const growthLimit = getDogAdultTransitionMonths(expectedAdultWeight);
  document.getElementById('dogAdultWeightField')?.classList.toggle('hidden', !(isDog && months !== null && months < growthLimit));
}

function markCalculationDirty() {
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
  const syncExpectedAdultWeightButtons = () => {
    const inputValue = Number(expectedAdultWeightInput?.value);
    expectedAdultWeightButtons.forEach(button => {
      const selected = expectedAdultWeightInput?.value !== ''
        && inputValue === Number(button.dataset.adultWeight);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };
  expectedAdultWeightButtons.forEach(button => {
    button.addEventListener('click', () => {
      expectedAdultWeightInput.value = button.dataset.adultWeight;
      expectedAdultWeightInput.dispatchEvent(new Event('input', { bubbles: true }));
      expectedAdultWeightInput.dispatchEvent(new Event('change', { bubbles: true }));
      expectedAdultWeightInput.focus();
    });
  });
  expectedAdultWeightInput?.addEventListener('input', syncExpectedAdultWeightButtons);
  syncExpectedAdultWeightButtons();
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

  if (!name) firstErrors.push(showCalculatorError('catNameError', `${speciesLabel} 이름을 입력해 주세요.`, 'catName'));
  const birth = birthStr ? new Date(`${birthStr}T00:00:00`) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!birthStr) firstErrors.push(showCalculatorError('catBirthError', '생년월일을 입력해 주세요.', 'catBirth'));
  else if (birth > today) firstErrors.push(showCalculatorError('catBirthError', '미래 날짜는 생년월일로 선택할 수 없습니다.', 'catBirth'));
  if (!Number.isFinite(weight) || weight < 0.5 || weight > maxWeight) firstErrors.push(showCalculatorError('catWeightError', `체중은 0.5kg 이상 ${maxWeight}kg 이하로 입력해 주세요.`, 'catWeight'));
  if (!['true', 'false'].includes(neuteredValue)) firstErrors.push(showCalculatorError('catNeuteredError', '중성화 여부를 선택해 주세요.', 'catNeutered'));
  const dogExpectedAdultWeight = Number(document.getElementById('dogExpectedAdultWeight')?.value);
  const dogAgeMonths = birth ? getAgeMonths(birth, today) : null;
  const dogNeedsAdultWeight = species === 'dog' && dogAgeMonths !== null &&
    dogAgeMonths < getDogAdultTransitionMonths(dogExpectedAdultWeight || 25);
  if (dogNeedsAdultWeight && (!Number.isFinite(dogExpectedAdultWeight) || dogExpectedAdultWeight < weight || dogExpectedAdultWeight > 150)) {
    firstErrors.push(showCalculatorError('dogAdultWeightError', '예상 성견 체중은 현재 체중 이상, 150kg 이하로 입력해 주세요.', 'dogExpectedAdultWeight'));
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

  const diet = document.getElementById('isDiet').checked;
  const caloriePlan = getCaloriePlan(weight, birthStr, neuteredValue === 'true', diet, new Date(), species, {
    activity: document.querySelector('input[name="dogActivity"]:checked')?.value || 'normal',
    expectedAdultWeight: dogExpectedAdultWeight,
    pregnant,
    lactating
  });
  const { DER } = caloriePlan;
  const selectedTreatReservePct = document.querySelector('input[name="treatReservePct"]:checked')?.value || '0';
  const treatReservePct = Number(selectedTreatReservePct) / 100;
  const treatKcal = Math.round(DER * treatReservePct);
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
    resultData.건사료_결과.push({ 이름: feed.name, 급여량_g: grams, 담당칼로리: Math.round(kcal), 비율: Math.round(dryRatio * subPct * 100), 에너지기준_칼슘: feed.ebCa, 에너지기준_인: feed.ebP, 수분_pct: feed.moisture });
  });
  wetEntries.forEach(({ sid, feed }, index) => {
    let subPct;
    if (wetEntries.length === 1) subPct = 1;
    else if (index === 0) subPct = (100 - additionalWetPct) / 100;
    else subPct = Number(document.getElementById(`wetPct_${sid}`)?.value || 0) / 100;
    const kcal = foodKcal * wetRatio * subPct;
    const grams = Math.round(kcal / (feed.kcal / 1000));
    resultData.습식사료_결과.push({ 이름: feed.name, 급여량_g: grams, 담당칼로리: Math.round(kcal), 비율: Math.round(wetRatio * subPct * 100), 에너지기준_칼슘: feed.ebCa, 에너지기준_인: feed.ebP, 수분_pct: feed.moisture });
  });
  [...resultData.건사료_결과.map(item => ({...item, type:'건사료'})), ...resultData.습식사료_결과.map(item => ({...item, type:'습식사료'}))].forEach(item => resultCards.push(`<article class="pc-result-card pc-result-card--${item.type === '건사료' ? 'dry' : 'wet'}"><div><span>${item.type}</span><h3>${item.이름}</h3><p>전체 식단의 ${item.비율}%</p></div><div><strong>${item.급여량_g}g</strong><p>${item.담당칼로리} kcal</p></div></article>`));
  document.getElementById('resCatName').textContent = name;
  document.getElementById('resDER').textContent = DER;
  document.getElementById('resFoodKcal').textContent = foodKcal;
  document.getElementById('resTreatKcal').textContent = treatKcal;
  document.getElementById('resTreatRow').classList.toggle('hidden', treatKcal === 0);
  document.getElementById('resItems').innerHTML = resultCards.join('');
  renderDogCalculationContext(species, caloriePlan, [...dryFeeds, ...wetEntries.map(entry => entry.feed)]);
  document.getElementById('resultArea').classList.remove('hidden');
  const capResult = document.getElementById('capResult');
  const waterResult = document.getElementById('waterResult');
  capResult.classList.add('hidden');
  capResult.innerHTML = '';
  waterResult.classList.add('hidden');
  waterResult.innerHTML = '';
  document.getElementById('capBtn').setAttribute('aria-expanded', 'false');
  document.getElementById('waterBtn').setAttribute('aria-expanded', 'false');
  state.lastResult = { species, DER, foodKcal, treatReservePct, treatKcal, dryRatio, wetRatio, caloriePlan, ...resultData };
  markCalculationFresh();
  state.lastSavedResultKey = null;
  updateSaveFeedingButtonVisibility();
  const resultArea = document.getElementById('resultArea');
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  resultArea.focus({ preventScroll: true });
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
  basisContent.innerHTML = `<p><strong>${plan.label}</strong>${ratioCopy}</p><p>정확한 월령 ${plan.months.toFixed(1)}개월 · 현재 체중 기준 RER ${Math.round(plan.RER)} kcal · 적용 계수 ${plan.factor.toFixed(2)}</p>${plan.dietNotice ? `<p>${plan.dietNotice}</p>` : ''}`;

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

  const sc = ok => ok ? 'text-green-500' : 'text-red-400';
  const st = ok => ok ? '✅ 정상' : '⚠️ 확인필요';

  const html = `
    <div class="p-6 bg-gray-50 rounded-3xl space-y-4">
      <h3 class="font-black text-gray-800">📊 칼슘 · 인 분석</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-white p-4 rounded-2xl text-center">
          <p class="text-xs text-gray-400 mb-1">칼슘 섭취량</p>
          <p class="text-2xl font-black">${Math.round(총칼슘)}</p>
          <p class="text-xs text-gray-400">mg / day</p>
          <p class="text-xs font-bold mt-1 ${sc(caOk)}">${st(caOk)}</p>
        </div>
        <div class="bg-white p-4 rounded-2xl text-center">
          <p class="text-xs text-gray-400 mb-1">인 섭취량</p>
          <p class="text-2xl font-black">${Math.round(총인)}</p>
          <p class="text-xs text-gray-400">mg / day</p>
          <p class="text-xs font-bold mt-1 ${sc(pOk)}">${st(pOk)}</p>
        </div>
      </div>
      <div class="bg-white p-4 rounded-2xl text-center">
        <p class="text-xs text-gray-400 mb-1">칼슘 : 인 비율</p>
        <p class="text-3xl font-black ${rOk ? 'text-green-500' : 'text-red-400'}">${ratio ? ratio + ' : 1' : '계산불가'}</p>
        <p class="text-xs text-gray-400 mt-1">정상 범위 ${NRC.비율_최소} ~ ${NRC.비율_상한} : 1</p>
      </div>
      ${결과목록.map(s => `
        <div class="flex justify-between text-sm py-2 border-b border-gray-100">
          <span class="font-bold text-gray-600">${s.이름}</span>
          <span class="text-gray-400">Ca ${s.ca_mg}mg · P ${s.p_mg}mg</span>
        </div>`).join('')}
      ${제외목록.length ? `<p class="text-xs text-gray-300">※ 데이터 없어 제외: ${제외목록.join(', ')}</p>` : ''}
      <p class="text-xs text-gray-300 leading-relaxed">※ ${NRC.기준} 기준 참고값입니다.</p>
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
  if (총수분_ml === 0 && 결과목록.length === 0) {
    statusMsg = `<p class="text-sm text-gray-400 text-center py-2">수분 데이터가 있는 사료가 없습니다.</p>`;
  } else if (ok) {
    statusMsg = `<p class="text-sm font-bold text-green-500">✅ 사료만으로도 권장 수분 최소치 충족!</p>`;
  } else {
    statusMsg = `<p class="text-sm font-bold text-amber-500">💧 물그릇으로 약 <span class="text-lg font-black">${부족분}ml</span> 이상 추가 섭취 권장</p>`;
  }

  const html = `
    <div class="p-6 bg-gray-50 rounded-3xl space-y-4">
      <h3 class="font-black text-gray-800">💧 수분 섭취량 분석</h3>
      <div class="bg-white p-5 rounded-2xl space-y-3">
        <div class="flex justify-between items-end">
          <div>
            <p class="text-xs text-gray-400 mb-1">사료 통한 수분 섭취</p>
            <p class="text-4xl font-black text-[#38a8c5]">${총수분_ml}<span class="text-base font-bold text-gray-400 ml-1">ml</span></p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-400">권장 범위</p>
            <p class="text-sm font-black text-gray-600">${권장_최소}–${권장_최대} ml</p>
            <p class="text-xs text-gray-300">체중 ${weight}kg 기준</p>
          </div>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div class="h-3 rounded-full transition-all duration-500" style="width:${gaugeWidth}%; background:${gaugeColor};"></div>
        </div>
        <div class="flex justify-between text-[10px] text-gray-300 font-bold">
          <span>0ml</span>
          <span style="color:${gaugeColor}">${충족률}% 충족</span>
          <span>${권장_최소}ml</span>
        </div>
      </div>
      <div class="bg-white p-4 rounded-2xl">${statusMsg}</div>
      ${결과목록.length > 0 ? `<div class="space-y-2">
        ${결과목록.map(s => {
          const barW     = 총수분_ml > 0 ? Math.round((s.water_ml / 총수분_ml) * 100) : 0;
          const barColor = s.종류 === '습식사료' ? '#3D8BFF' : '#FF9F43';
          return `
          <div class="bg-white p-4 rounded-2xl">
            <div class="flex justify-between items-center mb-2">
              <div>
                <span class="text-[10px] font-black uppercase" style="color:${barColor}">${s.종류 === '습식사료' ? 'WET' : 'DRY'}</span>
                <p class="font-bold text-sm text-gray-800">${s.이름}</p>
              </div>
              <div class="text-right">
                <p class="font-black text-gray-900">${s.water_ml}ml</p>
                <p class="text-xs text-gray-400">${s.수분_pct}% × ${s.급여량_g}g</p>
              </div>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div class="h-1.5 rounded-full" style="width:${barW}%; background:${barColor};"></div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}
      ${제외목록.length ? `<p class="text-xs text-gray-300">※ 수분 데이터 없어 제외: ${제외목록.join(', ')}</p>` : ''}
      <p class="text-xs text-gray-300 leading-relaxed">
        ※ WSAVA 기준 성묘 권장 수분 44~55ml/kg/day 참고값입니다.<br>
        ※ 물그릇 음수량은 포함되지 않습니다.
      </p>
    </div>`;

  document.getElementById('waterResult').innerHTML = html;
  document.getElementById('waterResult').classList.remove('hidden');
  document.getElementById('waterBtn').setAttribute('aria-expanded', 'true');
  document.getElementById('waterResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
