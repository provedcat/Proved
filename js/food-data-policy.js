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
    const source = ingredientBasis(feed), metadata = basis(feed);
    const ratio = number(feed.ca_p_ratio);
    const nfe = number(feed.nfe);
    const editions = { domestic_legacy: '국내 유통 구판 기준', domestic_current: '국내 공식 신판 기준', overseas_current: '해외 공식 신판 기준', hold: '판본 불일치 · 확인 보류' };
    const list = [
      ['성분 검수', complete(feed) ? '검수 완료' : '검수 전'],
      ['성분 출처', source],
      ['열량 기준', calorieLabel(feed)],
      ['칼슘:인 비율', ratio !== null ? '등록 성분의 칼슘 ÷ 인 · ' + ratio.toFixed(2) + ':1' : '칼슘·인 정보 부족'],
      ['탄수화물(NFE)', nfe !== null ? '성분 합계에서 차감 · 음수는 0 처리' : '계산에 필요한 성분 미공개'],
      ['건물 기준(DM)', number(feed.수분) === null ? '수분 미공개 · 계산 불가' : source + '으로 환산']
    ];
    if (feed.needs_calorie_review === true || !(number(feed.final_me) > 0)) list.push(['열량 확인', '추가 확인 필요']);
    if (feed.submission_method === 'admin_bulk' || feed.uploaded_by === 'admin') list.push(['등록 경로', '관리자 등록']);
    if (['주식', '보조식'].includes(feed.완전식여부)) list.push(['주식·보조식', metadata.adequacy_basis === 'manufacturer' ? '제조사 완전식 문구 기준' : metadata.adequacy_basis === 'reviewer' ? '검수자 확인 기준' : '등록 분류 기준 · 판단 근거 확인 필요']);
    list.push(['제품 판본', editions[metadata.edition_basis] || '국내 실제 유통 판본 우선']);
    return list;
  }
  const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  function render(feed) {
    return rows(feed).map(([label, value]) => `<div class="food-source-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  }
  const api = { VERSION, wetFactor, calculate, complete, rows, render, ingredientBasis, calorieLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  scope.ProvedFoodDataPolicy = api;
})(typeof window !== 'undefined' ? window : globalThis);
