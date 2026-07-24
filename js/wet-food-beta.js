// -----------------------------------------------
// 습식 후보 찾기 v0.1 베타
// - 외부 AI API 호출 없이 Supabase feeds DB + 로컬 규칙만 사용합니다.
// -----------------------------------------------

/** @typedef {'dry_only'|'dry_and_wet'|'wet_only'|'not_fixed'} DietPattern */
/** @typedef {'hydration'|'wet_intro'|'daily_wet'|'change_or_add'|'weight_concern'|'dont_know'} WetGoal */
/** @typedef {'almost_none'|'sometimes'|'some_favorites'|'daily'|'mixed_response'} WetExperience */
/** @typedef {'will_not_eat'|'weight_gain'|'ingredient_review'} MainConcern */
/** @typedef {'dry'|'wet'|'both'|'skip'} CurrentFoodInput */
/** @typedef {'dry_based_wet_intro'|'dry_wet_combination_adjustment'|'dry_wet_combination_palatable_addition'|'wet_based_main_management'|'wet_based_main_intro'|'hydration_support'|'weight_control_support'|'ingredient_stability_review'|'broad_exploration'} WetFoodScenario */

const WET_FOOD_FIELDS = 'id,type,제조사,제품명,완전식여부,메인단백질,전성분,조단백,조지방,수분,칼슘,인,ca_p_ratio,final_me,cal_unit,calorie_confidence,verified,겔화제,image_url,쿠팡_링크';

const wetFoodQuestions = [
  { key: 'dietPattern', title: '최근 7일 기준, 고양이가 식사로 반복해서 먹은 사료 형태는 무엇인가요?', description: '간식, 토핑, 츄르는 제외하고 골라주세요.', options: [
    ['dry_only', '건사료만 주식이에요', '습식은 안 먹거나 가끔만 먹어요.'],
    ['dry_and_wet', '건사료와 습식을 둘 다 먹어요', '둘 다 식사처럼 반복해서 먹어요.'],
    ['wet_only', '습식만 주식이에요', '건사료는 안 먹거나 가끔만 먹어요.'],
    ['not_fixed', '아직 정해진 주식이 없어요', '이것저것 테스트 중이에요.']
  ]},
  { key: 'wetGoal', title: '이번에 습식을 찾는 가장 가까운 이유는 무엇인가요?', description: '하나만 골라도 괜찮아요. 나중에 더 좁혀볼 수 있어요.', options: [
    ['hydration', '물을 잘 안 마셔서요', '수분 보충용 습식을 찾고 있어요.'],
    ['wet_intro', '건식만 먹어서 습식도 먹여보고 싶어요', '처음 시작하기 쉬운 제품을 보고 싶어요.'],
    ['daily_wet', '매일 먹일 습식을 찾고 있어요', '주식처럼 먹일 수 있는 후보를 보고 싶어요.'],
    ['change_or_add', '지금 먹는 습식을 바꾸거나 추가하고 싶어요', '기존 식단에 더할 후보를 찾고 있어요.'],
    ['weight_concern', '살이 찌는 게 걱정돼요', '열량 부담이 적은 후보를 보고 싶어요.'],
    ['dont_know', '뭘 골라야 할지 모르겠어요', '먼저 넓게 비교해보고 싶어요.']
  ]},
  { key: 'wetExperience', title: '최근 한 달 안에 습식을 먹여본 적이 있나요?', description: '캔, 파우치, 트레이 형태의 습식을 기준으로 골라주세요.', options: [
    ['almost_none', '거의 없어요', '이번이 첫 시도에 가까워요.'],
    ['sometimes', '가끔 먹여봤어요', '잘 먹는 제품은 아직 확실하지 않아요.'],
    ['some_favorites', '잘 먹는 제품이 몇 개 있어요', '먹는 습식이 어느 정도 정해져 있어요.'],
    ['daily', '매일 먹고 있어요', '습식이 식사에 이미 들어가 있어요.'],
    ['mixed_response', '먹이긴 했지만 반응이 들쭉날쭉해요', '어떤 건 먹고 어떤 건 잘 안 먹어요.']
  ]},
  { key: 'mainConcern', title: '습식을 고를 때 가장 걱정되는 점은 무엇인가요?', description: '지금 가장 신경 쓰이는 것 하나만 골라주세요.', options: [
    ['will_not_eat', '안 먹을까 봐 걱정돼요', '기호성 테스트가 먼저 필요해요.'],
    ['weight_gain', '살이 찔까 봐 걱정돼요', '열량과 지방을 같이 보고 싶어요.'],
    ['ingredient_review', '성분을 어떻게 봐야 할지 모르겠어요', '영양 정보와 겔화제 정보를 함께 비교하고 싶어요.']
  ]},
  { key: 'currentFoodInput', title: '지금 먹는 사료를 입력하면 후보를 더 정확하게 좁힐 수 있어요.', description: '제품명을 몰라도 건너뛸 수 있어요.', options: [
    ['dry', '건사료 제품명을 입력할게요', '현재 주식 건사료가 있어요.'],
    ['wet', '습식 제품명을 입력할게요', '이미 먹고 있는 습식이 있어요.'],
    ['both', '둘 다 입력할게요', '건식과 습식을 같이 먹이고 있어요.'],
    ['skip', '지금은 건너뛸게요', '먼저 넓은 후보를 보고 싶어요.']
  ]}
];

