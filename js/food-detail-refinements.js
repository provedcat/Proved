(function () {
  'use strict';

  // 이 표는 상세 페이지에 이미 저장된 일부 주요 성분을 기준표와 대조하기 위한 참고용이다.
  // 전체 AAFCO/FEDIAF 영양 적합성 판정이나 인증을 의미하지 않는다.
  const GUIDELINES = {
    cat: {
      aafco: {
        growth: {
          '조단백': { min: 30 },
          '조지방': { min: 9 },
          '칼슘': { min: 1.0 },
          '인': { min: 0.8 }
        },
        adult: {
          '조단백': { min: 26 },
          '조지방': { min: 9 },
          '칼슘': { min: 0.6 },
          '인': { min: 0.5 }
        }
      },
      fediaf: {
        growth: {
          '조단백': { min: 30 },
          '조지방': { min: 9 },
          '칼슘': { min: 1.0 },
          '인': { min: 0.84 },
          '칼슘:인': { min: 1.0, max: 1.5 }
        },
        adult: {
          '조단백': { min: 33.3 },
          '조지방': { min: 9 },
          '칼슘': { min: 0.53 },
          '인': { min: 0.35 },
          '칼슘:인': { min: 1.0, max: 2.0 }
        }
      }
    },
    dog: {
      aafco: {
        growth: {
          '조단백': { min: 22.0 },
          '조지방': { min: 8.5 },
          '칼슘': { min: 1.2, max: 2.5 },
          '인': { min: 1.0, max: 1.6 },
          '칼슘:인': { min: 1.0, max: 2.0 }
        },
        adult: {
          '조단백': { min: 18 },
          '조지방': { min: 5.5 },
          '칼슘': { min: 0.5, max: 2.5 },
          '인': { min: 0.4, max: 1.6 },
          '칼슘:인': { min: 1.0, max: 2.0 }
        }
      },
      fediaf: {
        growth: {
          '조단백': { min: 25 },
          '조지방': { min: 8.5 },
          '칼슘': { min: 1.0, max: 1.6 },
          '인': { min: 0.9 },
          '칼슘:인': { min: 1.0, max: 1.6 }
        },
        adult: {
          '조단백': { min: 21 },
          '조지방': { min: 5.5 },
          '칼슘': { min: 0.58, max: 2.5 },
          '인': { min: 0.46, max: 1.6 },
          '칼슘:인': { min: 1.0, max: 2.0 }
        }
      }
    }
  };

  let rafId = 0;

  function parseNumber(text) {
    const match = String(text || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : null;
  }

  function trimFixed(value, digits) {
    const fixed = Number(value).toFixed(digits);
    const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
    return trimmed.includes('.') ? trimmed : `${trimmed}.0`;
  }

  // DB의 ca_p_ratio는 Ca/P 값이다. 화면에서는 Ca를 1로 고정해 1:P 상대값으로 표시한다.
  function normalizeRatio(caOverP) {
    const ratio = Number(caOverP);
    if (!Number.isFinite(ratio) || ratio <= 0) return '—';
    const phosphorusRelative = 1 / ratio;
    return `1:${trimFixed(phosphorusRelative, 2)}`;
  }

  function readOriginalRatio(root) {
    const metric = root.querySelector('.food-metric--ratio');
    if (metric) {
      const saved = Number(metric.dataset.caOverPRatio);
      if (Number.isFinite(saved) && saved > 0) return saved;
      const value = parseNumber(metric.querySelector('.food-metric__value')?.textContent);
      if (value && value > 0) {
        metric.dataset.caOverPRatio = String(value);
        return value;
      }
    }

    for (const item of root.querySelectorAll('.food-mineral-item')) {
      if (item.querySelector('.food-mineral-item__label')?.textContent.trim() !== 'Ca:P') continue;
      const saved = Number(item.dataset.caOverPRatio);
      if (Number.isFinite(saved) && saved > 0) return saved;
      const value = parseNumber(item.querySelector('.food-mineral-item__value')?.textContent);
      if (value && value > 0) {
        item.dataset.caOverPRatio = String(value);
        return value;
      }
    }
    return null;
  }

  function normalizeRatioDisplays() {
    document.querySelectorAll('.food-result-stat').forEach(stat => {
      if (stat.dataset.ratioNormalized === 'true') return;
      const label = stat.querySelector('.food-result-stat__label')?.textContent.trim();
      if (label !== 'Ca:P') return;
      const valueNode = stat.querySelector('.food-result-stat__value');
      const raw = parseNumber(valueNode?.textContent);
      if (!raw || raw <= 0) return;
      valueNode.textContent = normalizeRatio(raw);
      stat.dataset.ratioNormalized = 'true';
    });

    const detail = document.getElementById('foodDetailContent');
    if (!detail) return null;
    const rawRatio = readOriginalRatio(detail);

    const metric = detail.querySelector('.food-metric--ratio');
    if (metric && rawRatio && metric.dataset.ratioNormalized !== 'true') {
      const valueNode = metric.querySelector('.food-metric__value');
      const unitNode = metric.querySelector('.food-metric__unit');
      if (valueNode) valueNode.textContent = normalizeRatio(rawRatio);
      if (unitNode) unitNode.textContent = '';
      metric.dataset.ratioNormalized = 'true';
    }

    detail.querySelectorAll('.food-mineral-item').forEach(item => {
      if (item.querySelector('.food-mineral-item__label')?.textContent.trim() !== 'Ca:P') return;
      if (!rawRatio || item.dataset.ratioNormalized === 'true') return;
      const valueNode = item.querySelector('.food-mineral-item__value');
      if (valueNode) valueNode.textContent = normalizeRatio(rawRatio);
      item.dataset.ratioNormalized = 'true';
    });

    return rawRatio;
  }

  function getBasicValue(label) {
    for (const item of document.querySelectorAll('#foodDetailContent .food-basic-item')) {
      if (item.querySelector('dt')?.textContent.trim() === label) {
        return item.querySelector('dd')?.textContent.trim() || '';
      }
    }
    return '';
  }

  function getSpecies() {
    return getBasicValue('대상').includes('강아지') ? 'dog' : 'cat';
  }

  function getLifeLabels(species) {
    return species === 'dog'
      ? { growth: '퍼피', adult: '어덜트' }
      : { growth: '키튼', adult: '어덜트' };
  }

  function getDmValue(row) {
    const cells = row.querySelectorAll('th, td');
    return cells.length >= 3 ? parseNumber(cells[2].textContent) : null;
  }

  function evaluate(value, rule, eligible) {
    if (!eligible) return { text: '—', className: 'is-na', title: '주식으로 확인된 제품에만 비교합니다.' };
    if (!rule || value === null || value === undefined || !Number.isFinite(Number(value))) {
      return { text: '—', className: 'is-na', title: '비교 가능한 기준 또는 등록 값이 없습니다.' };
    }

    const numeric = Number(value);
    if (rule.min !== undefined && numeric < rule.min) {
      return { text: '미달', className: 'is-fail', title: `최소 ${rule.min} 기준 미만` };
    }
    if (rule.max !== undefined && numeric > rule.max) {
      return { text: '초과', className: 'is-fail', title: `최대 ${rule.max} 기준 초과` };
    }
    return { text: '충족', className: 'is-pass', title: '표시된 주요 성분 기준 범위 내' };
  }

  function statusMarkup(status) {
    return `<span class="food-guideline-status ${status.className}" title="${status.title}">${status.text}</span>`;
  }

  function statusCell(status) {
    return `<td class="food-guideline-cell">${statusMarkup(status)}</td>`;
  }

  function getGuidelineStatuses(label, value, rules, eligible) {
    return {
      aafco: {
        growth: evaluate(value, rules.aafco.growth[label], eligible),
        adult: evaluate(value, rules.aafco.adult[label], eligible)
      },
      fediaf: {
        growth: evaluate(value, rules.fediaf.growth[label], eligible),
        adult: evaluate(value, rules.fediaf.adult[label], eligible)
      }
    };
  }

  function renderMobileGuidelineGroup(name, statuses, life, collapseMatching) {
    const isMatching = statuses.growth.text === statuses.adult.text;
    const states = collapseMatching && isMatching
      ? `<div class="food-mobile-guideline-group__summary">${statusMarkup(statuses.growth)}</div>`
      : `<div class="food-mobile-guideline-group__states">
          <div><span class="food-mobile-guideline-state__life">${life.growth}</span>${statusMarkup(statuses.growth)}</div>
          <div><span class="food-mobile-guideline-state__life">${life.adult}</span>${statusMarkup(statuses.adult)}</div>
        </div>`;

    return `<section class="food-mobile-guideline-group" aria-label="${name} 기준">
      <h4 class="food-mobile-guideline-group__title">${name}</h4>
      ${states}
    </section>`;
  }

  function renderMobileNutrition(rows, life) {
    const mobile = document.createElement('div');
    mobile.className = 'food-nutrition-mobile';
    mobile.setAttribute('aria-label', '모바일 영양정보');
    mobile.innerHTML = rows.map(row => {
      const values = row.isRatio
        ? `<span class="food-mobile-nutrient__ratio">${row.registeredValue}</span>`
        : `<span class="food-mobile-nutrient__registered">${row.registeredValue}</span><span class="food-mobile-nutrient__dm">DM ${row.dmValue}</span>`;
      const guidelineGroups = row.guidelines
        ? `<div class="food-mobile-guideline-groups">
            ${renderMobileGuidelineGroup('AAFCO', row.guidelines.aafco, life, row.isRatio)}
            ${renderMobileGuidelineGroup('FEDIAF', row.guidelines.fediaf, life, row.isRatio)}
          </div>`
        : '';

      return `<article class="food-mobile-nutrient${row.isRatio ? ' food-mobile-nutrient--ratio' : ''}">
        <div class="food-mobile-nutrient__values">
          <h3>${row.label}</h3>
          ${values}
        </div>
        ${guidelineGroups}
      </article>`;
    }).join('');
    return mobile;
  }

  function addGuidelineColumns(rawRatio) {
    const table = document.querySelector('#foodDetailContent .food-nutrition-table');
    if (!table || table.dataset.guidelinesEnhanced === 'true') return;

    const species = getSpecies();
    const life = getLifeLabels(species);
    const rules = GUIDELINES[species];
    const eligible = getBasicValue('분류') === '주식';
    const body = table.querySelector('tbody');
    if (!body) return;

    table.querySelector('thead').innerHTML = `
      <tr>
        <th scope="col" rowspan="2">항목</th>
        <th scope="col" rowspan="2">등록 값</th>
        <th scope="col" rowspan="2">건물 기준 DM</th>
        <th scope="colgroup" colspan="2">AAFCO</th>
        <th scope="colgroup" colspan="2">FEDIAF 2025</th>
      </tr>
      <tr>
        <th scope="col">${life.growth}</th>
        <th scope="col">${life.adult}</th>
        <th scope="col">${life.growth}</th>
        <th scope="col">${life.adult}</th>
      </tr>`;

    const supported = new Set(['조단백', '조지방', '칼슘', '인']);
    const nutritionRows = Array.from(body.querySelectorAll('tr')).map(row => {
      const label = row.querySelector('th')?.textContent.trim() || '';
      const cells = row.querySelectorAll('th, td');
      const value = supported.has(label) ? getDmValue(row) : null;
      return {
        element: row,
        label,
        registeredValue: cells[1]?.textContent.trim() || '—',
        dmValue: cells[2]?.textContent.trim() || '—',
        guidelines: supported.has(label) ? getGuidelineStatuses(label, value, rules, eligible) : null,
        isRatio: false
      };
    });

    nutritionRows.forEach(row => {
      const statuses = row.guidelines
        ? [row.guidelines.aafco.growth, row.guidelines.aafco.adult, row.guidelines.fediaf.growth, row.guidelines.fediaf.adult]
        : [evaluate(null, null, eligible), evaluate(null, null, eligible), evaluate(null, null, eligible), evaluate(null, null, eligible)];
      row.element.insertAdjacentHTML('beforeend', statuses.map(statusCell).join(''));
    });

    if (rawRatio && rawRatio > 0) {
      const label = '칼슘:인';
      const row = document.createElement('tr');
      row.className = 'food-guideline-ratio-row';
      const guidelines = getGuidelineStatuses(label, rawRatio, rules, eligible);
      row.innerHTML = `
        <th scope="row">${label}</th>
        <td>${normalizeRatio(rawRatio)}</td>
        <td>—</td>
        ${[
          guidelines.aafco.growth,
          guidelines.aafco.adult,
          guidelines.fediaf.growth,
          guidelines.fediaf.adult
        ].map(statusCell).join('')}`;
      body.appendChild(row);
      nutritionRows.push({
        element: row,
        label,
        registeredValue: normalizeRatio(rawRatio),
        dmValue: '—',
        guidelines,
        isRatio: true
      });
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'food-guideline-table-scroll food-nutrition-desktop';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);

    const mobile = renderMobileNutrition(nutritionRows, life);
    wrapper.insertAdjacentElement('afterend', mobile);

    const originalNote = mobile.nextElementSibling;
    const note = document.createElement('div');
    note.className = 'food-guideline-note';
    note.innerHTML = `
      <strong>주요 영양성분 기준 비교</strong>
      <p>등록된 조단백·조지방·칼슘·인·칼슘:인 값만 AAFCO 및 FEDIAF 기준과 비교한 참고 정보입니다. 전체 영양 적합성이나 인증을 의미하지 않습니다.</p>
      <p>FEDIAF는 2025 Nutritional Guidelines의 DM 기준을 사용하며, 단일 어덜트 열은 낮은 MER의 더 보수적인 기준을 적용했습니다. 성장기는 보수적인 성장 초기 기준을 적용하고, 주식으로 확인되지 않은 제품은 비교하지 않습니다.</p>`;
    if (originalNote?.classList.contains('food-table-note')) {
      originalNote.insertAdjacentElement('afterend', note);
    } else {
      mobile.insertAdjacentElement('afterend', note);
    }

    table.dataset.guidelinesEnhanced = 'true';
  }

  function enhance() {
    normalizeRatioDisplays();
    const rawRatio = readOriginalRatio(document.getElementById('foodDetailContent') || document);
    addGuidelineColumns(rawRatio);
  }

  function scheduleEnhance() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      enhance();
    });
  }

  function init() {
    const target = document.querySelector('.food-main');
    if (!target) return;
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(target, { childList: true, subtree: true });
    scheduleEnhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
