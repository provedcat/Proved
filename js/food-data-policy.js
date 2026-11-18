(function (scope) {
  'use strict';
  const VERSION = '2026-11-18';
  const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const rounded = (value, places = 2) => value === null ? null : Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places;
  const estimateSources = new Set(['estimated', 'estimated_corrected', 'manual_review']);

  function wetFactor(moisture, fat) {
    if (moisture >= 85) return fat <= 2 ? 1.82 : 1.26;
    if (moisture >= 82) return fat <= 2 ? 1.41 : 1.22;
    return fat <= 2 ? 1.33 : 1.28;
  }

  // All derived fields use the registered ingredient version; never substitute a market here.
  function calculate(feed) {
    const out = { ...feed };
    const keys = ['조단백', '조지방', '조회분', '조섬유', '수분'];
    const values = keys.map(key => number(feed[key]));
    const valid = values.every(value => value !== null && value >= 0 && value <= 100) && values[4] < 100;
    const [protein, fat, ash, fibre, moisture] = values;
    const ca = number(feed.칼슘), phosphorus = number(feed.인);
    out.ca_p_ratio = ca !== null && ca >= 0 && phosphorus > 0 ? rounded(ca / phosphorus) : null;
    out.nfe = valid ? rounded(Math.max(0, 100 - protein - fat - ash - fibre - moisture)) : null;
    out.base_estimated_me = valid ? rounded((3.5 * protein + 8.5 * fat + 3.5 * out.nfe) * 10, 1) : null;
    const dm = moisture !== null && moisture >= 0 && moisture < 100 ? 100 / (100 - moisture) : null;
    for (const [raw, target, places] of [['조단백','dm_단백',2], ['조지방','dm_지방',2], ['조회분','dm_회분',2], ['조섬유','dm_섬유',2], ['칼슘','dm_칼슘',3], ['인','dm_인',3]]) {
      const value = number(feed[raw]);
      out[target] = dm !== null && value !== null ? rounded(value * dm, places) : null;
    }
    const official = number(feed.official_me), stored = number(feed.final_me);
    if (official > 0 || (stored > 0 && !estimateSources.has(feed.cal_source))) {
      out.final_me = stored > 0 && !estimateSources.has(feed.cal_source) ? stored : official;
      out.corrected_me = null;
      if (official > 0 && estimateSources.has(feed.cal_source)) out.cal_source = 'official';
    } else if (out.base_estimated_me > 0) {
      const corrected = feed.type === 'wet' && feed.완전식여부 === '주식';
      out.final_me = rounded(out.base_estimated_me * (corrected ? wetFactor(moisture, fat) : 1), 1);
      out.corrected_me = corrected ? out.final_me : null;
      out.cal_source = corrected ? 'estimated_corrected' : 'estimated';
    } else {
      out.final_me = null;
      out.corrected_me = null;
      out.cal_source = 'manual_review';
    }
    out.needs_calorie_review = !(out.final_me > 0);
    for (const [raw, target] of [['조단백','eb_단백'], ['조지방','eb_지방'], ['nfe','eb_탄수화물'], ['칼슘','eb_칼슘'], ['인','eb_인']]) {
      const value = number(out[raw]);
      out[target] = out.final_me > 0 && value !== null ? rounded(value * 10000 / out.final_me) : null;
    }
    return out;
  }

  function complete(feed) {
    // Calorie availability is independent of ingredient review completion.
    return feed.verification_status === 'approved' || (feed.verified === true && !['rejected', 'excluded'].includes(feed.verification_status));
  }

  function basis(feed) {
    const entries = Array.isArray(feed.source_urls) ? feed.source_urls : [];
    return [...entries].reverse().find(entry => entry && entry.purpose === 'information_basis') || {};
  }
  function ingredientBasis(feed) {
    const metadata = basis(feed);
    if (metadata.nutrition_basis === 'mixed') return '국내·해외 항목별 보완';
    if (metadata.nutrition_basis === 'overseas') return '해외 공식 성분 기준';
    if (metadata.nutrition_basis === 'KR') return '국내 라벨 기준';
    if (feed.source_region === 'KR') return '국내 라벨 기준';
    if (feed.source_level === 'manufacturer_official' && feed.source_region && !['unknown', 'mixed'].includes(feed.source_region)) return '해외 공식 성분 기준';
    return '등록 성분 기준 · 출처 확인 필요';
  }
  function calorieLabel(feed) {
    if (!(number(feed.final_me) > 0)) return '열량 미입력 · 계산에 필요한 성분 확인 필요';
    if (feed.cal_source === 'estimated_corrected') return '보증성분 추정값 · 습식 주식 보정 적용';
    if (feed.cal_source === 'estimated') return '보증성분 추정값';
    const region = basis(feed).calorie_basis;
    if (region === 'KR') return '국내 공식 값';
    if (region === 'overseas') return '해외 공식 값';
    // Ingredient market is not evidence of the calorie market.
    return '표시 열량 · 출처 구분 확인 필요';
  }
  function rows(feed) {
    const state = complete(feed) ? '검수 완료' : '검수 전';
    const calories = !(number(feed.final_me) > 0) ? '미입력'
      : feed.cal_source === 'estimated_corrected' ? '추정값 · 습식 보정'
      : feed.cal_source === 'estimated' ? '추정값'
      : calorieLabel(feed).replace('표시 열량 · 출처 구분 확인 필요', '표시값 · 출처 확인 필요');
    return [
      ['등록 정보', state + ' · ' + ingredientBasis(feed)],
      ['열량', calories]
    ];
  }
  const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  function render(feed) {
    return rows(feed).map(([label, value]) => `<div class="food-source-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  }
  const api = { VERSION, wetFactor, calculate, complete, rows, render, ingredientBasis, calorieLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  scope.ProvedFoodDataPolicy = api;
})(typeof window !== 'undefined' ? window : globalThis);