const wetFoodBetaState = { step: 0, answers: {}, isLoading: false };

function getWetFoodScenario(answers) {
  if (answers.mainConcern === 'ingredient_review') return 'ingredient_stability_review';
  if (answers.wetGoal === 'weight_concern' || answers.mainConcern === 'weight_gain') return 'weight_control_support';
  if (answers.wetGoal === 'hydration') return 'hydration_support';
  if (answers.dietPattern === 'dry_and_wet' && answers.wetGoal === 'change_or_add' && answers.mainConcern === 'will_not_eat') return 'dry_wet_combination_palatable_addition';
  if (answers.dietPattern === 'dry_only' && answers.wetGoal === 'wet_intro') return 'dry_based_wet_intro';
  if (answers.dietPattern === 'dry_and_wet' && answers.wetGoal === 'change_or_add') return 'dry_wet_combination_adjustment';
  if (answers.dietPattern === 'wet_only' && answers.wetExperience === 'daily') return 'wet_based_main_management';
  if (answers.dietPattern === 'not_fixed' && answers.wetGoal === 'daily_wet') return 'wet_based_main_intro';
  return 'broad_exploration';
}

function getScenarioSummary(scenario) {
  return {
    dry_based_wet_intro: '현재는 건식 중심 식단에서 습식을 처음 시도하는 단계에 가까워요.\n처음부터 주식 습식을 고르기보다, 소량으로 반응을 확인하기 쉬운 후보를 먼저 보여드릴게요.',
    dry_wet_combination_adjustment: '현재는 건식과 습식을 함께 먹는 식단이에요.\n습식만 따로 보기보다, 기존 식단에 더했을 때 부담이 적은 후보를 우선 보여드릴게요.',
    dry_wet_combination_palatable_addition: '현재는 건식과 습식을 함께 먹고 있고, 새로운 습식을 잘 먹을지가 가장 걱정되는 상황이에요.\n기존 식단에 소량 더해보며 반응을 확인하기 좋은 후보를 우선 보여드릴게요.',
    wet_based_main_management: '현재는 습식이 식사의 중심에 가까워요.\n매일 먹이는 식단이라면 제품을 자주 바꾸기보다, 영양 정보와 급여 편중을 함께 보는 게 좋아요.',
    wet_based_main_intro: '습식을 주식처럼 시작하려는 단계예요.\n잘 먹는 제품보다 먼저, 매일 먹일 수 있는 기본 조건을 갖춘 후보부터 보여드릴게요.',
    hydration_support: '수분 보충을 목적으로 습식을 찾는 상황이에요.\n건식과 함께 먹이기 쉽고, 열량 부담이 과하지 않은 후보를 먼저 보여드릴게요.',
    weight_control_support: '체중 증가가 걱정되는 상황이에요.\n열량과 지방 부담이 비교적 낮은 후보를 우선 보여드릴게요.',
    ingredient_stability_review: '성분표를 직접 비교하기 어려운 상황이에요.\n완전식 여부와 칼슘·인, 열량 정보처럼 확인 가능한 자료가 충분한 제품을 먼저 보여드릴게요. 겔화제 정보도 함께 확인하되, 정보가 없는 제품을 미사용 제품으로 판단하지는 않아요.',
    broad_exploration: '아직 방향을 정하는 단계예요.\n처음부터 하나의 정답을 고르기보다, 비교를 시작하기 좋은 후보를 넓게 보여드릴게요.'
  }[scenario];
}

