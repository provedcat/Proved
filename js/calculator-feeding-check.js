(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const modes = [...document.querySelectorAll('[data-calculator-mode]')];
  const plan = byId('ratioStep');
  const check = byId('feedingCheckStep');
  const results = byId('resultArea');
  const error = byId('feedingCheckError');
  const inputs = byId('feedingCheckInputs');
  const output = byId('feedingCheckResult');
  let mode = 'plan';
  if (!plan || !check || !inputs) return;

  function selectedFeeds() {
    const dry = (byId('drySwitching')?.checked ? state.dryFeeds : [state.dryFeeds[0]])
      .filter(Boolean).map((feed, i) => ({ key: 'dry-' + i, feed, type: '건식' }));
    const wet = state.wetSlotIds.map(sid => ({ key: 'wet-' + sid, feed: state.wetFeedMap[sid], type: '습식' }))
      .filter(item => item.feed);
    return [...dry, ...wet];
  }
  function number(value) {
    return Number.isFinite(value) ? Math.round(value).toLocaleString('ko-KR') : '—';
  }
  function showError(message) {
    error.textContent = message;
    error.classList.toggle('hidden', !message);
  }
  function refresh() {
    if (mode !== 'check') return;
    const previous = {};
    inputs.querySelectorAll('[data-feeding-grams]').forEach(el => { previous[el.dataset.feedingGrams] = el.value; });
    const items = selectedFeeds();
    inputs.replaceChildren();
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'pc-feeding-check-row';
      const info = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = item.feed.name || '이름 없는 사료';
      const energy = document.createElement('small');
      const kcal = Number(item.feed.kcal);
      energy.textContent = item.type + ' · ' + (Number.isFinite(kcal) && kcal > 0 ? number(kcal) + ' kcal/kg' : '열량 확인 필요');
      info.append(name, energy);
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = '10000'; input.step = '0.1';
      input.inputMode = 'decimal'; input.placeholder = '0'; input.dataset.feedingGrams = item.key;
      input.setAttribute('aria-label', name.textContent + ' 하루 급여량(g)');
      input.value = previous[item.key] ?? '';
      label.append(input, document.createTextNode('g'));
      row.append(info, label);
      inputs.append(row);
    });
    output.classList.add('hidden');
    showError(items.length ? '' : '급여 중인 사료를 먼저 선택해 주세요.');
  }
  function switchMode(next) {
    mode = next === 'check' ? 'check' : 'plan';
    modes.forEach(button => {
      const active = button.dataset.calculatorMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    plan.classList.toggle('hidden', mode !== 'plan');
    check.classList.toggle('hidden', mode !== 'check');
    results.classList.toggle('hidden', mode !== 'plan' || !state.lastResult);
    byId('calculatorModeDescription').textContent = mode === 'check'
      ? '현재 급여하는 양을 입력해 하루 참고 열량과 비교합니다.'
      : '하루 목표 열량을 기준으로 급여 계획을 계산합니다.';
    if (mode === 'check') refresh();
  }
  function calculateCheck() {
    showError('');
    const items = selectedFeeds();
    if (!items.length) return showError('급여 중인 사료를 먼저 선택해 주세요.');
    const grams = items.map(item => Number(inputs.querySelector('[data-feeding-grams="' + item.key + '"]')?.value));
    const raw = items.map(item => inputs.querySelector('[data-feeding-grams="' + item.key + '"]')?.value || '');
    if (raw.every(value => value === '')) return showError('하루 급여량을 g 단위로 입력해 주세요.');
    if (items.some((item, i) => !Number.isFinite(Number(item.feed.kcal)) || Number(item.feed.kcal) <= 0 || raw[i] === '' || !Number.isFinite(grams[i]) || grams[i] < 0 || grams[i] > 10000)) {
      return showError('각 사료의 열량과 급여량을 확인해 주세요. 급여량은 0~10,000g입니다.');
    }
    const weight = Number(byId('catWeight')?.value);
    const birth = byId('catBirth')?.value;
    const neutered = byId('catNeutered')?.value;
    const species = state.selectedPetSpecies === 'dog' ? 'dog' : 'cat';
    if (!birth || !Number.isFinite(weight) || weight < 0.5 || weight > (species === 'dog' ? 150 : 20) || !['true', 'false'].includes(neutered)) {
      return showError('반려동물의 생년월일·체중·중성화 여부를 먼저 입력해 주세요.');
    }
    const expectedAdultWeight = Number(byId('dogExpectedAdultWeight')?.value) || null;
    const unknown = byId('dogExpectedAdultWeight')?.dataset.unknown === 'true';
    const planResult = getCaloriePlan(weight, birth, neutered === 'true', byId('isDiet')?.checked, new Date(), species, {
      activity: document.querySelector('input[name="dogActivity"]:checked')?.value || 'normal',
      expectedAdultWeight: unknown ? null : expectedAdultWeight,
      pregnant: byId('isPregnant')?.checked,
      lactating: byId('isLactating')?.checked
    });
    const target = planResult.DER;
    if (!Number.isFinite(target) || target <= 0) return showError('참고 열량을 계산할 수 없습니다. 반려동물 정보를 확인해 주세요.');
    const treatInput = Number(byId('treatKcalInput')?.value || 0);
    if (!Number.isFinite(treatInput) || treatInput < 0) return showError('간식 열량을 확인해 주세요.');
    const actual = items.reduce((sum, item, i) => sum + grams[i] * Number(item.feed.kcal) / 1000, 0) + treatInput;
    const difference = actual - target;
    byId('feedingCheckActual').textContent = number(actual) + ' kcal';
    byId('feedingCheckTarget').textContent = number(target) + ' kcal';
    byId('feedingCheckDifference').textContent = (difference > 0 ? '+' : '') + number(difference) + ' kcal';
    byId('feedingCheckInterpretation').textContent = Math.abs(difference) < 0.5
      ? '입력한 하루 급여 열량이 참고 열량과 비슷합니다.'
      : difference > 0
        ? '입력한 하루 급여 열량이 참고 열량보다 높습니다.'
        : '입력한 하루 급여 열량이 참고 열량보다 낮습니다.';
    output.classList.remove('hidden');
  }
  modes.forEach(button => button.addEventListener('click', () => switchMode(button.dataset.calculatorMode)));
  byId('feedingCheckCalculate')?.addEventListener('click', calculateCheck);
  document.addEventListener('input', event => {
    if (mode !== 'check') return;
    if (event.target.matches('[data-feeding-grams], #catWeight, #catBirth, #treatKcalInput')) output.classList.add('hidden');
  });
  const observer = new MutationObserver(() => {
    if (mode !== 'check') return;
    const keys = selectedFeeds().map(item => item.key + ':' + item.feed.id).join('|');
    if (keys !== observer._lastKeys) { observer._lastKeys = keys; refresh(); }
  });
  observer.observe(byId('feedsStep'), { childList: true, subtree: true });
  switchMode('plan');
})();