(function (scope) {
  'use strict';

  const estimatedSources = new Set(['estimated', 'estimated_corrected']);
  const formatNumber = value => new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 2
  }).format(value);
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function render(feed, species, productName) {
    if (!feed || typeof feed !== 'object') return '';
    const name = String(productName || feed.제품명 || '').trim();
    if (!name) return '';
    const animal = species === 'dog' ? '강아지' : '고양이';
    const country = String(feed.원산지 || '').trim();
    const origin = country && !/^(정보 없음|미확인|확인중|—|-)$/i.test(country)
      ? country + '에서 제조된 ' : '';
    const meal = feed.완전식여부 === '주식' ? '주식 ' : feed.완전식여부 === '보조식' ? '보조식 ' : '';
    const form = feed.type === 'wet' ? '습식사료' : feed.type === 'dry' ? '건사료' : '사료';
    const sentences = [name + '은 ' + origin + animal + ' ' + meal + form + '입니다.'];

    const kcalPerKg = Number(feed.final_me);
    const canCalculate = feed.완전식여부 === '주식'
      && feed.needs_calorie_review !== true
      && feed.cal_source !== 'manual_review'
      && feed.final_me !== null && feed.final_me !== undefined && feed.final_me !== ''
      && Number.isFinite(kcalPerKg) && kcalPerKg > 0;

    if (canCalculate) {
      const grams = kcal => Math.round(kcal * 1000 / kcalPerKg);
      const estimated = estimatedSources.has(feed.cal_source) ? '(추정 열량 기준)' : '';
      let amount = '하루 에너지 필요량이 200kcal이고 이 제품만 급여한다면 약 '
        + formatNumber(grams(200)) + 'g' + estimated + '입니다';
      if (feed.type === 'dry') {
        amount += '(150kcal는 약 ' + formatNumber(grams(150)) + 'g, 250kcal는 약 '
          + formatNumber(grams(250)) + 'g)';
      }
      sentences.push(amount + '.');

      const moisture = Number(feed.수분);
      if (feed.type === 'wet' && feed.수분 !== null && feed.수분 !== undefined
        && feed.수분 !== '' && Number.isFinite(moisture) && moisture > 0 && moisture <= 100) {
        const moistureMl = Math.round(200 * 1000 / kcalPerKg * moisture / 100);
        sentences.push('표시 수분 함량을 적용하면 수분량은 계산상 약 '
          + formatNumber(moistureMl) + 'mL입니다.');
      }
    }

    const ratio = Number(feed.ca_p_ratio);
    if (feed.ca_p_ratio !== null && feed.ca_p_ratio !== undefined && feed.ca_p_ratio !== ''
      && Number.isFinite(ratio) && ratio > 0) {
      sentences.push('등록된 칼슘:인 비율은 ' + formatNumber(ratio) + ':1입니다.');
    }

    sentences.push('필요량은 개체마다 다릅니다.');
    const calculator = species === 'dog' ? '/dog-food-calculator/' : '/cat-food-calculator/';
    const deepLink = canCalculate && feed.id && ['dry', 'wet'].includes(feed.type)
      ? '?feed=' + encodeURIComponent(String(feed.id)) + '&type=' + encodeURIComponent(feed.type)
      : '';
    return '<p class="food-metric-summary">' + escapeHtml(sentences.join(' '))
      + ' <a href="' + escapeHtml(calculator + deepLink)
      + '">내 반려동물 급여량 계산하기 →</a></p>';
  }

  const api = { render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ProvedFoodSummary = api;
})(typeof window !== 'undefined' ? window : null);