const reasonTextMap = {
  verified: '검수된 DB 항목이라 비교 기준으로 삼기 좋아요.', complete_food: '주식으로 등록된 제품이라 매일 급여 후보로 검토하기 좋아요.', ca_p_available: '칼슘·인 정보가 확인되어 장기급여 검토에 도움이 돼요.', ca_p_balanced: 'Ca:P 비율이 비교하기 쉬운 범위에 있어요.', calorie_available: '열량 정보가 있어 기존 식단과 함께 양을 조절하기 좋아요.', high_confidence_calorie: '열량 신뢰도가 높게 표시되어 있어요.', moderate_calorie: '열량 부담이 과하지 않아 건식과 함께 먹이기 비교적 좋아요.', low_calorie: '열량이 낮은 편이라 총열량을 보며 조절하기 좋아요.', low_fat: '지방이 낮은 편이라 기존 식단에 소량 더해보기 좋아요.', moderate_fat: '지방이 과하게 높지 않아 병행 후보로 보기 좋아요.', protein_diversity: '현재 식단과 다른 단백질원이라 식단이 한쪽으로 치우치는 것을 줄이는 데 도움이 돼요.', high_moisture: '수분이 높은 편이라 수분 보충 목적에 잘 맞아요.', palatable_test: '처음에는 많이 바꾸기보다 먹는지 확인하는 테스트 후보로 보기 좋아요.', main_food_review: '주식 조건을 함께 확인해볼 후보예요.', gel_explicit_none: 'DB에 입력된 정보상 겔화제 미사용이 확인된 제품이에요.', gel_known_no_carrageenan: 'DB에 입력된 겔화제 정보에서는 카라기난이 확인되지 않았어요.'
};
const cautionTextMap = {
  unknown_complete: '완전식 여부가 확인되지 않아 단독 주식으로 장기급여 판단은 제한적이에요.', missing_ca_p: '칼슘·인 정보가 부족해 장기급여 판단에는 추가 확인이 필요해요.', high_fat: '지방이 높은 편이라 건식과 함께 먹일 때 총 급여량 조절이 필요해요.', high_calorie: '열량이 높은 편이라 기존 건식 양을 그대로 두고 추가하면 총열량이 늘 수 있어요.', repeated_protein: '현재 식단과 단백질원이 겹칠 수 있어요.', fish_repetition: '현재 식단에 생선 계열이 이미 있다면 너무 자주 반복되지 않게 확인해 주세요.', missing_ca_p_ratio: 'Ca:P 정보가 부족해 비율 비교에는 추가 확인이 필요해요.', missing_calorie: '열량 정보가 부족해 급여량 비교에는 추가 확인이 필요해요.', gel_carrageenan: '겔화제 정보에 카라기난이 포함되어 있어요.', gel_unknown: '겔화제 정보가 입력되지 않아 사용 여부를 확인하기 어려워요.'
};

function toNumber(value) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function includesCode(list, code) { return list.includes(code); }
function pushUnique(list, code) { if (!list.includes(code)) list.push(code); }
const PROTEIN_ALIASES = {
  chicken: ['닭', '닭고기', '닭가슴살', '닭가슴', '계육', '치킨', 'chicken', 'poultry'],
  duck: ['오리', '오리고기', 'duck'],
  turkey: ['칠면조', '터키', 'turkey'],
  beef: ['소', '소고기', '쇠고기', '우육', '비프', 'beef'],
  pork: ['돼지', '돼지고기', '돈육', '포크', 'pork'],
  lamb: ['양', '양고기', '램', 'lamb', 'mutton'],
  salmon: ['연어', '살몬', 'salmon'],
  tuna: ['참치', '튜나', 'tuna'],
  herring: ['청어', 'herring'],
  shrimp: ['새우', '쉬림프', 'shrimp', 'prawn'],
  bonito: ['가다랑어', '가쓰오', 'bonito', 'skipjack', 'skipjack tuna'],
  whitefish: ['흰살생선', '백색어', 'whitefish', 'white fish'],
  fish: ['생선', '어류', 'fish'],
  sardine: ['정어리', 'sardine'],
  mackerel: ['고등어', '매커럴', 'mackerel'],
  pollock: ['명태', '대구', '폴락', 'pollock', 'cod'],
  rabbit: ['토끼', '래빗', 'rabbit'],
  venison: ['사슴', '사슴고기', '베니슨', 'venison', 'deer'],
  quail: ['메추리', '퀘일', 'quail'],
  goat: ['염소', '염소고기', 'goat'],
  wallaby: ['왈라비', 'wallaby'],
  kangaroo: ['캥거루', 'kangaroo']
};
const PROTEIN_LABELS = {
  chicken: '닭',
  duck: '오리',
  turkey: '칠면조',
  beef: '소',
  pork: '돼지',
  lamb: '양',
  salmon: '연어',
  tuna: '참치',
  herring: '청어',
  shrimp: '새우',
  bonito: '가다랑어',
  whitefish: '흰살생선',
  fish: '생선',
  sardine: '정어리',
  mackerel: '고등어',
  pollock: '명태·대구',
  rabbit: '토끼',
  venison: '사슴',
  quail: '메추리',
  goat: '염소',
  wallaby: '왈라비',
  kangaroo: '캥거루'
};
const FISH_PROTEINS = new Set(['salmon', 'tuna', 'sardine', 'mackerel', 'pollock', 'herring', 'bonito', 'whitefish', 'fish']);
const RISKY_SINGLE_KOREAN_ALIASES = new Set(['닭', '소', '양']);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isEnglishAlias(alias) {
  return /^[a-z ]+$/i.test(alias);
}

function isKoreanAlias(alias) {
  return /[가-힣]/.test(alias);
}

