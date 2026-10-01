(function () {
  'use strict';

  const MAX_CRITERIA = 5;

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
      note: '수분과 열량은 제품에 표시된 기준값 그대로 비교해요.',
      directions: [
        ['moisture', '수분', '%'],
        ['calorie', '칼로리', 'kcal / kg']
      ]
    },
    {
      id: 'intake',
      title: '섭취 기준',
      meta: '1,000 kcal 기준',
      note: '같은 열량을 먹었을 때 실제 섭취량을 비교해요.',
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
      note: '좋고 나쁨이 아니라, 내가 선호하거나 피하고 싶은 조건을 골라요.',
      chipSections: [
        {
          title: '선호 단백질원',
          chips: [
            ['prefer_chicken', '치킨 우선'],
            ['prefer_turkey', '칠면조 우선'],
            ['prefer_duck', '오리 우선'],
            ['prefer_quail', '메추리 우선'],
            ['prefer_salmon', '연어 우선'],
            ['prefer_tuna', '참치 우선'],
            ['prefer_fish', '생선 우선']
          ]
        },
        {
          title: '피하고 싶은 원재료',
          chips: [
            ['chicken_free', '치킨 프리'],
            ['fish_free', '생선 프리'],
            ['fish_oil_free', '생선오일 프리'],
            ['meal_free', 'Meal-free'],
            ['corn_free', '옥수수 프리'],
            ['soy_free', '콩 프리']
          ]
        },
        {
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
      note: '제품 자체가 아니라, 확인할 수 있는 정보의 충실도를 기준으로 봐요.',
      chipSections: [
        {
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
      criteria.set(id, { id, label, detail, type: 'direction', group: group.id });
    });
    (group.chipSections || []).forEach(section => {
      section.chips.forEach(([id, label]) => {
        criteria.set(id, { id, label, type: 'chip', group: group.id });
      });
    });
  });

  const state = {
    selected: new Map(),
    order: [],
    drag: null,
    ignoreClickUntil: 0
  };

  const els = {};

  function cacheElements() {
    els.app = document.getElementById('myFitApp');
    els.criteriaScreen = document.getElementById('myFitCriteriaScreen');
    els.priorityScreen = document.getElementById('myFitPriorityScreen');
    els.groups = document.getElementById('myFitCriteriaGroups');
    els.count = document.getElementById('myFitCriteriaCount');
    els.toPriority = document.getElementById('myFitToPriority');
    els.back = document.getElementById('myFitBackToCriteria');
    els.slots = document.getElementById('myFitRankSlots');
    els.pool = document.getElementById('myFitChipPool');
    els.priorityStatus = document.getElementById('myFitPriorityStatus');
    els.result = document.getElementById('myFitShowResult');
    els.toast = document.getElementById('myFitToast');
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

  function criterionLabel(id) {
    const item = criteria.get(id);
    const value = state.selected.get(id);
    if (!item) return id;
    if (item.type === 'direction') return `${item.label} ${value === 'low' ? '↓' : '↑'}`;
    return item.label;
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
        <section class="myfit-chip-section">
          <h4>${escapeHtml(section.title)}</h4>
          <div class="myfit-chip-grid">
            ${section.chips.map(([id, label]) => `
              <button type="button" class="myfit-chip" data-chip-criterion="${id}" aria-pressed="false">
                ${escapeHtml(label)}
              </button>`).join('')}
          </div>
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
    if (els.count) {
      els.count.querySelector('strong').textContent = String(selectedCount);
    }
    if (els.toPriority) els.toPriority.disabled = selectedCount === 0;

    document.querySelectorAll('[data-direction-control]').forEach(control => {
      const id = control.dataset.directionControl;
      const value = state.selected.get(id);
      const displayValue = value === 'low' || value === 'high' ? value : 'none';
      control.dataset.value = displayValue;
      control.classList.toggle('is-disabled', !state.selected.has(id) && selectedCount >= MAX_CRITERIA);
      control.querySelectorAll('button').forEach(button => {
        const direction = button.dataset.direction;
        const isPressed = direction === displayValue;
        button.setAttribute('aria-pressed', String(isPressed));
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
    const isPriority = name === 'priority';
    els.criteriaScreen.hidden = isPriority;
    els.priorityScreen.hidden = !isPriority;
    els.criteriaScreen.classList.toggle('is-active', !isPriority);
    els.priorityScreen.classList.toggle('is-active', isPriority);

    const screen = isPriority ? els.priorityScreen : els.criteriaScreen;
    screen.classList.remove('is-entering');
    void screen.offsetWidth;
    screen.classList.add('is-entering');

    els.progress.forEach((item, index) => {
      item.classList.toggle('is-active', !isPriority ? index === 0 : index <= 1);
    });

    if (isPriority) {
      state.order = state.order.filter(id => state.selected.has(id));
      renderPriority();
    }

    requestAnimationFrame(() => {
      document.querySelector('.myfit-app')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
            </div>` : '<span class="myfit-rank-empty">여기에 기준을 놓아주세요</span>'}
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

    if (els.priorityStatus) {
      els.priorityStatus.textContent = complete
        ? '순서가 완성됐어요.'
        : `${placedCount} / ${selectedCount} 배치`;
    }
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

    const label = criterionLabel(id);
    const ghost = document.createElement('div');
    ghost.className = 'myfit-drag-ghost';
    ghost.textContent = label;
    document.body.appendChild(ghost);

    state.drag = {
      id,
      ghost,
      source,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      target: null
    };

    positionGhost(event.clientX, event.clientY);
    source.classList.add('is-dragging');
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

    document.querySelectorAll('.myfit-rank-slot.is-drop-target')
      .forEach(slot => slot.classList.remove('is-drop-target'));

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
    document.querySelectorAll('.myfit-rank-slot.is-drop-target')
      .forEach(slot => slot.classList.remove('is-drop-target'));
    state.drag?.source?.classList.remove('is-dragging');
    state.drag?.ghost?.remove();
    state.drag = null;
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 1900);
  }

  function bindEvents() {
    els.groups?.addEventListener('click', event => {
      const directionButton = event.target.closest('[data-direction]');
      if (directionButton) {
        const control = directionButton.closest('[data-direction-control]');
        if (!control) return;
        setDirection(control.dataset.directionControl, directionButton.dataset.direction);
        return;
      }

      const chip = event.target.closest('[data-chip-criterion]');
      if (chip) toggleChip(chip.dataset.chipCriterion);
    });

    els.toPriority?.addEventListener('click', () => showScreen('priority'));
    els.back?.addEventListener('click', () => showScreen('criteria'));

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
      showToast('두 화면의 디자인과 인터랙션까지 연결했어요. 결과 화면은 다음 단계에서 붙이면 됩니다.');
    });
  }

  function init() {
    cacheElements();
    if (!els.app || !els.groups) return;
    renderGroups();
    bindEvents();
    syncCriteriaUi();
  }

  window.addEventListener('DOMContentLoaded', init);
})();