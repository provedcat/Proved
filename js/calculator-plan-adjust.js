/* Detailed per-food feeding allocation. Grams, not per-product percentages, are the source of truth. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.document) {
    root.provedFeedingPlan = api;
    api.initialize();
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const roundGrams = value => Math.round((value + Number.EPSILON) * 10) / 10;
  const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const getKcal = row => safeNumber(row.kcal) / 1000;
  const format = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 });

  // Distribute the remaining energy after manually fixed grams. Dry/wet
  // targets are preferences, not hard limits: when one group cannot absorb
  // its share, available auto foods in the other group can fill the gap.
  function allocateFeedingPlan(rows, targetFoodKcal, dryRatio) {
    if (!Array.isArray(rows) || !Number.isFinite(targetFoodKcal) || targetFoodKcal < 0 ||
        !Number.isFinite(dryRatio) || dryRatio < 0 || dryRatio > 1 ||
        rows.some(row => !['dry', 'wet'].includes(row.type) || !Number.isFinite(Number(row.kcal)) ||
          Number(row.kcal) <= 0 || (row.mode !== 'auto' && row.mode !== 'manual') ||
          (row.mode === 'manual' && (!Number.isFinite(Number(row.grams)) || Number(row.grams) < 0)))) {
      throw new Error('급여량이나 사료 열량을 확인해 주세요.');
    }
    const output = rows.map(row => ({
      ...row,
      grams: row.mode === 'manual' ? roundGrams(Number(row.grams)) : 0
    }));
    const fixed = { dry: 0, wet: 0 };
    output.forEach(row => { if (row.mode === 'manual') fixed[row.type] += row.grams * getKcal(row); });
    const totalFixed = fixed.dry + fixed.wet;
    const remaining = Math.max(0, targetFoodKcal - totalFixed);
    const targets = { dry: targetFoodKcal * dryRatio, wet: targetFoodKcal * (1 - dryRatio) };
    const groups = {
      dry: output.filter(row => row.type === 'dry' && row.mode === 'auto'),
      wet: output.filter(row => row.type === 'wet' && row.mode === 'auto')
    };
    const allocation = { dry: 0, wet: 0 };
    for (const type of ['dry', 'wet']) {
      if (groups[type].length) allocation[type] = Math.max(0, targets[type] - fixed[type]);
    }
    const desired = allocation.dry + allocation.wet;
    if (desired > remaining && desired > 0) {
      const scale = remaining / desired;
      allocation.dry *= scale;
      allocation.wet *= scale;
    } else if (remaining > desired) {
      const spare = remaining - desired;
      const active = ['dry', 'wet'].filter(type => groups[type].length);
      if (active.length === 1) allocation[active[0]] += spare;
      else if (active.length === 2) {
        const weight = Math.max(0, targets.dry - fixed.dry) + Math.max(0, targets.wet - fixed.wet);
        const dryShare = weight > 0 ? Math.max(0, targets.dry - fixed.dry) / weight : dryRatio;
        allocation.dry += spare * dryShare;
        allocation.wet += spare * (1 - dryShare);
      }
    }
    for (const type of ['dry', 'wet']) {
      const members = groups[type];
      members.forEach(row => {
        row.grams = roundGrams(allocation[type] / members.length / getKcal(row));
      });
    }
    output.forEach(row => { row.actualKcal = row.grams * getKcal(row); });
    const actualFoodKcal = output.reduce((sum, row) => sum + row.actualKcal, 0);
    return {
      rows: output,
      actualFoodKcal,
      differenceKcal: actualFoodKcal - targetFoodKcal,
      dryKcal: output.filter(row => row.type === 'dry').reduce((sum, row) => sum + row.actualKcal, 0),
      wetKcal: output.filter(row => row.type === 'wet').reduce((sum, row) => sum + row.actualKcal, 0)
    };
  }

  const byId = id => document.getElementById(id);
  let context = null;
  let rows = [];
  let current = null;

  function setStatus(message) {
    const el = byId('planAdjustError');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }
  function hideResult() {
    byId('resultArea')?.classList.add('hidden');
    if (typeof state !== 'undefined' && state.lastResult) {
      state.isCalculationDirty = true;
      if (typeof updateResultActionState === 'function') updateResultActionState();
    }
  }
  function invalidate() {
    context = null;
    rows = [];
    current = null;
    byId('planAdjustStep')?.classList.add('hidden');
    document.body.classList.remove('pc-plan-adjust-visible');
    hideResult();
  }
  function selectedRows() {
    const switching = byId('drySwitching')?.checked;
    const dry = (switching ? state.dryFeeds : [state.dryFeeds[0]])
      .map((feed, index) => feed && ({
        key: 'dry-' + index, type: 'dry', feed, kcal: Number(feed.kcal),
        mode: 'auto', grams: 0
      })).filter(Boolean);
    const wet = state.wetSlotIds.map(sid => {
      const feed = state.wetFeedMap[sid];
      return feed && { key: 'wet-' + sid, type: 'wet', feed, kcal: Number(feed.kcal), mode: 'auto', grams: 0 };
    }).filter(Boolean);
    return [...dry, ...wet];
  }
  function renderRows() {
    const list = byId('planAdjustRows');
    if (!list) return;
    list.replaceChildren();
    rows.forEach(row => {
      const item = document.createElement('div');
      item.className = 'pc-plan-adjust-row';
      const heading = document.createElement('div');
      heading.className = 'pc-plan-adjust-row__heading';
      const title = document.createElement('strong');
      title.textContent = row.feed.name || '이름 없는 사료';
      const info = document.createElement('small');
      info.textContent = (row.type === 'dry' ? '건식' : '습식') + ' · ' + format(row.kcal) + ' kcal/kg';
      heading.append(title, info);
      const controls = document.createElement('div');
      controls.className = 'pc-plan-adjust-row__controls';
      const select = document.createElement('select');
      select.setAttribute('aria-label', title.textContent + ' 급여량 설정');
      select.dataset.planMode = row.key;
      [['auto', '자동 맞춤'], ['manual', '직접 입력']].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value; option.textContent = label;
        select.appendChild(option);
      });
      select.value = row.mode;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = '10000'; input.step = '0.1'; input.inputMode = 'decimal';
      input.dataset.planGrams = row.key;
      input.setAttribute('aria-label', title.textContent + ' 하루 급여량(g)');
      input.disabled = row.mode === 'auto';
      input.value = String(row.grams);
      label.append(input, document.createTextNode('g'));
      controls.append(select, label);
      item.append(heading, controls);
      list.appendChild(item);
    });
  }
  function syncRows() {
    rows.forEach(row => {
      const select = [...byId('planAdjustRows').querySelectorAll('[data-plan-mode]')]
        .find(el => el.dataset.planMode === row.key);
      const input = [...byId('planAdjustRows').querySelectorAll('[data-plan-grams]')]
        .find(el => el.dataset.planGrams === row.key);
      if (select) select.value = row.mode;
      if (input) {
        input.disabled = row.mode === 'auto';
        if (row.mode === 'auto') input.value = String(row.grams);
      }
    });
  }
  function refresh() {
    if (!context) return;
    try {
      current = allocateFeedingPlan(rows, context.targetFoodKcal, context.dryRatio);
      rows.forEach((row, i) => { if (row.mode === 'auto') row.grams = current.rows[i].grams; });
      syncRows();
      const actual = current.actualFoodKcal + context.treatKcal;
      const difference = actual - context.DER;
      byId('planAdjustTarget').textContent = format(context.DER) + ' kcal';
      byId('planAdjustActual').textContent = format(actual) + ' kcal';
      byId('planAdjustDifference').textContent = (difference > 0 ? '+' : '') + format(difference) + ' kcal';
      byId('planAdjustDifference').classList.toggle('is-different', Math.abs(difference) >= 1);
      const status = byId('planAdjustStatus');
      status.textContent = Math.abs(difference) < 1
        ? '목표 열량에 가깝게 맞췄습니다.'
        : difference > 0
          ? '현재 계획이 목표 열량보다 높습니다. 직접 입력한 양을 확인해 주세요.'
          : '현재 계획이 목표 열량보다 낮습니다. 자동 맞춤 제품을 추가하거나 급여량을 조정해 주세요.';
      setStatus('');
      if (typeof updateMobileFeedingSummary === 'function') {
        const dry = current.rows.filter(row => row.type === 'dry').reduce((sum, row) => sum + row.grams, 0);
        const wet = current.rows.filter(row => row.type === 'wet').reduce((sum, row) => sum + row.grams, 0);
        updateMobileFeedingSummary({ dryTotalGrams: format(dry), wetTotalGrams: format(wet) });
      }
    } catch (error) {
      current = null;
      setStatus(error.message);
    }
  }
  function begin(nextContext) {
    context = nextContext;
    rows = selectedRows();
    current = null;
    if (!rows.length) return;
    hideResult();
    byId('planAdjustDirect').textContent = '직접 급여량 계산하기';
    renderRows();
    refresh();
    document.body.classList.add('pc-plan-adjust-visible');
    const step = byId('planAdjustStep');
    step.classList.remove('hidden');
    step.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function getCurrentPlan() {
    if (!context || !current || byId('planAdjustStep')?.classList.contains('hidden')) return null;
    if (rows.some(row => row.mode === 'manual' &&
      (!Number.isFinite(Number(row.grams)) || row.grams === '' || Number(row.grams) < 0 || Number(row.grams) > 10000))) return null;
    return { ...current, targetFoodKcal: context.targetFoodKcal, dryRatio: context.dryRatio, DER: context.DER };
  }
  function setMode(mode) {
    const visible = mode === 'plan' && Boolean(context);
    byId('planAdjustStep')?.classList.toggle('hidden', !visible);
    document.body.classList.toggle('pc-plan-adjust-visible', visible);
  }
  function confirm() {
    if (!getCurrentPlan()) return setStatus('각 사료의 급여량을 확인해 주세요.');
    if (typeof calculate === 'function') calculate('confirm');
  }
  function initialize() {
    const list = byId('planAdjustRows');
    if (!list) return;
    list.addEventListener('change', event => {
      const select = event.target.closest('[data-plan-mode]');
      if (!select) return;
      const row = rows.find(item => item.key === select.dataset.planMode);
      if (!row) return;
      row.mode = select.value === 'manual' ? 'manual' : 'auto';
      if (row.mode === 'manual' && current) {
        row.grams = current.rows.find(item => item.key === row.key)?.grams ?? row.grams;
      }
      hideResult();
      refresh();
    });
    list.addEventListener('change', event => {
      const input = event.target.closest('[data-plan-grams]');
      if (!input) return;
      const row = rows.find(item => item.key === input.dataset.planGrams);
      if (!row || row.mode !== 'manual' || input.value === '' || !Number.isFinite(Number(input.value))) return;
      row.grams = roundGrams(Math.max(0, Number(input.value)));
      input.value = String(row.grams);
      refresh();
    });
    list.addEventListener('input', event => {
      const input = event.target.closest('[data-plan-grams]');
      if (!input) return;
      const row = rows.find(item => item.key === input.dataset.planGrams);
      if (!row || row.mode !== 'manual') return;
      row.grams = input.value;
      hideResult();
      if (input.value === '' || !Number.isFinite(Number(input.value)) || Number(input.value) < 0 || Number(input.value) > 10000) {
        current = null;
        return setStatus('급여량은 0~10,000g 사이로 입력해 주세요.');
      }
      refresh();
    });
    byId('planAdjustDirect')?.addEventListener('click', () => {
      const allManual = rows.length && rows.every(row => row.mode === 'manual');
      rows.forEach(row => {
        if (!allManual && current) row.grams = current.rows.find(item => item.key === row.key)?.grams ?? row.grams;
        row.mode = allManual ? 'auto' : 'manual';
      });
      byId('planAdjustDirect').textContent = allManual ? '직접 급여량 계산하기' : '목표 열량에 맞추기로 돌아가기';
      hideResult();
      refresh();
    });
    byId('planAdjustConfirm')?.addEventListener('click', confirm);
  }
  return { allocateFeedingPlan, begin, getCurrentPlan, invalidate, setMode, initialize };
});