function aliasMatchesText(text, alias, source) {
  if (!text || !alias) return false;

  const raw = String(text);
  const normalizedText = raw.toLowerCase();
  const normalizedAlias = String(alias).toLowerCase();

  if (isEnglishAlias(alias)) {
    return new RegExp(`\\b${escapeRegExp(normalizedAlias)}\\b`, 'i').test(raw);
  }

  if (isKoreanAlias(alias) && RISKY_SINGLE_KOREAN_ALIASES.has(alias)) {
    if (source !== 'mainProtein') return false;

    const tokenPattern = new RegExp(`(^|[^가-힣a-zA-Z])${escapeRegExp(alias)}([^가-힣a-zA-Z]|$)`, 'i');
    return tokenPattern.test(raw);
  }

  if (isKoreanAlias(alias)) {
    return normalizedText.includes(normalizedAlias);
  }

  return false;
}

function removeGenericFishWhenSpecificExists(proteins) {
  const specificFish = proteins.filter(protein => FISH_PROTEINS.has(protein) && protein !== 'fish');
  if (specificFish.length === 0) return proteins;

  return proteins.filter(protein => protein !== 'fish');
}

function extractProteinKeywords(text, options = {}) {
  if (text === null || text === undefined || String(text).trim() === '') return [];

  const source = options.source || 'productName';
  const proteins = [];

  Object.entries(PROTEIN_ALIASES).forEach(([proteinCode, aliases]) => {
    const sortedAliases = [...aliases].sort((a, b) => b.length - a.length);
    if (sortedAliases.some(alias => aliasMatchesText(text, alias, source))) {
      proteins.push(proteinCode);
    }
  });

  return removeGenericFishWhenSpecificExists(proteins);
}

function getFeedProteins(feed) {
  const mainProteins = extractProteinKeywords(feed?.메인단백질, { source: 'mainProtein' });
  if (mainProteins.length > 0) return mainProteins;

  const ingredientProteins = extractProteinKeywords(feed?.전성분, { source: 'ingredients' });
  if (ingredientProteins.length > 0) return ingredientProteins;

  return extractProteinKeywords(feed?.제품명, { source: 'productName' });
}

function hasRepeatedProtein(feed, currentProteins) {
  const candidateProteins = new Set(getFeedProteins(feed));
  return currentProteins.some(protein => candidateProteins.has(protein));
}

function hasDifferentProtein(feed, currentProteins) {
  const candidateProteins = getFeedProteins(feed);
  return currentProteins.length > 0
    && candidateProteins.length > 0
    && candidateProteins.every(protein => !currentProteins.includes(protein));
}

function hasFishProtein(feed) {
  return getFeedProteins(feed).some(protein => FISH_PROTEINS.has(protein));
}

function formatProteinLabels(proteins) {
  return proteins.map(protein => PROTEIN_LABELS[protein] || protein);
}

function normalizeProductName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function selectMatchedFeed(data, inputText) {
  if (!Array.isArray(data) || data.length === 0) return null;

  const normalizedInput = normalizeProductName(inputText);
  const exactMatch = data.find(feed => normalizeProductName(feed.제품명) === normalizedInput);
  if (exactMatch) return exactMatch;

  if (data.length === 1) return data[0];

  return null;
}

function getGelInfo(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { isKnown: false, isExplicitlyNone: false, hasCarrageenan: false, label: '정보 없음' };
  }

  const text = String(value).trim();
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  const explicitNoneValues = ['없음', '미사용', '무첨가', '사용하지않음'];
  const isExplicitlyNone = explicitNoneValues.includes(normalized)
    || /^(겔화제|점증제)?(없음|미사용|무첨가|사용하지않음)$/.test(normalized);
  const hasCarrageenan = normalized.includes('카라기난');

  return {
    isKnown: true,
    isExplicitlyNone,
    hasCarrageenan,
    label: text
  };
}

function sortReasonCodes(reasonCodes, scenario) {
  if (scenario !== 'ingredient_stability_review') return reasonCodes;

  const priority = [
    'complete_food',
    'ca_p_available',
    'ca_p_balanced',
    'gel_explicit_none',
    'gel_known_no_carrageenan',
    'calorie_available',
    'high_confidence_calorie',
    'verified'
  ];

  return [...reasonCodes].sort((a, b) => {
    const aIndex = priority.includes(a) ? priority.indexOf(a) : priority.length;
    const bIndex = priority.includes(b) ? priority.indexOf(b) : priority.length;
    return aIndex - bIndex;
  });
}

