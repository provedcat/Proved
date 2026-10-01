(function () {
  'use strict';

  const MAX_FOODS = 5;
  const MIN_FOODS = 2;
  const MAX_CRITERIA = 5;
  const MYFIT_SESSION_KEY = 'proved.myfit.session.v1';
  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';

  const sb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY) || null;

  const proteinOptions = [
    ['prefer_poultry', '가금류 우선'],
    ['prefer_ruminant', '반추동물 우선'],
    ['prefer_fish_group', '어류 우선'],
    ['prefer_single_protein', '단일 단백질원 우선'],
    ['prefer_chicken', '치킨 우선'],
    ['prefer_turkey', '칠면조 우선'],
    ['prefer_duck', '오리 우선'],
    ['prefer_goose', '거위 우선'],
    ['prefer_quail', '메추리 우선'],
    ['prefer_beef', '소고기 우선'],
    ['prefer_lamb', '양고기 우선'],
    ['prefer_goat', '염소·산양 우선'],
    ['prefer_venison', '사슴 우선'],
    ['prefer_pork', '돼지고기 우선'],
    ['prefer_rabbit', '토끼 우선'],
    ['prefer_salmon', '연어 우선'],
    ['prefer_tuna', '참치 우선'],
    ['prefer_mackerel', '고등어 우선'],
    ['prefer_sardine', '정어리 우선'],
    ['prefer_herring', '청어 우선'],
    ['prefer_cod', '대구 우선'],
    ['prefer_pollock', '명태 우선'],
    ['prefer_trout', '송어 우선']
  ];

  const groups = [
    {
      id: 'nutrition',
      title: '영양',
      meta: 'DM 기준',
      note: '수분을 제외한 영양성분을 같은 기준으로 비교해요.',
      directions: [
        ['dm_protein', '단백질', 'DM %'],
        ['dm_fat', '지방', 'DM %'],
        ['dm_carb', '탄수화물', 'DM %'],
        ['dm_ash', '회분', 'DM %'],
        ['dm_fiber', '섬유질', 'DM %'],
        ['dm_calcium', '칼슘', 'DM %'],
        ['dm_phosphorus', '인', 'DM %']
      ]
    },
    {
      id: 'basic',
      title: '기본 영양 정보',
      meta: '표시 기준',
      note: '수분과 열량은 제품 표시값 그대로 비교해요.',
      directions: [
        ['moisture', '수분', '%'],
        ['calorie', '칼로리', 'kcal / kg']
      ]
    },
    {
      id: 'intake',
      title: '섭취 기준',
      meta: '1,000 kcal 기준',
      note: '같은 열량을 먹었을 때의 섭취량을 비교해요.',
      directions: [
        ['eb_protein', '단백질', 'g / 1,000 kcal'],
        ['eb_fat', '지방', 'g / 1,000 kcal'],
        ['eb_carb', '탄수화물', 'g / 1,000 kcal'],
        ['eb_calcium', '칼슘', 'g / 1,000 kcal'],
        ['eb_phosphorus', '인', 'g / 1,000 kcal']
      ]
    },
    {
      id: 'ingredients',
      title: '원재료',
      meta: '원하는 조건',
      note: '이미 고른 사료들 중 어떤 원재료 조건을 더 우선할지 정해요.',
      chipSections: [
        {
          id: 'preferred_protein',
          title: '선호 단백질원',
          searchable: true,
          searchPlaceholder: '단백질원 검색',
          chips: proteinOptions
        },
        {
          id: 'avoid_ingredient',
          title: '피하고 싶은 원재료',
          chips: [
            ['avoid_chicken', '치킨', '치킨 제외'],
            ['avoid_fish', '생선', '생선 제외'],
            ['avoid_fish_oil', '생선오일', '생선오일 제외'],
            ['avoid_meal', 'Meal(육분)', 'Meal(육분) 없음'],
            ['avoid_corn', '옥수수', '옥수수 제외'],
            ['avoid_soy', '콩', '콩 제외'],
            ['avoid_wheat_gluten', '밀·밀글루텐', '밀·밀글루텐 제외'],
            ['avoid_grain', '곡물', '곡물 제외']
          ]
        },
        {
          id: 'thickener',
          title: '점증제',
          chips: [
            ['no_thickener', '점증제 없음'],
            ['fewer_thickeners', '점증제 종류 적음'],
            ['carrageenan_free', '카라기난 없음'],
            ['gum_free', '검류 없음'],
            ['gum_agar_free', '검류·한천 없음']
          ]
        }
      ]
    },
    {
      id: 'information',
      title: '정보',
      meta: '데이터 기준',
      note: '제품 자체가 아니라 확인할 수 있는 정보의 충실도를 기준으로 봐요.',
      chipSections: [
        {
          id: 'info',
          title: '정보 신뢰도',
          chips: [
            ['official_calorie', '공식·라벨 칼로리 있음'],
            ['nutrition_complete', '영양정보가 충분함']
          ]
        }
      ]
    }
  ];

  const criteria = new Map();
  groups.forEach(group => {
    (group.directions || []).forEach(([id, label, detail]) => {
      criteria.set(id, { id, label, rankLabel: label, detail, type: 'direction', group: group.id });
    });
    (group.chipSections || []).forEach(section => {
      section.chips.forEach(([id, label, rankLabel]) => {
        criteria.set(id, { id, label, rankLabel: rankLabel || label, type: 'chip', group: group.id, section: section.id });
      });
    });
  });

  const state = {
    foods: [],
    species: null,
    foodSearchSerial: 0,
    foodSearchTimer: null,
    foodIndex: null,
    foodIndexPromise: null,
    foodSearchMatches: [],
    foodSearchVisible: 20,
    favoriteFoods: [],
    favoritesLoading: false,
    selected: new Map(),
    order: [],
    drag: null,
    ignoreClickUntil: 0,
    resultLoading: false,
    resultModel: null,
    currentScreen: 'foods'
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.app = $('myFitApp');
    els.foodScreen = $('myFitFoodScreen');
    els.criteriaScreen = $('myFitCriteriaScreen');
    els.priorityScreen = $('myFitPriorityScreen');
    els.resultScreen = $('myFitResultScreen');
    els.foodCount = $('myFitFoodCount');
    els.foodSearch = $('myFitFoodSearchInput');
    els.foodSearchHint = $('myFitFoodSearchHint');
    els.favorites = $('myFitFavorites');
    els.favoritesList = $('myFitFavoritesList');
    els.foodResults = $('myFitFoodSearchResults');
    els.selectedFoods = $('myFitSelectedFoodsList');
    els.selectedFoodsEmpty = $('myFitSelectedFoodsEmpty');
    els.selectedSpecies = $('myFitSelectedSpecies');
    els.toCriteria = $('myFitToCriteria');
    els.groups = $('myFitCriteriaGroups');
    els.count = $('myFitCriteriaCount');
    els.toPriority = $('myFitToPriority');
    els.backToFoods = $('myFitBackToFoods');
    els.backToCriteria = $('myFitBackToCriteria');
    els.slots = $('myFitRankSlots');
    els.pool = $('myFitChipPool');
    els.priorityStatus = $('myFitPriorityStatus');
    els.result = $('myFitShowResult');
    els.backToPriority = $('myFitBackToPriority');
    els.resultFoodCount = $('myFitResultFoodCount');
    els.resultCriteriaCount = $('myFitResultCriteriaCount');
    els.resultSpecies = $('myFitResultSpecies');
    els.resultNotice = $('myFitResultNotice');
    els.resultList = $('myFitResultList');
    els.resultCriteriaMeta = $('myFitResultCriteriaMeta');
    els.resultCriteriaChips = $('myFitResultCriteriaChips');
    els.chooseCriteriaAgain = $('myFitChooseCriteriaAgain');
    els.compareFoodsAgain = $('myFitCompareFoodsAgain');
    els.toast = $('myFitToast');
    els.progress = Array.from(document.querySelectorAll('.myfit-progress span'));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function persistSessionState() {
    try {
      const payload = {
        foods: state.foods,
        species: state.species,
        selected: [...state.selected.entries()],
        order: state.order,
        currentScreen: state.currentScreen
      };
      window.sessionStorage.setItem(MYFIT_SESSION_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('MY FIT state save failed:', error);
    }
  }

  function restoreSessionState() {
    try {
      const raw = window.sessionStorage.getItem(MYFIT_SESSION_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return false;

      const foods = Array.isArray(saved.foods) ? saved.foods.slice(0, MAX_FOODS) : [];
      const species = saved.species === 'cat' || saved.species === 'dog' ? saved.species : null;
      const selectedEntries = Array.isArray(saved.selected)
        ? saved.selected.filter(entry => Array.isArray(entry) && criteria.has(entry[0])).slice(0, MAX_CRITERIA)
        : [];
      const selected = new Map(selectedEntries);
      const order = Array.isArray(saved.order)
        ? saved.order.filter(id => selected.has(id)).slice(0, MAX_CRITERIA)
        : [];
      const validScreens = new Set(['foods', 'criteria', 'priority', 'result']);
      let currentScreen = validScreens.has(saved.currentScreen) ? saved.currentScreen : 'foods';

      if (foods.length < MIN_FOODS && currentScreen !== 'foods') currentScreen = 'foods';
      if (!selected.size && (currentScreen === 'priority' || currentScreen === 'result')) currentScreen = 'criteria';
      if (order.length !== selected.size && currentScreen === 'result') currentScreen = 'priority';

      state.foods = foods;
      state.species = foods.length ? species || foods[0]?.species || null : null;
      state.selected = selected;
      state.order = order;
      state.currentScreen = currentScreen;
      return true;
    } catch (error) {
      console.warn('MY FIT state restore failed:', error);
      return false;
    }
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[()\[\]{}\/\\,._·&+\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenizeSearchQuery(value) {
    return [...new Set(normalizeSearchText(value).split(' ').filter(Boolean))];
  }

  function buildFoodSearchText(food) {
    const typeTerms = food?.type === 'dry'
      ? '건식 드라이 dry'
      : food?.type === 'wet' ? '습식 wet 캔 파우치' : '';
    return normalizeSearchText([
      getBrand(food),
      food?.제조사,
      food?.제품명,
      food?.완전식여부,
      food?.메인단백질,
      typeTerms,
      getSpeciesLabel(food?.species)
    ].filter(Boolean).join(' '));
  }

  function foodSearchRelevance(food, rawQuery, tokens) {
    const product = normalizeSearchText(food?.제품명);
    const brand = normalizeSearchText(getBrand(food));
    const text = buildFoodSearchText(food);
    const phrase = normalizeSearchText(rawQuery);
    let score = 0;
    if (phrase && product.includes(phrase)) score += 120;
    if (phrase && brand.includes(phrase)) score += 100;
    tokens.forEach(token => {
      if (product.includes(token)) score += 24;
      if (brand.includes(token)) score += 18;
      if (product.startsWith(token)) score += 6;
      if (brand.startsWith(token)) score += 5;
      if (text.includes(token)) score += 2;
    });
    return score;
  }

  async function fetchFoodIndexForSpecies(species) {
    const rows = [];
    const pageSize = 1000;
    const table = species === 'dog' ? 'dog_feeds' : 'feeds';
    const columns = 'id,type,제조사,제품명,완전식여부,메인단백질,verified,searchable_before_review,brands(name)';

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await sb
        .from(table)
        .select(columns)
        .or('verified.eq.true,searchable_before_review.eq.true')
        .order('제조사')
        .order('제품명')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = data || [];
      rows.push(...page.map(row => ({ ...row, species })));
      if (page.length < pageSize) break;
    }

    return rows;
  }

  async function ensureFoodIndex() {
    if (state.foodIndex) return state.foodIndex;
    if (!state.foodIndexPromise) {
      state.foodIndexPromise = Promise.all([
        fetchFoodIndexForSpecies('cat'),
        fetchFoodIndexForSpecies('dog')
      ]).then(([cats, dogs]) => {
        state.foodIndex = [...cats, ...dogs];
        return state.foodIndex;
      }).finally(() => {
        state.foodIndexPromise = null;
      });
    }
    return state.foodIndexPromise;
  }

  function getSpeciesLabel(species) {
    return species === 'dog' ? '강아지' : '고양이';
  }

  function foodKey(food) {
    return `${food.species}:${food.id}`;
  }

  function getBrand(food) {
    const relation = Array.isArray(food?.brands) ? food.brands[0] : food?.brands;
    return relation?.name || food?.제조사 || '브랜드 정보 없음';
  }

  function favoriteFoodButton(food) {
    const key = foodKey(food);
    const selected = state.foods.some(item => foodKey(item) === key);
    const disabled = !selected && state.foods.length >= MAX_FOODS;
    return `
      <button type="button" class="myfit-food-result myfit-favorite-food${selected ? ' is-selected' : ''}"
        data-favorite-food-key="${escapeHtml(key)}" ${disabled ? 'disabled' : ''}>
        <span>
          <small>★ 즐겨찾기 · ${escapeHtml(getBrand(food))} · ${getSpeciesLabel(food.species)}</small>
          <strong>${escapeHtml(food.제품명 || '제품명 정보 없음')}</strong>
          <em>${escapeHtml([food.type === 'wet' ? '습식' : food.type === 'dry' ? '건식' : '', food.완전식여부 || '', food.메인단백질 || ''].filter(Boolean).join(' · '))}</em>
        </span>
        <i>${selected ? '✓' : '+'}</i>
      </button>`;
  }

  function renderFavorites() {
    if (!els.favorites || !els.favoritesList || !els.foodSearch) return;
    const hasQuery = Boolean(els.foodSearch.value.trim());
    const foods = state.favoriteFoods.filter(food => !state.species || food.species === state.species);
    const visible = !hasQuery && foods.length > 0;

    els.favorites.hidden = !visible;
    if (!visible) {
      els.favoritesList.innerHTML = '';
      return;
    }

    els.favoritesList.innerHTML = foods.map(favoriteFoodButton).join('');
    els.favoritesList.querySelectorAll('[data-favorite-food-key]').forEach(button => {
      button._food = foods.find(food => foodKey(food) === button.dataset.favoriteFoodKey);
    });
  }

  async function loadFavoriteFoods() {
    if (!sb || state.favoritesLoading) return;
    state.favoritesLoading = true;
    try {
      const { data: authData } = await sb.auth.getUser();
      const user = authData?.user;
      if (!user) {
        state.favoriteFoods = [];
        renderFavorites();
        return;
      }

      const { data: favorites, error } = await sb
        .from('favorite_foods')
        .select('species,feed_id,dog_feed_id,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = favorites || [];
      const catIds = [...new Set(rows.filter(row => row.species === 'cat' && row.feed_id).map(row => row.feed_id))];
      const dogIds = [...new Set(rows.filter(row => row.species === 'dog' && row.dog_feed_id).map(row => row.dog_feed_id))];
      const columns = 'id,type,제조사,제품명,완전식여부,메인단백질,brands(name)';

      const [catResult, dogResult] = await Promise.all([
        catIds.length
          ? sb.from('feeds').select(columns).in('id', catIds)
          : Promise.resolve({ data: [], error: null }),
        dogIds.length
          ? sb.from('dog_feeds').select(columns).in('id', dogIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (catResult.error) throw catResult.error;
      if (dogResult.error) throw dogResult.error;

      const byKey = new Map([
        ...(catResult.data || []).map(food => [`cat:${food.id}`, { ...food, species: 'cat' }]),
        ...(dogResult.data || []).map(food => [`dog:${food.id}`, { ...food, species: 'dog' }])
      ]);

      state.favoriteFoods = rows
        .map(row => row.species === 'dog'
          ? byKey.get(`dog:${row.dog_feed_id}`)
          : byKey.get(`cat:${row.feed_id}`))
        .filter(Boolean);

      renderFavorites();
    } catch (error) {
      console.warn('MY FIT favorite foods load failed:', error);
      state.favoriteFoods = [];
      renderFavorites();
    } finally {
      state.favoritesLoading = false;
    }
  }

  function syncFoodUi() {
    const count = state.foods.length;
    if (els.foodCount) els.foodCount.querySelector('strong').textContent = String(count);
    if (els.toCriteria) els.toCriteria.disabled = count < MIN_FOODS;

    if (els.selectedSpecies) {
      els.selectedSpecies.textContent = state.species ? `${getSpeciesLabel(state.species)} 사료끼리 비교` : '';
    }

    if (els.selectedFoodsEmpty) els.selectedFoodsEmpty.hidden = count > 0;
    if (els.selectedFoods) {
      els.selectedFoods.innerHTML = state.foods.map((food, index) => `
        <article class="myfit-selected-food">
          <span class="myfit-selected-food__number">${index + 1}</span>
          <div>
            <small>${escapeHtml(getBrand(food))} · ${getSpeciesLabel(food.species)}</small>
            <strong>${escapeHtml(food.제품명 || '제품명 정보 없음')}</strong>
          </div>
          <button type="button" data-remove-food="${escapeHtml(foodKey(food))}" aria-label="${escapeHtml(food.제품명)} 선택 해제">×</button>
        </article>`).join('');
    }

    if (els.foodSearchHint) {
      els.foodSearchHint.textContent = state.species
        ? `${getSpeciesLabel(state.species)} 사료만 검색하고 있어요.`
        : '검색어를 입력하면 고양이·강아지 사료를 함께 찾아요.';
    }
  }

  function renderFoodSearchResults() {
    if (!els.foodResults) return;
    const foods = state.foodSearchMatches;
    if (!foods.length) {
      els.foodResults.innerHTML = '<p class="myfit-search-state">검색 결과가 없어요.</p>';
      return;
    }

    const selectedKeys = new Set(state.foods.map(foodKey));
    const visibleFoods = foods.slice(0, state.foodSearchVisible);
    const remaining = Math.max(0, foods.length - visibleFoods.length);

    els.foodResults.innerHTML = visibleFoods.map(food => {
      const key = foodKey(food);
      const selected = selectedKeys.has(key);
      const disabled = !selected && state.foods.length >= MAX_FOODS;
      return `
        <button type="button" class="myfit-food-result${selected ? ' is-selected' : ''}"
          data-food-key="${escapeHtml(key)}" ${disabled ? 'disabled' : ''}>
          <span>
            <small>${escapeHtml(getBrand(food))} · ${getSpeciesLabel(food.species)}</small>
            <strong>${escapeHtml(food.제품명 || '제품명 정보 없음')}</strong>
            <em>${escapeHtml([food.type === 'wet' ? '습식' : food.type === 'dry' ? '건식' : '', food.완전식여부 || '', food.메인단백질 || ''].filter(Boolean).join(' · '))}</em>
          </span>
          <i>${selected ? '✓' : '+'}</i>
        </button>`;
    }).join('') + (remaining ? `
      <button type="button" class="myfit-food-search-more" data-load-more-food-results>
        더 보기 <span>${remaining}개 남음</span>
      </button>` : '');

    els.foodResults.querySelectorAll('[data-food-key]').forEach(button => {
      button._food = foods.find(food => foodKey(food) === button.dataset.foodKey);
    });
  }

  async function searchFoods() {
    if (!sb || !els.foodSearch || !els.foodResults) return;
    const query = els.foodSearch.value.trim().slice(0, 100);
    const serial = ++state.foodSearchSerial;

    if (query.length < 2) {
      state.foodSearchMatches = [];
      state.foodSearchVisible = 20;
      els.foodResults.innerHTML = query ? '<p class="myfit-search-state">두 글자 이상 입력해 주세요.</p>' : '';
      return;
    }

    els.foodResults.innerHTML = '<p class="myfit-search-state">사료를 찾고 있어요.</p>';

    try {
      const index = await ensureFoodIndex();
      if (serial !== state.foodSearchSerial) return;

      const tokens = tokenizeSearchQuery(query);
      const foods = index
        .filter(food => !state.species || food.species === state.species)
        .filter(food => {
          const text = buildFoodSearchText(food);
          return tokens.every(token => text.includes(token));
        })
        .sort((a, b) =>
          foodSearchRelevance(b, query, tokens) - foodSearchRelevance(a, query, tokens)
          || getBrand(a).localeCompare(getBrand(b), 'ko')
          || String(a.제품명 || '').localeCompare(String(b.제품명 || ''), 'ko')
        );

      state.foodSearchMatches = foods;
      state.foodSearchVisible = 20;
      renderFoodSearchResults();
    } catch (error) {
      if (serial !== state.foodSearchSerial) return;
      state.foodSearchMatches = [];
      els.foodResults.innerHTML = '<p class="myfit-search-state">검색 결과를 불러오지 못했어요.</p>';
      console.warn('MY FIT food search failed:', error);
    }
  }

  function addFood(food) {
    if (!food) return;
    const key = foodKey(food);
    if (state.foods.some(item => foodKey(item) === key)) {
      removeFood(key);
      return;
    }
    if (state.foods.length >= MAX_FOODS) {
      showToast('사료는 최대 5개까지 선택할 수 있어요.');
      return;
    }
    if (state.species && state.species !== food.species) {
      showToast('같은 동물의 사료끼리 비교할 수 있어요.');
      return;
    }

    state.foods.push(food);
    state.species = food.species;
    syncFoodUi();
    searchFoods();
  }

  function removeFood(key) {
    state.foods = state.foods.filter(food => foodKey(food) !== key);
    if (!state.foods.length) state.species = null;
    syncFoodUi();
    searchFoods();
  }

  function criterionLabel(id) {
    const item = criteria.get(id);
    const value = state.selected.get(id);
    if (!item) return id;
    if (item.type === 'direction') return `${item.rankLabel} ${value === 'low' ? '↓' : '↑'}`;
    return item.rankLabel;
  }

  function renderGroups() {
    if (!els.groups) return;

    els.groups.innerHTML = groups.map(group => {
      const directionHtml = (group.directions || []).length ? `
        <div class="myfit-direction-list">
          ${group.directions.map(([id, label, detail]) => `
            <div class="myfit-direction-row" data-criterion-row="${id}">
              <div class="myfit-direction-row__label">
                <strong>${escapeHtml(label)}</strong>
                <small>${escapeHtml(detail)}</small>
              </div>
              <div class="myfit-direction" data-direction-control="${id}" data-value="none" role="group" aria-label="${escapeHtml(label)} 비교 방향">
                <button type="button" data-direction="low" aria-pressed="false">낮게</button>
                <button type="button" data-direction="none" aria-pressed="true">선택 안 함</button>
                <button type="button" data-direction="high" aria-pressed="false">높게</button>
              </div>
            </div>`).join('')}
        </div>` : '';

      const chipHtml = (group.chipSections || []).map(section => `
        <section class="myfit-chip-section" data-chip-section="${escapeHtml(section.id)}">
          <div class="myfit-chip-section__head">
            <h4>${escapeHtml(section.title)}</h4>
            ${section.searchable ? `
              <label class="myfit-inline-search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg>
                <input type="search" data-protein-search placeholder="${escapeHtml(section.searchPlaceholder || '검색')}">
              </label>` : ''}
          </div>
          <div class="myfit-chip-grid">
            ${section.chips.map(([id, label]) => `
              <button type="button" class="myfit-chip" data-chip-criterion="${id}" data-chip-label="${escapeHtml(label)}" aria-pressed="false">
                ${escapeHtml(label)}
              </button>`).join('')}
          </div>
          ${section.searchable ? '<p class="myfit-chip-search-empty" hidden>검색 결과가 없어요.</p>' : ''}
        </section>`).join('');

      return `
        <article class="myfit-criteria-card">
          <header class="myfit-criteria-card__head">
            <div>
              <h3>${escapeHtml(group.title)}</h3>
              <p>${escapeHtml(group.note)}</p>
            </div>
            <span>${escapeHtml(group.meta)}</span>
          </header>
          ${directionHtml}
          ${chipHtml}
        </article>`;
    }).join('');
  }

  function filterProteinChips(input) {
    const section = input.closest('[data-chip-section]');
    if (!section) return;
    const query = input.value.trim().normalize('NFKC').toLowerCase();
    let visible = 0;
    section.querySelectorAll('[data-chip-criterion]').forEach(button => {
      const label = String(button.dataset.chipLabel || '').normalize('NFKC').toLowerCase();
      const show = !query || label.includes(query);
      button.hidden = !show;
      if (show) visible += 1;
    });
    const empty = section.querySelector('.myfit-chip-search-empty');
    if (empty) empty.hidden = visible > 0;
  }

  function canAddCriterion(id) {
    return state.selected.has(id) || state.selected.size < MAX_CRITERIA;
  }

  function setDirection(id, direction) {
    const current = state.selected.get(id);
    if (direction === 'none') {
      state.selected.delete(id);
      state.order = state.order.filter(item => item !== id);
    } else {
      if (!current && !canAddCriterion(id)) {
        showToast('기준은 최대 5개까지 선택할 수 있어요.');
        return;
      }
      state.selected.set(id, direction);
    }
    syncCriteriaUi();
  }

  function toggleChip(id) {
    if (state.selected.has(id)) {
      state.selected.delete(id);
      state.order = state.order.filter(item => item !== id);
    } else {
      if (!canAddCriterion(id)) {
        showToast('기준은 최대 5개까지 선택할 수 있어요.');
        return;
      }
      state.selected.set(id, 'selected');
    }
    syncCriteriaUi();
  }

  function syncCriteriaUi() {
    const selectedCount = state.selected.size;
    if (els.count) els.count.querySelector('strong').textContent = String(selectedCount);
    if (els.toPriority) els.toPriority.disabled = selectedCount === 0;

    document.querySelectorAll('[data-direction-control]').forEach(control => {
      const id = control.dataset.directionControl;
      const value = state.selected.get(id);
      const displayValue = value === 'low' || value === 'high' ? value : 'none';
      control.dataset.value = displayValue;
      control.classList.toggle('is-disabled', !state.selected.has(id) && selectedCount >= MAX_CRITERIA);
      control.querySelectorAll('button').forEach(button => {
        const direction = button.dataset.direction;
        button.setAttribute('aria-pressed', String(direction === displayValue));
        button.disabled = !state.selected.has(id) && selectedCount >= MAX_CRITERIA && direction !== 'none';
      });
    });

    document.querySelectorAll('[data-chip-criterion]').forEach(button => {
      const id = button.dataset.chipCriterion;
      const selected = state.selected.has(id);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = !selected && selectedCount >= MAX_CRITERIA;
    });

    if (!els.priorityScreen?.hidden) renderPriority();
  }

  function showScreen(name) {
    const screens = {
      foods: els.foodScreen,
      criteria: els.criteriaScreen,
      priority: els.priorityScreen,
      result: els.resultScreen
    };
    Object.entries(screens).forEach(([key, screen]) => {
      if (!screen) return;
      const active = key === name;
      screen.hidden = !active;
      screen.classList.toggle('is-active', active);
    });

    const current = screens[name];
    current?.classList.remove('is-entering');
    if (current) {
      void current.offsetWidth;
      current.classList.add('is-entering');
    }

    const activeIndex = name === 'foods' ? 0 : name === 'criteria' ? 1 : name === 'priority' ? 2 : 3;
    els.progress.forEach((item, index) => item.classList.toggle('is-active', index <= activeIndex));

    if (name === 'priority') {
      state.order = state.order.filter(id => state.selected.has(id));
      renderPriority();
    }

    requestAnimationFrame(() => els.app?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function renderPriority() {
    if (!els.slots || !els.pool) return;

    state.order = state.order.filter(id => state.selected.has(id)).slice(0, MAX_CRITERIA);

    els.slots.innerHTML = Array.from({ length: MAX_CRITERIA }, (_, index) => {
      const id = state.order[index];
      const label = id ? criterionLabel(id) : '';
      return `
        <div class="myfit-rank-slot" data-rank-slot="${index}">
          <span class="myfit-rank-number">${index + 1}</span>
          ${id ? `
            <div class="myfit-rank-chip" data-drag-id="${id}" data-origin="slot" role="button" tabindex="0" aria-label="${escapeHtml(label)}. 드래그하여 순서 변경">
              <strong>${escapeHtml(label)}</strong>
              <button type="button" data-remove-rank="${id}" aria-label="${escapeHtml(label)} 순위에서 빼기">×</button>
            </div>` : '<span class="myfit-rank-empty">기준을 놓아주세요</span>'}
        </div>`;
    }).join('');

    const poolIds = [...state.selected.keys()].filter(id => !state.order.includes(id));
    els.pool.innerHTML = poolIds.length
      ? poolIds.map(id => `
          <button type="button" class="myfit-chip" data-pool-id="${id}" data-drag-id="${id}" data-origin="pool">
            ${escapeHtml(criterionLabel(id))}
          </button>`).join('')
      : '<p class="myfit-chip-pool__empty">선택한 기준이 모두 순서에 들어갔어요.</p>';

    const selectedCount = state.selected.size;
    const placedCount = state.order.length;
    const complete = selectedCount > 0 && placedCount === selectedCount;
    if (els.priorityStatus) els.priorityStatus.textContent = complete ? '순서가 완성됐어요.' : `${placedCount} / ${selectedCount} 배치`;
    if (els.result) els.result.disabled = !complete;

    bindDragTargets();
  }

  function addToOrder(id) {
    if (!state.selected.has(id) || state.order.includes(id)) return;
    state.order.push(id);
    renderPriority();
  }

  function removeFromOrder(id) {
    state.order = state.order.filter(item => item !== id);
    renderPriority();
  }

  function moveToSlot(id, targetIndex) {
    if (!state.selected.has(id)) return;
    const next = state.order.filter(item => item !== id);
    const insertAt = Math.max(0, Math.min(Number(targetIndex) || 0, next.length));
    next.splice(insertAt, 0, id);
    state.order = next.slice(0, MAX_CRITERIA);
    renderPriority();
  }

  function bindDragTargets() {
    document.querySelectorAll('[data-drag-id]').forEach(element => {
      element.addEventListener('pointerdown', startDrag);
    });
  }

  function startDrag(event) {
    if (event.button != null && event.button !== 0) return;
    const source = event.currentTarget;
    const id = source.dataset.dragId;
    if (!id || !state.selected.has(id)) return;

    const ghost = document.createElement('div');
    ghost.className = 'myfit-drag-ghost';
    ghost.textContent = criterionLabel(id);
    document.body.appendChild(ghost);

    state.drag = { id, ghost, source, startX: event.clientX, startY: event.clientY, moved: false, target: null };
    positionGhost(event.clientX, event.clientY);
    document.addEventListener('pointermove', moveDrag, { passive: false });
    document.addEventListener('pointerup', endDrag, { once: true });
    document.addEventListener('pointercancel', cancelDrag, { once: true });
  }

  function positionGhost(x, y) {
    if (!state.drag?.ghost) return;
    state.drag.ghost.style.left = `${x}px`;
    state.drag.ghost.style.top = `${y}px`;
  }

  function moveDrag(event) {
    if (!state.drag) return;
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;
    if (Math.hypot(dx, dy) > 5) state.drag.moved = true;
    if (state.drag.moved) event.preventDefault();
    positionGhost(event.clientX, event.clientY);

    document.querySelectorAll('.myfit-rank-slot.is-drop-target').forEach(slot => slot.classList.remove('is-drop-target'));
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.myfit-rank-slot');
    if (target) {
      target.classList.add('is-drop-target');
      state.drag.target = target;
    } else {
      state.drag.target = null;
    }
  }

  function endDrag() {
    if (!state.drag) return;
    const { id, target, moved } = state.drag;
    if (moved && target) {
      moveToSlot(id, Number(target.dataset.rankSlot));
      state.ignoreClickUntil = Date.now() + 250;
    }
    cleanupDrag();
  }

  function cancelDrag() {
    cleanupDrag();
  }

  function cleanupDrag() {
    document.removeEventListener('pointermove', moveDrag);
    document.removeEventListener('pointerup', endDrag);
    document.removeEventListener('pointercancel', cancelDrag);
    document.querySelectorAll('.myfit-rank-slot.is-drop-target').forEach(slot => slot.classList.remove('is-drop-target'));
    state.drag?.ghost?.remove();
    state.drag = null;
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function calculateDmCarb(food) {
    const moisture = numberOrNull(food?.수분);
    if (moisture === null || moisture >= 100) return null;
    const dryMatter = 100 - moisture;
    const storedNfe = numberOrNull(food?.nfe);
    if (storedNfe !== null) return Math.max(0, storedNfe) / dryMatter * 100;

    const protein = numberOrNull(food?.조단백);
    const fat = numberOrNull(food?.조지방);
    const ash = numberOrNull(food?.조회분);
    const fiber = numberOrNull(food?.조섬유);
    if ([protein, fat, ash, fiber].some(value => value === null)) return null;
    const nfe = 100 - protein - fat - ash - fiber - moisture;
    return Number.isFinite(nfe) ? Math.max(0, nfe) / dryMatter * 100 : null;
  }

  const numericCriterionReaders = {
    dm_protein: food => numberOrNull(food?.dm_단백),
    dm_fat: food => numberOrNull(food?.dm_지방),
    dm_carb: calculateDmCarb,
    dm_ash: food => numberOrNull(food?.dm_회분),
    dm_fiber: food => numberOrNull(food?.dm_섬유),
    dm_calcium: food => numberOrNull(food?.dm_칼슘),
    dm_phosphorus: food => numberOrNull(food?.dm_인),
    moisture: food => numberOrNull(food?.수분),
    calorie: food => numberOrNull(food?.final_me),
    eb_protein: food => numberOrNull(food?.eb_단백),
    eb_fat: food => numberOrNull(food?.eb_지방),
    eb_carb: food => numberOrNull(food?.eb_탄수화물),
    eb_calcium: food => numberOrNull(food?.eb_칼슘),
    eb_phosphorus: food => numberOrNull(food?.eb_인)
  };

  const animalPatterns = {
    poultry: ['닭', '치킨', 'chicken', '칠면조', 'turkey', '오리', 'duck', '거위', 'goose', '메추리', 'quail'],
    ruminant: ['소고기', '쇠고기', '우육', 'beef', '양고기', 'lamb', '염소', '산양', 'goat', '사슴', 'venison'],
    fish: ['생선', '어류', 'fish', '연어', 'salmon', '참치', 'tuna', '고등어', 'mackerel', '정어리', 'sardine', '청어', 'herring', '대구', 'cod', '명태', 'pollock', '송어', 'trout', '광어', '가자미', '도미', '멸치', 'anchovy'],
    chicken: ['닭', '치킨', 'chicken'],
    turkey: ['칠면조', 'turkey'],
    duck: ['오리', 'duck'],
    goose: ['거위', 'goose'],
    quail: ['메추리', 'quail'],
    beef: ['소고기', '쇠고기', '우육', 'beef'],
    lamb: ['양고기', 'lamb'],
    goat: ['염소', '산양', 'goat'],
    venison: ['사슴', 'venison'],
    pork: ['돼지', '돈육', 'pork'],
    rabbit: ['토끼', 'rabbit'],
    salmon: ['연어', 'salmon'],
    tuna: ['참치', 'tuna'],
    mackerel: ['고등어', 'mackerel'],
    sardine: ['정어리', 'sardine'],
    herring: ['청어', 'herring'],
    cod: ['대구', 'cod'],
    pollock: ['명태', 'pollock'],
    trout: ['송어', 'trout']
  };

  function includesAny(text, terms) {
    const source = normalizeSearchText(text);
    return terms.some(term => source.includes(normalizeSearchText(term)));
  }

  function ingredientText(food) {
    return String(food?.전성분 || '').trim();
  }

  function tagText(food) {
    return (food?._tags || []).map(tag => tag.label_ko || '').join(' ');
  }

  function hasTag(food, slug) {
    return (food?._tags || []).some(tag => String(tag.slug || '') === slug);
  }

  function stripFishOils(text) {
    return String(text || '').replace(
      /(어유|생선\s*오일|연어\s*오일|참치\s*오일|청어\s*오일|정어리\s*오일|fish\s*oil|salmon\s*oil|tuna\s*oil|herring\s*oil|sardine\s*oil)/gi,
      ' '
    );
  }

  function proteinText(food) {
    const main = String(food?.메인단백질 || '').trim();
    if (main) return main;
    const ingredients = stripFishOils(food?.전성분);
    return [ingredients, tagText(food)].filter(Boolean).join(' ');
  }

  function evaluateAvoidIngredient(food, terms, explicitFreePatterns = []) {
    const ingredients = ingredientText(food);
    const tags = tagText(food);
    if (explicitFreePatterns.length && includesAny(tags, explicitFreePatterns)) return true;
    if (!ingredients) return null;
    return !includesAny(ingredients, terms);
  }

  function thickenerCount(food) {
    const declared = String(food?.겔화제 || '').trim();
    const ingredients = ingredientText(food);
    const source = declared || ingredients;
    if (!source) return null;
    const terms = [
      ['카라기난', 'carrageenan'],
      ['구아검', 'guar gum'],
      ['잔탄검', '크산탄검', 'xanthan gum'],
      ['로커스트빈검', 'locust bean gum', 'carob bean gum'],
      ['카시아검', 'cassia gum'],
      ['셀룰로오스검', 'cellulose gum'],
      ['알긴산', 'alginate', 'alginic'],
      ['아라비아검', 'gum arabic', 'acacia gum'],
      ['젤란검', 'gellan gum'],
      ['타라검', 'tara gum'],
      ['한천', 'agar'],
      ['가공전분', '변성전분', 'modified starch'],
      ['증점다당류']
    ];
    return terms.reduce((count, synonyms) => count + (includesAny(source, synonyms) ? 1 : 0), 0);
  }

  function evaluateCondition(food, id) {
    const ingredients = ingredientText(food);
    const tags = tagText(food);
    const proteins = proteinText(food);
    const hasProteinInfo = Boolean(String(food?.메인단백질 || '').trim() || ingredients || tags);

    const preferredMap = {
      prefer_poultry: animalPatterns.poultry,
      prefer_ruminant: animalPatterns.ruminant,
      prefer_fish_group: animalPatterns.fish,
      prefer_chicken: animalPatterns.chicken,
      prefer_turkey: animalPatterns.turkey,
      prefer_duck: animalPatterns.duck,
      prefer_goose: animalPatterns.goose,
      prefer_quail: animalPatterns.quail,
      prefer_beef: animalPatterns.beef,
      prefer_lamb: animalPatterns.lamb,
      prefer_goat: animalPatterns.goat,
      prefer_venison: animalPatterns.venison,
      prefer_pork: animalPatterns.pork,
      prefer_rabbit: animalPatterns.rabbit,
      prefer_salmon: animalPatterns.salmon,
      prefer_tuna: animalPatterns.tuna,
      prefer_mackerel: animalPatterns.mackerel,
      prefer_sardine: animalPatterns.sardine,
      prefer_herring: animalPatterns.herring,
      prefer_cod: animalPatterns.cod,
      prefer_pollock: animalPatterns.pollock,
      prefer_trout: animalPatterns.trout
    };

    if (preferredMap[id]) {
      if (!hasProteinInfo) return null;
      return includesAny(proteins, preferredMap[id]);
    }

    if (id === 'prefer_single_protein') {
      if (hasTag(food, 'single_animal_protein')) return true;
      if (!tags) return null;
      if (includesAny(tags, ['단일 단백질', '단일단백질', '단일 동물성 단백질', 'single protein', 'single animal protein'])) return true;
      if (includesAny(tags, ['다중 단백질', 'multiple protein', 'multi protein'])) return false;
      return null;
    }

    if (id === 'avoid_chicken') {
      if (hasTag(food, 'chicken_free')) return true;
      return evaluateAvoidIngredient(food, animalPatterns.chicken, ['치킨 프리', '치킨프리', '닭고기 프리', 'chicken free']);
    }
    if (id === 'avoid_fish') {
      if (hasTag(food, 'fish_free')) return true;
      const tagsText = tagText(food);
      if (includesAny(tagsText, ['생선 프리', '어류 프리', '어류 유래 원료 없음', 'fish free'])) return true;
      if (!ingredients) return null;
      return !includesAny(stripFishOils(ingredients), animalPatterns.fish);
    }
    if (id === 'avoid_fish_oil') return evaluateAvoidIngredient(food, ['어유', '생선오일', '생선 오일', 'fish oil', 'salmon oil', '연어오일'], ['생선오일 프리', '어유 프리', 'fish oil free']);
    if (id === 'avoid_meal') {
      if (hasTag(food, 'meal_free')) return true;
      if (includesAny(tags, ['meal-free', 'meal free', '無육분', '육분 없음', '육분 프리', '밀프리'])) return true;
      if (!ingredients) return null;
      return !/(육분|가금류분|닭고기분|오리분|칠면조분|어분|생선분|연어분|청어분|meat meal|chicken meal|poultry meal|turkey meal|duck meal|fish meal|salmon meal|herring meal)/i.test(ingredients);
    }
    if (id === 'avoid_corn') return evaluateAvoidIngredient(food, ['옥수수', 'corn', 'maize'], ['옥수수 프리', 'corn free']);
    if (id === 'avoid_soy') return evaluateAvoidIngredient(food, ['대두', '콩', 'soy', 'soybean'], ['콩 프리', '대두 프리', 'soy free']);
    if (id === 'avoid_wheat_gluten') {
      if (includesAny(tags, ['밀 프리', 'wheat free', '글루텐 프리', 'gluten free'])) return true;
      if (!ingredients) return null;
      return !/(^|[,;()\s])(?:밀|통밀|밀가루|밀배아|밀글루텐|소맥|wheat|wheat gluten)(?=$|[,;()\s])/i.test(ingredients);
    }
    if (id === 'avoid_grain') {
      if (hasTag(food, 'grain_free')) return true;
      if (includesAny(tags, ['그레인 프리', '그레인프리', 'grain free', 'grain-free'])) return true;
      if (!ingredients) return null;
      return !includesAny(ingredients, ['밀', 'wheat', '옥수수', 'corn', '쌀', 'rice', '보리', 'barley', '귀리', 'oat', '호밀', 'rye', '수수', 'sorghum', '기장', 'millet']);
    }

    const thickeners = thickenerCount(food);
    if (id === 'no_thickener') {
      if (hasTag(food, 'thickener_free')) return true;
      if (includesAny(tags, ['검·겔화제 무첨가', '점증제 없음', '무점증제', 'thickener-free', 'thickener free'])) return true;
      return thickeners === null ? null : thickeners === 0;
    }
    if (id === 'carrageenan_free') {
      if (hasTag(food, 'carrageenan_free')) return true;
      return evaluateAvoidIngredient(food, ['카라기난', 'carrageenan'], ['카라기난 프리', 'carrageenan free']);
    }
    if (id === 'gum_free') return evaluateAvoidIngredient(food, ['구아검', '잔탄검', '크산탄검', '로커스트빈검', '카시아검', '셀룰로오스검', '아라비아검', '젤란검', '타라검', 'guar gum', 'xanthan gum', 'locust bean gum', 'cassia gum', 'cellulose gum', 'gum arabic', 'gellan gum', 'tara gum']);
    if (id === 'gum_agar_free') {
      if (hasTag(food, 'gum_agar_free')) return true;
      return evaluateAvoidIngredient(food, ['구아검', '잔탄검', '크산탄검', '로커스트빈검', '카시아검', '셀룰로오스검', '아라비아검', '젤란검', '타라검', '한천', 'agar', 'guar gum', 'xanthan gum', 'locust bean gum', 'cassia gum', 'cellulose gum', 'gum arabic', 'gellan gum', 'tara gum'], ['검류·한천 프리', 'gum & agar-free', 'gum and agar free']);
    }

    if (id === 'official_calorie') {
      const calories = numberOrNull(food?.final_me);
      if (calories === null) return null;
      if (numberOrNull(food?.official_me) !== null) return true;
      const source = String(food?.cal_source || '');
      return /(label|official|manufacturer|package|라벨|공식|제조사)/i.test(source);
    }

    if (id === 'nutrition_complete') {
      return ['조단백', '조지방', '수분', '칼슘', '인', 'final_me']
        .every(field => numberOrNull(food?.[field]) !== null);
    }

    return null;
  }

  function evaluateCriterion(id, foods, priorityIndex, totalCriteria) {
    const item = criteria.get(id);
    const label = criterionLabel(id);
    const weight = Math.max(1, totalCriteria - priorityIndex);
    const isFewerThickeners = id === 'fewer_thickeners';
    const numericReader = numericCriterionReaders[id] || (isFewerThickeners ? thickenerCount : null);

    if (numericReader) {
      const direction = isFewerThickeners ? 'low' : state.selected.get(id);
      const values = foods.map(food => numericReader(food));
      if (values.some(value => value === null || !Number.isFinite(value))) {
        return { id, item, label, weight, eligible: false, reason: 'missing', values };
      }
      const unique = [...new Set(values.map(value => Number(value.toFixed(8))))];
      if (unique.length < 2) {
        return { id, item, label, weight, eligible: false, reason: 'same', values };
      }

      const sorted = values
        .map((value, index) => ({ value, index }))
        .sort((a, b) => direction === 'low' ? a.value - b.value : b.value - a.value);

      const ranks = Array(values.length).fill(null);
      sorted.forEach((entry, sortedIndex) => {
        const betterCount = sorted.filter(other => direction === 'low' ? other.value < entry.value : other.value > entry.value).length;
        ranks[entry.index] = betterCount + 1;
      });
      const utilities = ranks.map(rank => values.length <= 1 ? 1 : (values.length - rank) / (values.length - 1));
      return { id, item, label, weight, eligible: true, kind: 'numeric', direction, values, ranks, utilities };
    }

    const statuses = foods.map(food => evaluateCondition(food, id));
    if (statuses.some(value => value === null)) {
      return { id, item, label, weight, eligible: false, reason: 'missing', statuses };
    }
    if (statuses.every(value => value === statuses[0])) {
      return { id, item, label, weight, eligible: false, reason: 'same', statuses };
    }

    const trueCount = statuses.filter(Boolean).length;
    const ranks = statuses.map(value => value ? 1 : trueCount + 1);
    const utilities = statuses.map(value => value ? 1 : 0);
    return { id, item, label, weight, eligible: true, kind: 'boolean', statuses, ranks, utilities };
  }

  async function loadSelectedFoodDetails() {
    if (!sb || !state.foods.length || !state.species) return [];
    const ids = state.foods.map(food => food.id);
    const table = state.species === 'dog' ? 'dog_feeds' : 'feeds';
    const columns = [
      'id','type','제조사','제품명','완전식여부','메인단백질','전성분',
      '조단백','조지방','조회분','조섬유','수분','칼슘','인',
      'dm_단백','dm_지방','dm_회분','dm_섬유','dm_칼슘','dm_인','겔화제','nfe',
      'final_me','official_me','cal_source','eb_단백','eb_지방','eb_탄수화물','eb_칼슘','eb_인',
      'image_url','brands(name)'
    ].join(',');

    const { data, error } = await sb.from(table).select(columns).in('id', ids);
    if (error) throw error;

    const mappingTable = state.species === 'dog' ? 'dog_feed_food_tags' : 'feed_food_tags';
    const feedIdColumn = state.species === 'dog' ? 'dog_feed_id' : 'feed_id';
    const { data: mappings, error: mappingError } = await sb
      .from(mappingTable)
      .select(`${feedIdColumn},tag_id`)
      .in(feedIdColumn, ids);
    if (mappingError) throw mappingError;

    const tagIds = [...new Set((mappings || []).map(row => row.tag_id).filter(Boolean))];
    let tags = [];
    if (tagIds.length) {
      const { data: tagRows, error: tagError } = await sb
        .from('food_tags')
        .select('id,slug,label_ko,category')
        .in('id', tagIds);
      if (tagError) throw tagError;
      tags = tagRows || [];
    }

    const tagsByFeed = new Map();
    (mappings || []).forEach(mapping => {
      const feedId = String(mapping[feedIdColumn] || '');
      const tag = tags.find(item => String(item.id) === String(mapping.tag_id));
      if (!feedId || !tag) return;
      if (!tagsByFeed.has(feedId)) tagsByFeed.set(feedId, []);
      tagsByFeed.get(feedId).push(tag);
    });

    const detailsById = new Map((data || []).map(food => [String(food.id), {
      ...food,
      species: state.species,
      _tags: tagsByFeed.get(String(food.id)) || []
    }]));

    return state.foods
      .map(food => detailsById.get(String(food.id)))
      .filter(Boolean);
  }

  function compareResultEntries(a, b, criteriaModels) {
    const scoreDiff = b.fitScore - a.fitScore;
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
    for (const model of criteriaModels) {
      if (!model.eligible) continue;
      const diff = b.criteria[model.id].utility - a.criteria[model.id].utility;
      if (Math.abs(diff) > 1e-9) return diff;
    }
    return String(a.food.제품명 || '').localeCompare(String(b.food.제품명 || ''), 'ko');
  }

  function sameResultStanding(a, b, criteriaModels) {
    if (Math.abs(a.fitScore - b.fitScore) > 1e-9) return false;
    return criteriaModels
      .filter(model => model.eligible)
      .every(model => Math.abs(a.criteria[model.id].utility - b.criteria[model.id].utility) <= 1e-9);
  }

  function buildResultModel(foods) {
    const orderedCriteria = state.order.filter(id => state.selected.has(id));
    const criteriaModels = orderedCriteria.map((id, index) => evaluateCriterion(id, foods, index, orderedCriteria.length));
    const activeModels = criteriaModels.filter(model => model.eligible);
    activeModels.forEach((model, activeIndex) => {
      model.weight = activeModels.length - activeIndex;
    });
    criteriaModels.filter(model => !model.eligible).forEach(model => {
      model.weight = 0;
    });
    const totalWeight = activeModels.reduce((sum, model) => sum + model.weight, 0);

    const entries = foods.map((food, foodIndex) => {
      const perCriterion = {};
      criteriaModels.forEach(model => {
        perCriterion[model.id] = {
          eligible: model.eligible,
          reason: model.reason || '',
          rank: model.ranks?.[foodIndex] ?? null,
          utility: model.utilities?.[foodIndex] ?? 0,
          status: model.statuses?.[foodIndex] ?? null,
          value: model.values?.[foodIndex] ?? null
        };
      });

      const weighted = activeModels.reduce((sum, model) => {
        return sum + model.weight * (perCriterion[model.id].utility || 0);
      }, 0);

      return {
        food,
        criteria: perCriterion,
        fitScore: totalWeight > 0 ? weighted / totalWeight : 0,
        displayRank: null
      };
    });

    entries.sort((a, b) => compareResultEntries(a, b, criteriaModels));
    entries.forEach((entry, index) => {
      if (index === 0) entry.displayRank = 1;
      else entry.displayRank = sameResultStanding(entry, entries[index - 1], criteriaModels)
        ? entries[index - 1].displayRank
        : index + 1;
    });

    return {
      foods,
      entries,
      criteriaModels,
      activeModels,
      excludedModels: criteriaModels.filter(model => !model.eligible)
    };
  }

  function resultCriterionChip(model, entry) {
    const result = entry.criteria[model.id];
    let text = model.label;
    let className = 'myfit-result-chip';

    if (!model.eligible) {
      className += ' is-muted';
      text += model.reason === 'missing' ? ' · 확인불가' : ' · 동일';
    } else if (model.kind === 'boolean') {
      if (result.status) {
        className += ' is-positive';
        text += ' ✓';
      } else {
        className += ' is-neutral';
        text += ' —';
      }
    } else {
      className += ' is-ranked';
      text += ` · ${result.rank}위`;
    }

    return `<span class="${className}">${escapeHtml(text)}</span>`;
  }

  function renderResult(model) {
    if (!model || !els.resultList) return;

    if (els.resultFoodCount) els.resultFoodCount.textContent = `${model.foods.length}개`;
    if (els.resultCriteriaCount) els.resultCriteriaCount.textContent = `${model.activeModels.length}개`;
    if (els.resultSpecies) els.resultSpecies.textContent = `${getSpeciesLabel(state.species)} 사료`;

    const notices = [];
    const missing = model.excludedModels.filter(item => item.reason === 'missing');
    const same = model.excludedModels.filter(item => item.reason === 'same');
    if (missing.length) notices.push(`${missing.map(item => item.label).join(', ')}은(는) 일부 제품의 정보가 없어 순위 계산에서 제외했어요.`);
    if (same.length) notices.push(`${same.map(item => item.label).join(', ')}은(는) 선택한 제품이 모두 같아 순위에 영향을 주지 않았어요.`);
    if (!model.activeModels.length) notices.push('현재 선택한 기준으로 제품 간 상대적인 차이를 계산할 수 없어요.');

    if (els.resultNotice) {
      els.resultNotice.hidden = notices.length === 0;
      els.resultNotice.innerHTML = notices.map(message => `<p>${escapeHtml(message)}</p>`).join('');
    }

    els.resultList.innerHTML = model.entries.map((entry, index) => {
      const food = entry.food;
      const meta = [
        food.type === 'wet' ? '습식' : food.type === 'dry' ? '건식' : '',
        food.완전식여부 || '',
        food.메인단백질 || ''
      ].filter(Boolean).join(' · ');
      const detailHref = `/food/?species=${encodeURIComponent(food.species || state.species)}&id=${encodeURIComponent(food.id)}`;
      const tied = index > 0 && entry.displayRank === model.entries[index - 1].displayRank;

      return `
        <article class="myfit-result-card${entry.displayRank === 1 ? ' is-top' : ''}">
          <div class="myfit-result-side">
            <div class="myfit-result-rank">
              <span>MY FIT</span>
              <strong>${String(entry.displayRank).padStart(2, '0')}</strong>
              ${tied ? '<small>공동</small>' : ''}
            </div>
            ${food.image_url
              ? `<img class="myfit-result-image" src="${escapeHtml(food.image_url)}" alt="" loading="lazy">`
              : '<div class="myfit-result-image myfit-result-image--empty" aria-hidden="true">FOOD</div>'}
          </div>
          <div class="myfit-result-card__body">
            <p class="myfit-result-brand">${escapeHtml(getBrand(food))} · ${getSpeciesLabel(food.species)}</p>
            <h3>${escapeHtml(food.제품명 || '제품명 정보 없음')}</h3>
            <p class="myfit-result-meta">${escapeHtml(meta)}</p>
            <div class="myfit-result-chips">
              ${model.criteriaModels.map(criteriaModel => resultCriterionChip(criteriaModel, entry)).join('')}
            </div>
          </div>
          <a class="myfit-result-detail" href="${escapeHtml(detailHref)}" aria-label="${escapeHtml(food.제품명)} 상세 보기">→</a>
        </article>`;
    }).join('');

    if (els.resultCriteriaMeta) {
      els.resultCriteriaMeta.textContent = `${model.activeModels.length}개 기준 반영`;
    }
    if (els.resultCriteriaChips) {
      els.resultCriteriaChips.innerHTML = model.criteriaModels.map((criterionModel, index) => `
        <span class="${criterionModel.eligible ? '' : 'is-excluded'}">
          <b>${index + 1}</b>
          ${escapeHtml(criterionModel.label)}
        </span>`).join('');
    }
  }

  async function calculateAndShowResult() {
    if (state.resultLoading) return;
    if (state.foods.length < MIN_FOODS || !state.order.length || state.order.length !== state.selected.size) {
      showToast('사료와 기준, 우선순위를 먼저 완성해 주세요.');
      return;
    }

    state.resultLoading = true;
    if (els.result) {
      els.result.disabled = true;
      els.result.textContent = 'MY FIT 계산 중…';
    }

    try {
      const foods = await loadSelectedFoodDetails();
      if (foods.length !== state.foods.length) throw new Error('선택한 사료 정보를 모두 불러오지 못했습니다.');
      const model = buildResultModel(foods);
      state.resultModel = model;
      renderResult(model);
      showScreen('result');
    } catch (error) {
      console.error('MY FIT result calculation failed:', error);
      showToast('MY FIT 결과를 계산하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      state.resultLoading = false;
      if (els.result) {
        els.result.textContent = 'MY FIT 결과 보기';
        els.result.disabled = state.order.length !== state.selected.size || state.selected.size === 0;
      }
    }
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 1800);
  }

  function bindEvents() {
    els.foodSearch?.addEventListener('input', () => {
      window.clearTimeout(state.foodSearchTimer);
      state.foodSearchTimer = window.setTimeout(searchFoods, 240);
    });

    els.foodResults?.addEventListener('click', event => {
      const more = event.target.closest('[data-load-more-food-results]');
      if (more) {
        state.foodSearchVisible += 20;
        renderFoodSearchResults();
        return;
      }
      const button = event.target.closest('[data-food-key]');
      if (button?._food) addFood(button._food);
    });

    els.selectedFoods?.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-food]');
      if (button) removeFood(button.dataset.removeFood);
    });

    els.groups?.addEventListener('input', event => {
      const input = event.target.closest('[data-protein-search]');
      if (input) filterProteinChips(input);
    });

    els.groups?.addEventListener('click', event => {
      const directionButton = event.target.closest('[data-direction]');
      if (directionButton) {
        const control = directionButton.closest('[data-direction-control]');
        if (control) setDirection(control.dataset.directionControl, directionButton.dataset.direction);
        return;
      }
      const chip = event.target.closest('[data-chip-criterion]');
      if (chip) toggleChip(chip.dataset.chipCriterion);
    });

    els.toCriteria?.addEventListener('click', () => showScreen('criteria'));
    els.backToFoods?.addEventListener('click', () => showScreen('foods'));
    els.toPriority?.addEventListener('click', () => showScreen('priority'));
    els.backToCriteria?.addEventListener('click', () => showScreen('criteria'));

    els.pool?.addEventListener('click', event => {
      if (Date.now() < state.ignoreClickUntil) return;
      const chip = event.target.closest('[data-pool-id]');
      if (chip) addToOrder(chip.dataset.poolId);
    });

    els.slots?.addEventListener('click', event => {
      const remove = event.target.closest('[data-remove-rank]');
      if (remove) {
        event.stopPropagation();
        removeFromOrder(remove.dataset.removeRank);
      }
    });

    els.result?.addEventListener('click', calculateAndShowResult);
    els.backToPriority?.addEventListener('click', () => showScreen('priority'));
    els.chooseCriteriaAgain?.addEventListener('click', () => showScreen('criteria'));
    els.compareFoodsAgain?.addEventListener('click', () => showScreen('foods'));
  }

  function init() {
    cacheElements();
    if (!els.app || !els.groups) return;
    renderGroups();
    bindEvents();
    syncFoodUi();
    syncCriteriaUi();
  }

  window.addEventListener('DOMContentLoaded', init);
})();