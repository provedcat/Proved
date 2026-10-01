(function () {
  'use strict';

  const MAX_FOODS = 5;
  const MIN_FOODS = 2;
  const MAX_CRITERIA = 5;
  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlIiwicmVmIjoicXBrbHZ0Z25ocmRtenh6bHN0cHAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3NTk2MTUyMiwiZXhwIjoyMDkxNTM3NTIyfQ.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';

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
    selected: new Map(),
    order: [],
    drag: null,
    ignoreClickUntil: 0
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
    els.foodCount = $('myFitFoodCount');
    els.foodSearch = $('myFitFoodSearchInput');
    els.foodSearchHint = $('myFitFoodSearchHint');
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

  function quotePostgrestFilterValue(value) {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  function buildSearchPattern(query) {
    return quotePostgrestFilterValue(`*${query}*`);
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

  async function searchFoods() {
    if (!sb || !els.foodSearch || !els.foodResults) return;
    const query = els.foodSearch.value.trim().slice(0, 100);
    const serial = ++state.foodSearchSerial;

    if (query.length < 2) {
      els.foodResults.innerHTML = query ? '<p class="myfit-search-state">두 글자 이상 입력해 주세요.</p>' : '';
      return;
    }

    els.foodResults.innerHTML = '<p class="myfit-search-state">사료를 찾고 있어요.</p>';
    const speciesList = state.species ? [state.species] : ['cat', 'dog'];

    try {
      const pattern = buildSearchPattern(query);
      const responses = await Promise.all(speciesList.map(species =>
        sb.from(species === 'dog' ? 'dog_feeds' : 'feeds')
          .select('id,type,제조사,제품명,완전식여부,메인단백질,verified,searchable_before_review,brands(name)')
          .or('verified.eq.true,searchable_before_review.eq.true')
          .or(`제품명.ilike.${pattern},제조사.ilike.${pattern}`)
          .order('제조사')
          .order('제품명')
          .limit(8)
      ));

      if (serial !== state.foodSearchSerial) return;
      const failed = responses.find(response => response.error);
      if (failed) throw failed.error;

      const selectedKeys = new Set(state.foods.map(foodKey));
      const foods = responses
        .flatMap((response, index) => (response.data || []).map(row => ({ ...row, species: speciesList[index] })))
        .sort((a, b) => getBrand(a).localeCompare(getBrand(b), 'ko') || String(a.제품명 || '').localeCompare(String(b.제품명 || ''), 'ko'))
        .slice(0, 12);

      if (!foods.length) {
        els.foodResults.innerHTML = '<p class="myfit-search-state">검색 결과가 없어요.</p>';
        return;
      }

      els.foodResults.innerHTML = foods.map(food => {
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
      }).join('');

      els.foodResults.querySelectorAll('[data-food-key]').forEach(button => {
        button._food = foods.find(food => foodKey(food) === button.dataset.foodKey);
      });
    } catch (error) {
      if (serial !== state.foodSearchSerial) return;
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
      priority: els.priorityScreen
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

    const activeIndex = name === 'foods' ? 0 : name === 'criteria' ? 1 : 2;
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

    els.result?.addEventListener('click', () => {
      showToast('선택한 사료와 기준으로 MY FIT 순위를 계산하는 단계는 다음 구현에서 연결합니다.');
    });
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