function scoreWetFoodCandidate(feed, context) {
  if (!feed || feed.type !== 'wet') return { score: -999, candidateType: '정보 확인 필요 후보', reasonCodes: [], cautionCodes: ['unknown_complete'] };
  let score = 0;
  const reasonCodes = [];
  const cautionCodes = [];
  const fat = toNumber(feed.조지방), moisture = toNumber(feed.수분), kcal = toNumber(feed.final_me), cap = toNumber(feed.ca_p_ratio);
  const ca = toNumber(feed.칼슘), p = toNumber(feed.인);
  const complete = String(feed.완전식여부 || '').trim();
  const gelInfo = getGelInfo(feed.겔화제);

  if (feed.verified === true) { score += 8; pushUnique(reasonCodes, 'verified'); }
  if (complete === '주식') { score += 14; pushUnique(reasonCodes, 'complete_food'); }
  if (ca != null && p != null) { score += 8; pushUnique(reasonCodes, 'ca_p_available'); } else { score -= 4; pushUnique(cautionCodes, 'missing_ca_p'); }
  if (cap != null && cap >= 1 && cap <= 2) { score += 8; pushUnique(reasonCodes, 'ca_p_balanced'); }
  if (kcal != null) { score += 5; pushUnique(reasonCodes, 'calorie_available'); }
  if (feed.calorie_confidence === 'high') { score += 4; pushUnique(reasonCodes, 'high_confidence_calorie'); }
  if (complete === '확인불가' || !complete) { score -= 8; pushUnique(cautionCodes, 'unknown_complete'); }
  if (kcal != null && kcal > 1250) { score -= 7; pushUnique(cautionCodes, 'high_calorie'); }
  if (fat != null && fat >= 6) { score -= 6; pushUnique(cautionCodes, 'high_fat'); }
  if (hasRepeatedProtein(feed, context.currentProteins || [])) { score -= 5; pushUnique(cautionCodes, 'repeated_protein'); }
  else if (hasDifferentProtein(feed, context.currentProteins || [])) { score += 7; pushUnique(reasonCodes, 'protein_diversity'); }
  if (hasFishProtein(feed) && (context.currentProteins || []).some(p => FISH_PROTEINS.has(p))) pushUnique(cautionCodes, 'fish_repetition');

  let candidateType = '먼저 테스트해볼 후보';
  switch (context.scenario) {
    case 'dry_based_wet_intro':
      candidateType = '기호성 테스트 후보'; pushUnique(reasonCodes, 'palatable_test');
      if (kcal != null && kcal <= 1050) { score += 8; pushUnique(reasonCodes, 'moderate_calorie'); }
      if (fat != null && fat < 4.5) { score += 7; pushUnique(reasonCodes, 'low_fat'); }
      if (complete !== '보조식') score += 4;
      break;
    case 'dry_wet_combination_adjustment':
      candidateType = '건식 병행 후보';
      if (ca != null && p != null) score += 5;
      if (fat != null && fat < 5.5) { score += 6; pushUnique(reasonCodes, fat < 3.5 ? 'low_fat' : 'moderate_fat'); }
      break;
    case 'dry_wet_combination_palatable_addition':
      candidateType = '기호성 테스트 후보'; pushUnique(reasonCodes, 'palatable_test');
      if (fat != null && fat < 5.5) { score += 7; pushUnique(reasonCodes, fat < 3.5 ? 'low_fat' : 'moderate_fat'); }
      if (moisture != null && moisture >= 78) { score += 7; pushUnique(reasonCodes, 'high_moisture'); }
      if (complete === '주식' && ca != null && p != null) score += 7;
      if (hasFishProtein(feed)) score -= 2;
      break;
    case 'wet_based_main_management':
      candidateType = '주식 검토 후보'; pushUnique(reasonCodes, 'main_food_review');
      if (complete === '주식') score += 10;
      if (ca != null && p != null) score += 6;
      if (cap != null && cap >= 1 && cap <= 2) score += 6;
      break;
    case 'weight_control_support':
      candidateType = '체중관리 고려 후보';
      if (kcal != null && kcal <= 950) { score += 12; pushUnique(reasonCodes, 'low_calorie'); }
      else if (kcal != null && kcal <= 1100) { score += 7; pushUnique(reasonCodes, 'moderate_calorie'); }
      if (fat != null && fat < 3.5) { score += 12; pushUnique(reasonCodes, 'low_fat'); }
      break;
    case 'hydration_support':
      candidateType = '수분 보충 후보';
      if (moisture != null && moisture >= 80) { score += 14; pushUnique(reasonCodes, 'high_moisture'); }
      if (kcal != null && kcal <= 1100) { score += 6; pushUnique(reasonCodes, 'moderate_calorie'); }
      break;
    case 'wet_based_main_intro':
      candidateType = '주식 검토 후보'; pushUnique(reasonCodes, 'main_food_review');
      if (complete === '주식') score += 10;
      if (ca != null && p != null) score += 5;
      break;
    case 'ingredient_stability_review':
      candidateType = '성분 정보 비교 후보';
      if (complete === '주식') score += 10;
      if (ca != null && p != null) score += 8;
      if (cap != null && cap >= 1 && cap <= 2) score += 8;
      if (kcal != null) score += 5;
      else { score -= 4; pushUnique(cautionCodes, 'missing_calorie'); }
      if (feed.calorie_confidence === 'high') score += 5;
      if (cap == null) { score -= 3; pushUnique(cautionCodes, 'missing_ca_p_ratio'); }

      if (gelInfo.isExplicitlyNone) { score += 8; pushUnique(reasonCodes, 'gel_explicit_none'); }
      else if (gelInfo.isKnown && !gelInfo.hasCarrageenan) { score += 4; pushUnique(reasonCodes, 'gel_known_no_carrageenan'); }
      else if (gelInfo.hasCarrageenan) { score -= 3; pushUnique(cautionCodes, 'gel_carrageenan'); }
      else { score -= 2; pushUnique(cautionCodes, 'gel_unknown'); }
      break;
    default:
      candidateType = complete === '주식' ? '주식 검토 후보' : '먼저 테스트해볼 후보';
  }
  if (includesCode(cautionCodes, 'unknown_complete') || includesCode(cautionCodes, 'missing_ca_p')) candidateType = score < 18 ? '정보 확인 필요 후보' : candidateType;
  return { score, candidateType, reasonCodes: sortReasonCodes(reasonCodes, context.scenario), cautionCodes };
}

