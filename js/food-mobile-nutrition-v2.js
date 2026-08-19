(function () {
  'use strict';

  let rafId = 0;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getGrowthLabel() {
    for (const item of document.querySelectorAll('#foodDetailContent .food-basic-item')) {
      if (item.querySelector('dt')?.textContent.trim() !== '대상') continue;
      return item.querySelector('dd')?.textContent.includes('강아지') ? '퍼피' : '키튼';
    }
    return '키튼';
  }

  function readStatus(node) {
    if (!node) return null;
    const status = node.querySelector('.food-guideline-status');
    if (!status) return null;
    return {
      text: status.textContent.trim() || '—',
      className: Array.from(status.classList).filter(name => name !== 'food-guideline-status').join(' '),
      title: status.getAttribute('title') || ''
    };
  }

  function readGuidelineGroup(group, growthLabel) {
    const summary = readStatus(group.querySelector('.food-mobile-guideline-group__summary'));
    if (summary) {
      return { growth: summary, adult: summary };
    }

    const states = Array.from(group.querySelectorAll('.food-mobile-guideline-group__states > div'));
    const growthNode = states.find(state => state.querySelector('.food-mobile-guideline-state__life')?.textContent.trim() === growthLabel) || states[0];
    const adultNode = states.find(state => state.querySelector('.food-mobile-guideline-state__life')?.textContent.trim() === '어덜트') || states[1];

    return {
      growth: readStatus(growthNode),
      adult: readStatus(adultNode)
    };
  }

  function extractRows(mobile, growthLabel) {
    return Array.from(mobile.querySelectorAll('.food-mobile-nutrient')).map(article => {
      const label = article.querySelector('.food-mobile-nutrient__values h3')?.textContent.trim() || '';
      const isRatio = article.classList.contains('food-mobile-nutrient--ratio');
      const registeredValue = isRatio
        ? article.querySelector('.food-mobile-nutrient__ratio')?.textContent.trim() || '—'
        : article.querySelector('.food-mobile-nutrient__registered')?.textContent.trim() || '—';
      const dmValue = isRatio
        ? '—'
        : (article.querySelector('.food-mobile-nutrient__dm')?.textContent.trim() || 'DM —').replace(/^DM\s*/i, '') || '—';

      const guidelines = {};
      article.querySelectorAll('.food-mobile-guideline-group').forEach(group => {
        const name = group.querySelector('.food-mobile-guideline-group__title')?.textContent.trim();
        if (!name) return;
        guidelines[name.toLowerCase()] = readGuidelineGroup(group, growthLabel);
      });

      return {
        label,
        registeredValue,
        dmValue,
        isRatio,
        guidelines: guidelines.aafco && guidelines.fediaf ? {
          aafco: guidelines.aafco,
          fediaf: guidelines.fediaf
        } : null
      };
    }).filter(row => row.label);
  }

  function statusMarkup(status) {
    if (!status) return '<span class="food-guideline-status is-na">—</span>';
    const classes = status.className ? ` ${escapeHtml(status.className)}` : '';
    const title = status.title ? ` title="${escapeHtml(status.title)}"` : '';
    return `<span class="food-guideline-status${classes}"${title}>${escapeHtml(status.text)}</span>`;
  }

  function renderValuesTable(rows) {
    return `
      <div class="food-mobile-values-block">
        <table class="food-mobile-values-table">
          <colgroup>
            <col class="food-mobile-values-table__label-col">
            <col>
            <col>
          </colgroup>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">등록 값</th>
              <th scope="col">건물 기준 DM</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr${row.isRatio ? ' class="is-ratio"' : ''}>
                <th scope="row">${escapeHtml(row.label)}</th>
                <td>${escapeHtml(row.registeredValue)}</td>
                <td>${escapeHtml(row.dmValue)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderComparisonTable(rows, growthLabel) {
    const comparableRows = rows.filter(row => row.guidelines);
    if (!comparableRows.length) return '';

    return `
      <div class="food-mobile-comparison-block">
        <h3>주요 영양성분 기준 비교</h3>
        <table class="food-mobile-comparison-table">
          <colgroup>
            <col class="food-mobile-comparison-table__label-col">
            <col><col><col><col>
          </colgroup>
          <thead>
            <tr>
              <th scope="col" rowspan="2">항목</th>
              <th scope="colgroup" colspan="2">AAFCO</th>
              <th scope="colgroup" colspan="2">FEDIAF</th>
            </tr>
            <tr>
              <th scope="col">${escapeHtml(growthLabel)}</th>
              <th scope="col">어덜트</th>
              <th scope="col">${escapeHtml(growthLabel)}</th>
              <th scope="col">어덜트</th>
            </tr>
          </thead>
          <tbody>
            ${comparableRows.map(row => `
              <tr>
                <th scope="row">${escapeHtml(row.label)}</th>
                <td>${statusMarkup(row.guidelines.aafco.growth)}</td>
                <td>${statusMarkup(row.guidelines.aafco.adult)}</td>
                <td>${statusMarkup(row.guidelines.fediaf.growth)}</td>
                <td>${statusMarkup(row.guidelines.fediaf.adult)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function enhanceMobileNutrition() {
    const mobile = document.querySelector('#foodDetailContent .food-nutrition-mobile');
    if (!mobile || mobile.dataset.compactTableLayout === 'v2') return;
    if (!mobile.querySelector('.food-mobile-nutrient')) return;

    const growthLabel = getGrowthLabel();
    const rows = extractRows(mobile, growthLabel);
    if (!rows.length) return;

    mobile.innerHTML = `${renderValuesTable(rows)}${renderComparisonTable(rows, growthLabel)}`;
    mobile.dataset.compactTableLayout = 'v2';
  }

  function scheduleEnhance() {
    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(enhanceMobileNutrition);
  }

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', scheduleEnhance, { once: true });
  scheduleEnhance();
})();
