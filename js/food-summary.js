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

  // FEDIAF Nutritional Guidelines, September 2025, Tables III-3a and III-4a.
  // These checks concern the Ca:P ratio only, not calcium/phosphorus absolute content
  // or the nutritional adequacy of an entire formula.
  function lifeStage(feed, species, name) {
    const raw = Array.isArray(feed._lifeStageSlugs) ? feed._lifeStageSlugs : [];
    const stages = new Set(raw.map(value => String(value).toLowerCase()));
    const isCat = species !== 'dog';
    const all = isCat ? 'all_life_stages_cat' : 'all_life_stages_dog';
    const growth = isCat ? 'kitten' : 'puppy';
    const adult = isCat ? 'adult_cat' : 'adult_dog';
    const senior = isCat ? 'senior_cat' : 'senior_dog';
    if (stages.has(all) || (stages.has(growth) && (stages.has(adult) || stages.has(senior)))) return 'all';
    if (stages.has(growth)) return 'growth';
    if (stages.has(adult) || stages.has(senior)) return 'adult';
    const title = String(name || feed.제품명 || '').toLowerCase().normalize('NFKC');
    if (/전연령|올라이프|all[ -]?life[ -]?stages|all[ -]?ages/.test(title)) return 'all';
    if (isCat) {
      if (/키튼|키텐|kitten|베이비캣|babycat|주니어|junior/.test(title)) return 'growth';
      if (/어덜트|adult|성묘|시니어|senior|에이징|aging|에이지드/.test(title)) return 'adult';
    } else {
      if (/퍼피|puppy|강아지용|주니어|junior|스타터|starter/.test(title)) return 'growth';
      if (/어덜트|adult|성견|시니어|senior|에이징|aging/.test(title)) return 'adult';
    }
    return 'unknown';
  }

  function fediafRatioText(feed, species, name, ratio) {
    const stage = lifeStage(feed, species, name);
    const isDog = species === 'dog';
    const adult = { name: '어덜트', low: 1, high: 2 };
    const growth = { name: isDog ? '초기 성장기' : '키튼', low: 1, high: isDog ? 1.6 : 1.5 };
    if (feed.완전식여부 !== '주식') {
      return 'FEDIAF(2025) 해당 비율은 주식 사료의 영양 권고 기준이므로, 보조식·분류 미확인 제품은 충족 여부를 판정하지 않습니다.';
    }
    const targets = stage === 'adult' ? [adult] : stage === 'growth' && isDog ? [growth] : [growth, adult];
    const passed = targets.filter(x => ratio >= x.low && ratio <= x.high);
    const failed = targets.filter(x => ratio < x.low || ratio > x.high);
    const display = x => x.name + '(1:1~' + formatNumber(x.high) + ':1)';
    const base = 'FEDIAF(2025) ';
    const unknown = stage === 'unknown';
    let text;
    if (failed.length === 0) {
      text = base + targets.map(display).join(' 및 ')
        + (unknown ? ' 칼슘:인 비율 범위에 해당합니다.' : ' 칼슘:인 비율 기준을 충족합니다.');
    } else if (passed.length === 0) {
      text = base + targets.map(display).join(' 및 ') + ' 칼슘:인 비율 기준을 벗어납니다.';
    } else {
      text = base + passed.map(display).join(' 및 ') + ' 비율 기준에는 해당하지만, '
        + failed.map(display).join(' 및 ') + ' 기준은 벗어납니다.';
    }
    if (unknown) text += ' 급여 대상 생애주기는 별도 확인이 필요합니다.';
    if (isDog && stage === 'growth' && ratio > 1.6) {
      text += ' 후기 성장기 상한은 품종에 따라 1.6~1.8:1로 달라집니다.';
    }
    return text;
  }

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
    const lastCharacter = name.slice(-1);
    const isHangulEnding = /^[가-힣]$/.test(lastCharacter);
    const topic = isHangulEnding
      ? ((lastCharacter.charCodeAt(0) - 0xAC00) % 28 === 0 ? '는' : '은')
      : ' 제품은';
    const paragraphs = [escapeHtml(name + topic + ' ' + origin + animal + ' ' + meal + form + '입니다.')];

    const kcalPerKg = Number(feed.final_me);
    const canCalculate = feed.완전식여부 === '주식'
      && feed.needs_calorie_review !== true
      && feed.cal_source !== 'manual_review'
      && feed.final_me !== null && feed.final_me !== undefined && feed.final_me !== ''
      && Number.isFinite(kcalPerKg) && kcalPerKg > 0;

    if (canCalculate) {
      const grams = kcal => Math.round(kcal * 1000 / kcalPerKg);
      const estimated = estimatedSources.has(feed.cal_source) ? '(추정 열량 기준)' : '';
      const amount = '만약 하루 에너지 필요량이 200kcal이고 이 제품만 급여한다면 약 '
        + formatNumber(grams(200)) + 'g' + estimated + '입니다.';
      const sublines = [];
      if (feed.type === 'dry') {
        sublines.push('(150kcal는 약 ' + formatNumber(grams(150)) + 'g, 250kcal는 약 '
          + formatNumber(grams(250)) + 'g).');
      }

      const moisture = Number(feed.수분);
      if (feed.type === 'wet' && feed.수분 !== null && feed.수분 !== undefined
        && feed.수분 !== '' && Number.isFinite(moisture) && moisture > 0 && moisture <= 100) {
        const moistureMl = Math.round(200 * 1000 / kcalPerKg * moisture / 100);
        sublines.push('약 ' + formatNumber(grams(200))
          + 'g 급여 시 사료로부터 섭취 가능한 수분량은 표시 수분 함량 기준 약 '
          + formatNumber(moistureMl) + 'mL입니다.');
      }
      paragraphs.push(escapeHtml(amount)
        + sublines.map(line => '<span class="food-metric-summary__subline">'
          + escapeHtml(line) + '</span>').join(''));
    }

    const ratio = Number(feed.ca_p_ratio);
    if (feed.ca_p_ratio !== null && feed.ca_p_ratio !== undefined && feed.ca_p_ratio !== ''
      && Number.isFinite(ratio) && ratio > 0) {
      let ratioText = '등록된 칼슘:인 비율은 ' + formatNumber(ratio) + ':1입니다.';
      ratioText += ' ' + fediafRatioText(feed, species, name, ratio);
      const ratioHtml = escapeHtml(ratioText).replace('FEDIAF(2025)',
        '<a href="https://www.europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025.pdf" target="_blank" rel="noopener noreferrer">FEDIAF(2025)</a>');
      paragraphs.push(ratioHtml + '<span class="food-metric-summary__subline">비율만 비교한 결과이며 칼슘·인의 절대 함량이나 전체 영양 적합성을 의미하지 않습니다.</span>');
    }

    const calculator = species === 'dog' ? '/dog-food-calculator/' : '/cat-food-calculator/';
    const deepLink = canCalculate && feed.id && ['dry', 'wet'].includes(feed.type)
      ? '?feed=' + encodeURIComponent(String(feed.id)) + '&type=' + encodeURIComponent(feed.type)
      : '';
    paragraphs.push('필요량은 개체마다 다릅니다. <a href="'
      + escapeHtml(calculator + deepLink) + '">내 반려동물 급여량 계산하기 →</a>');
    return '<div class="food-metric-summary">' + paragraphs.map(text => '<p>' + text + '</p>').join('')
      + '</div>';
  }

  const api = { render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ProvedFoodSummary = api;
})(typeof window !== 'undefined' ? window : null);