function formatValue(v, suffix = '') { const n = toNumber(v); return n == null ? '정보 없음' : `${Number.isInteger(n) ? n : n.toFixed(1)}${suffix}`; }
function formatKcal(feed) { const kcal = toNumber(feed.final_me); if (kcal == null) return '열량 정보 없음'; return `${Math.round(kcal)} kcal/kg · 약 ${Math.round(kcal / 10)} kcal/100g${feed.cal_unit ? ` (${feed.cal_unit})` : ''}`; }

async function findCurrentFoodProteins(answers) {
  const inputs = [];
  if ((answers.currentFoodInput === 'dry' || answers.currentFoodInput === 'both') && answers.dryFood) inputs.push({ type: 'dry', text: answers.dryFood });
  if ((answers.currentFoodInput === 'wet' || answers.currentFoodInput === 'both') && answers.wetFoods) String(answers.wetFoods).split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(text => inputs.push({ type: 'wet', text }));
  const proteins = new Set();

  await Promise.all(inputs.map(async input => {
    try {
      const { data, error } = await sb
        .from('feeds')
        .select('id,제조사,메인단백질,전성분,제품명')
        .eq('type', input.type)
        .eq('verified', true)
        .ilike('제품명', `%${input.text}%`)
        .limit(10);
      const matchedFeed = error ? null : selectMatchedFeed(data, input.text);
      if (matchedFeed) {
        getFeedProteins(matchedFeed).forEach(protein => proteins.add(protein));
        return;
      }
    } catch (e) { console.warn('current food lookup failed', e); }

    extractProteinKeywords(input.text, { source: 'productName' }).forEach(protein => proteins.add(protein));
  }));

  return [...proteins];
}

async function fetchWetFoodCandidates() {
  const pageSize = 1000;
  let from = 0;
  const allFeeds = [];

  while (true) {
    const { data, error } = await sb
      .from('feeds')
      .select(WET_FOOD_FIELDS)
      .eq('type', 'wet')
      .eq('verified', true)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return { data: null, error };

    allFeeds.push(...(data || []));

    if (!data || data.length < pageSize) break;

    from += pageSize;
  }

  return { data: allFeeds, error: null };
}

function groupCandidates(scored) {
  const groups = { '먼저 테스트해볼 후보': [], '건식과 함께 먹이기 좋은 후보': [], '주식으로 검토 가능한 후보': [], '확인이 필요한 후보': [], '수분 보충 후보': [], '체중관리 고려 후보': [], '성분 정보를 비교하기 좋은 후보': [] };
  scored.forEach(item => {
    const key = item.scoreInfo.candidateType === '건식 병행 후보' ? '건식과 함께 먹이기 좋은 후보' : item.scoreInfo.candidateType === '주식 검토 후보' ? '주식으로 검토 가능한 후보' : item.scoreInfo.candidateType === '정보 확인 필요 후보' ? '확인이 필요한 후보' : item.scoreInfo.candidateType === '성분 정보 비교 후보' ? '성분 정보를 비교하기 좋은 후보' : item.scoreInfo.candidateType;
    (groups[key] || groups['먼저 테스트해볼 후보']).push(item);
  });
  return Object.entries(groups).filter(([, items]) => items.length).map(([title, items]) => [title, items.slice(0, 6)]);
}

function renderWetFoodCandidateCard(item) {
  const f = item.feed, s = item.scoreInfo;
  const reasons = s.reasonCodes.slice(0, 4).map(c => `<li>${reasonTextMap[c] || c}</li>`).join('') || '<li>현재 답변 기준에서 비교를 시작할 수 있는 후보예요.</li>';
  const cautions = s.cautionCodes.slice(0, 3).map(c => `<li>${cautionTextMap[c] || c}</li>`).join('') || '<li>처음에는 소량으로 반응을 확인해 주세요.</li>';
  return `<article class="wet-beta-card bg-white border border-gray-100 rounded-3xl p-4 shadow-sm space-y-4">
    <div class="flex gap-4">
      ${f.image_url ? `<img src="${f.image_url}" alt="" class="w-20 h-20 rounded-2xl object-cover bg-gray-50" loading="lazy">` : `<div class="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl">🥫</div>`}
      <div class="flex-1 min-w-0"><p class="text-xs font-black text-blue-400">${f.제조사 || '제조사 정보 없음'}</p><h4 class="font-black text-gray-800 leading-snug">${f.제품명 || '제품명 정보 없음'}</h4><p class="inline-block mt-2 px-3 py-1 bg-gray-100 rounded-full text-[11px] font-black text-gray-500">${s.candidateType}</p></div>
    </div>
    <p class="text-xs font-bold text-gray-500 leading-relaxed">이 제품은 현재 답변 기준에서 비교를 시작하기 좋은 후보예요. 확정 추천이 아니라, 기존 식단에 소량 더해보며 반응을 확인하기 위한 후보로 봐주세요.</p>
    <div class="grid grid-cols-2 gap-2 text-xs">
      ${[['완전식 여부', f.완전식여부 || '확인 필요'], ['메인단백질', f.메인단백질 || '정보 없음'], ['열량', formatKcal(f)], ['조단백', formatValue(f.조단백, '%')], ['조지방', formatValue(f.조지방, '%')], ['수분', formatValue(f.수분, '%')], ['칼슘', formatValue(f.칼슘, '%')], ['인', formatValue(f.인, '%')], ['Ca:P', formatValue(f.ca_p_ratio)], ['겔화제', getGelInfo(f.겔화제).label]].map(([k,v]) => `<div class="bg-gray-50 rounded-2xl p-3"><p class="text-[10px] font-black text-gray-400">${k}</p><p class="font-bold text-gray-700 mt-1">${v}</p></div>`).join('')}
    </div>
    <div class="grid md:grid-cols-2 gap-3 text-xs leading-relaxed"><div class="bg-blue-50 rounded-2xl p-3"><p class="font-black text-blue-500 mb-1">이유</p><ul class="list-disc pl-4 text-gray-600 space-y-1">${reasons}</ul></div><div class="bg-orange-50 rounded-2xl p-3"><p class="font-black text-orange-500 mb-1">확인하면 좋은 점</p><ul class="list-disc pl-4 text-gray-600 space-y-1">${cautions}</ul></div></div>
    ${f.쿠팡_링크 ? `<a href="${f.쿠팡_링크}" target="_blank" rel="noopener" class="block text-center py-3 rounded-2xl bg-gray-900 text-white text-xs font-black">제품 정보 보기</a>` : ''}
  </article>`;
}

function renderWetFoodBeta() {
  const root = document.getElementById('wetFoodBetaRoot'); if (!root) return;
  const q = wetFoodQuestions[wetFoodBetaState.step];
  const progress = Math.round(((wetFoodBetaState.step + 1) / wetFoodQuestions.length) * 100);
  root.innerHTML = `<section class="space-y-5"><div class="pc-info-card p-5 bg-white rounded-3xl border border-gray-100 shadow-sm"><p class="text-xs font-black text-blue-400 mb-2">습식 후보 찾기 v0.1 베타 · ${wetFoodBetaState.step + 1}/${wetFoodQuestions.length}</p><div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-5"><div class="h-full bg-[#2d7dd2]" style="width:${progress}%"></div></div><h2 class="text-xl font-black text-gray-800 leading-snug">${q.title}</h2><p class="text-sm font-bold text-gray-400 mt-2 leading-relaxed">${q.description}</p><div class="mt-5 space-y-2">${q.options.map(([code,label,desc]) => `<button type="button" onclick="selectWetFoodAnswer('${q.key}','${code}')" class="w-full text-left p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-100"><p class="font-black text-gray-800">${label}</p><p class="text-xs font-bold text-gray-400 mt-1">${desc}</p></button>`).join('')}</div></div></section>`;
}

function selectWetFoodAnswer(key, code) {
  wetFoodBetaState.answers[key] = code;
  if (key === 'currentFoodInput' && code !== 'skip') return renderWetFoodInputs();
  if (wetFoodBetaState.step < wetFoodQuestions.length - 1) { wetFoodBetaState.step += 1; renderWetFoodBeta(); } else runWetFoodBeta();
}
function renderWetFoodInputs() {
  const root = document.getElementById('wetFoodBetaRoot'), input = wetFoodBetaState.answers.currentFoodInput;
  root.innerHTML = `<section class="pc-info-card p-5 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4"><p class="text-xs font-black text-blue-400">현재 먹는 사료 입력</p><h2 class="text-xl font-black text-gray-800">제품명을 일부만 입력해도 괜찮아요.</h2>${input === 'dry' || input === 'both' ? `<input id="wetBetaDryFood" class="w-full p-4 bg-gray-50 rounded-2xl font-bold border border-gray-100" placeholder="건사료 제품명">` : ''}${input === 'wet' || input === 'both' ? `<textarea id="wetBetaWetFoods" rows="4" class="w-full p-4 bg-gray-50 rounded-2xl font-bold border border-gray-100" placeholder="습식 제품명 (여러 개는 쉼표 또는 줄바꿈)"></textarea>` : ''}<button onclick="runWetFoodBeta()" class="w-full py-4 bg-[#2d7dd2] text-white rounded-2xl font-black">후보 보기</button><button onclick="wetFoodBetaState.answers.currentFoodInput='skip'; runWetFoodBeta()" class="w-full py-3 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm">입력 없이 계속하기</button></section>`;
}

async function runWetFoodBeta() {
  if (wetFoodBetaState.isLoading) return;
  wetFoodBetaState.isLoading = true;
  wetFoodBetaState.answers.dryFood = document.getElementById('wetBetaDryFood')?.value || '';
  wetFoodBetaState.answers.wetFoods = document.getElementById('wetBetaWetFoods')?.value || '';
  const root = document.getElementById('wetFoodBetaRoot'); root.innerHTML = '<div class="p-6 bg-white rounded-3xl text-center font-black text-blue-400">후보를 불러오는 중이에요...</div>';
  const scenario = getWetFoodScenario(wetFoodBetaState.answers);
  try {
    const [currentProteins, result] = await Promise.all([findCurrentFoodProteins(wetFoodBetaState.answers), fetchWetFoodCandidates()]);
    if (result.error) throw result.error;
    const scored = (result.data || []).map(feed => ({ feed, scoreInfo: scoreWetFoodCandidate(feed, { scenario, currentProteins }) })).filter(x => x.scoreInfo.score > -100).sort((a,b) => b.scoreInfo.score - a.scoreInfo.score).slice(0, 18);
    renderWetFoodResults(scenario, currentProteins, scored, null);
  } catch (error) { renderWetFoodResults(scenario, [], [], error); }
  wetFoodBetaState.isLoading = false;
}

function renderWetFoodResults(scenario, currentProteins, scored, error) {
  const root = document.getElementById('wetFoodBetaRoot');
  const groups = groupCandidates(scored);
  root.innerHTML = `<section class="space-y-5"><div class="p-5 bg-blue-50 rounded-3xl border border-blue-100"><p class="text-xs font-black text-blue-400 mb-2">상황 요약</p><p class="text-base font-bold text-gray-800 leading-relaxed whitespace-pre-line">${getScenarioSummary(scenario)}</p>${currentProteins.length ? `<p class="mt-3 text-xs font-bold text-blue-500">현재 식단 단백질 참고: ${formatProteinLabels(currentProteins).join(', ')}</p>` : ''}</div>${error ? `<div class="p-5 bg-red-50 rounded-3xl text-sm font-bold text-red-500 leading-relaxed">Supabase 조회에 실패했어요. 잠시 후 다시 시도해 주세요.<br>${error.message || error}</div>` : ''}${!error && !scored.length ? `<div class="p-5 bg-gray-50 rounded-3xl text-sm font-bold text-gray-500 leading-relaxed">조건에 맞는 습식 후보를 찾지 못했어요. DB가 업데이트되면 후보가 표시됩니다.</div>` : ''}${groups.map(([title, items]) => `<div class="space-y-3"><h3 class="text-lg font-black text-gray-800">${title}</h3>${items.map(renderWetFoodCandidateCard).join('')}</div>`).join('')}<div class="p-5 bg-gray-50 rounded-3xl space-y-2"><p class="font-black text-gray-700">더 좁혀보기</p>${['먹고 난 뒤 반응도 반영하기','가격대도 같이 보기','후보 수 줄이기'].map(t => `<button disabled class="w-full py-3 rounded-2xl bg-white border border-gray-100 text-gray-300 font-black text-sm">${t} · 다음 버전 예정</button>`).join('')}</div><button onclick="resetWetFoodBeta()" class="w-full py-4 bg-gray-900 text-white rounded-2xl font-black">처음부터 다시 하기</button></section>`;
}
function resetWetFoodBeta() { wetFoodBetaState.step = 0; wetFoodBetaState.answers = {}; renderWetFoodBeta(); }

if (typeof window !== 'undefined') {
  window.renderWetFoodBeta = renderWetFoodBeta;

  if (document.readyState === 'loading') {
    window.addEventListener(
      'DOMContentLoaded',
      renderWetFoodBeta,
      { once: true }
    );
  }
}
if (typeof module !== 'undefined') module.exports = { getWetFoodScenario, getScenarioSummary, extractProteinKeywords, getFeedProteins, hasRepeatedProtein, hasDifferentProtein, selectMatchedFeed, scoreWetFoodCandidate, toNumber, getGelInfo, fetchWetFoodCandidates };
