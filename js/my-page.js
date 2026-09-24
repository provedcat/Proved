(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  const PET_PALETTE = [
    { accent: '#C3C7F4', soft: '#EEF0FF' },
    { accent: '#C8A8E9', soft: '#F3EAFA' },
    { accent: '#E3AADD', soft: '#F8EAF6' },
    { accent: '#F6BCBA', soft: '#FCEAE8' },
    { accent: '#F2DDDC', soft: '#FAF1F0' },
    { accent: '#C7B8FF', soft: '#F2EEFF' }
  ];

  const FOOD_PALETTE = [
    { accent: '#8F92FF', soft: '#EEF0FF' },
    { accent: '#C8A8E9', soft: '#F3EAFA' },
    { accent: '#E3AADD', soft: '#F8EAF6' },
    { accent: '#F6BCBA', soft: '#FCEAE8' },
    { accent: '#C7B8FF', soft: '#F2EEFF' },
    { accent: '#D9B7C9', soft: '#FAEEF3' }
  ];

  const state = {
    favoriteRows: [],
    favoriteFilter: 'all',
    comparisonRows: [],
    favoriteUndo: null,
    favoriteUndoTimer: null
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function hashText(value) {
    const text = String(value || '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  function paletteForPet(pet) {
    return PET_PALETTE[hashText(pet.id || pet.name) % PET_PALETTE.length];
  }

  function paletteForFood(food) {
    return FOOD_PALETTE[hashText((food.species || '') + ':' + (food.id || '')) % FOOD_PALETTE.length];
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 96)
      .replace(/-+$/g, '') || 'food';
  }

  function getFoodBrand(food) {
    const relation = Array.isArray(food?.brands) ? food.brands[0] : food?.brands;
    return relation?.name || food?.제조사 || '브랜드 정보 없음';
  }

  function buildFoodPath(food) {
    const brand = getFoodBrand(food);
    const base = slugify(brand + ' ' + (food?.제품명 || ''));
    const stableId = String(food?.id || '').replace(/-/g, '').slice(0, 8).toLowerCase();
    return '/food/' + (food?.species === 'dog' ? 'dog' : 'cat') + '/' + base + '--' + (stableId || 'detail') + '/';
  }

  function foodTypeLabel(type) {
    return type === 'wet' ? '습식사료' : type === 'dry' ? '건사료' : '형태 확인중';
  }

  function foodTypeIcon(type) {
    if (type === 'wet') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5s-5 5.7-5 10a5 5 0 0 0 10 0c0-4.3-5-10-5-10Z"></path></svg>';
    }
    if (type === 'dry') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14c0 4.2-3.1 7-7 7s-7-2.8-7-7Z"></path><circle cx="8" cy="8" r="1.5"></circle><circle cx="13" cy="7" r="1.5"></circle><circle cx="17" cy="9" r="1.5"></circle></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle></svg>';
  }

  function formatFoodKcal(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(number) + ' kcal/kg';
  }

  function formatFoodRatio(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return '—';
    return number.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + ' : 1';
  }

  function speciesLabel(species) {
    return species === 'dog' ? '강아지' : '고양이';
  }

  function formatComparisonDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric',
      day: 'numeric'
    }).format(date);
  }

  function buildComparisonPath(row) {
    const ids = [row.product_a_id, row.product_b_id].filter(Boolean).map(encodeURIComponent);
    return '/food/compare/?species=' + encodeURIComponent(row.species || 'cat') + '&ids=' + ids.join(',');
  }

  function formatWeight(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '최근 체중 없음';
    return number.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + 'kg';
  }

  function calculateAgeLabel(birthDate) {
    if (!birthDate) return '나이 정보 없음';
    const birth = new Date(birthDate + 'T00:00:00');
    if (Number.isNaN(birth.getTime())) return '나이 정보 없음';

    const today = new Date();
    let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
    if (today.getDate() < birth.getDate()) months -= 1;
    if (months < 0) return '나이 정보 없음';

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return Math.max(1, remainingMonths) + '개월';
    if (remainingMonths === 0) return years + '살';
    return years + '살 ' + remainingMonths + '개월';
  }

  function petIcon(species) {
    if (species === 'dog') {
      return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20 19c-5-8-12-6-12 2 0 6 4 11 9 13"/><path d="M44 19c5-8 12-6 12 2 0 6-4 11-9 13"/>' +
        '<path d="M18 28c0-10 6-17 14-17s14 7 14 17v9c0 10-6 17-14 17S18 47 18 37z"/>' +
        '<circle cx="26" cy="31" r="1.5" fill="currentColor" stroke="none"/><circle cx="38" cy="31" r="1.5" fill="currentColor" stroke="none"/>' +
        '<path d="M29 39c2-2 4-2 6 0-1 3-5 3-6 0z"/><path d="M32 42v3"/>' +
        '</svg>';
    }

    return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 24 15 9l13 9M46 24 49 9 36 18"/><path d="M17 28c0-10 6-17 15-17s15 7 15 17v10c0 10-6 17-15 17S17 48 17 38z"/>' +
      '<circle cx="26" cy="31" r="1.5" fill="currentColor" stroke="none"/><circle cx="38" cy="31" r="1.5" fill="currentColor" stroke="none"/>' +
      '<path d="M29 39c2-2 4-2 6 0-1 3-5 3-6 0z"/><path d="M32 42v3M22 41l-10 1M22 45l-9 4M42 41l10 1M42 45l9 4"/>' +
      '</svg>';
  }

  function setHeaderAuthState(loggedIn) {
    if (typeof window.provedSetHeaderAuthState === 'function') {
      window.provedSetHeaderAuthState(Boolean(loggedIn));
    }
  }

  function showLoggedOut() {
    els.authGate.hidden = false;
    els.content.hidden = true;
    setHeaderAuthState(false);
  }

  function showLoggedIn() {
    els.authGate.hidden = true;
    els.content.hidden = false;
    setHeaderAuthState(true);
  }

  async function loadPets(userId) {
    els.petStatus.textContent = '반려동물을 불러오는 중입니다.';
    els.petRail.innerHTML = '';

    const petsResponse = await sb
      .from('pets')
      .select('id,name,birth_date,neutered,species,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (petsResponse.error) throw petsResponse.error;

    const pets = petsResponse.data || [];
    if (!pets.length) {
      els.petStatus.textContent = '';
      els.petRail.innerHTML =
        '<div class="my-empty-pets"><strong>아직 저장한 반려동물이 없습니다.</strong>' +
        '<span>계산 결과를 저장하면 반려동물 프로필이 만들어집니다. </span>' +
        '<a href="/cat-food-calculator/">고양이 계산기</a> · <a href="/dog-food-calculator/">강아지 계산기</a></div>';
      return;
    }

    const petIds = pets.map(function (pet) { return pet.id; });
    const weightsResponse = await sb
      .from('weight_records')
      .select('pet_id,weight_kg,recorded_date')
      .eq('user_id', userId)
      .in('pet_id', petIds)
      .order('recorded_date', { ascending: false });

    if (weightsResponse.error) throw weightsResponse.error;

    const latestWeightByPet = new Map();
    (weightsResponse.data || []).forEach(function (row) {
      if (!latestWeightByPet.has(String(row.pet_id))) {
        latestWeightByPet.set(String(row.pet_id), row);
      }
    });

    els.petStatus.textContent = '';
    els.petRail.innerHTML = pets.map(function (pet) {
      const palette = paletteForPet(pet);
      const latest = latestWeightByPet.get(String(pet.id));
      const meta = speciesLabel(pet.species) + ' · ' + calculateAgeLabel(pet.birth_date);

      return '<a class="my-pet-card" href="/my/pet/?id=' + encodeURIComponent(pet.id) + '" style="--pet-accent:' + palette.accent + ';--pet-soft:' + palette.soft + ';">' +
        '<div class="my-pet-icon">' + petIcon(pet.species) + '</div>' +
        '<strong>' + escapeHtml(pet.name || '이름 없음') + '</strong>' +
        '<p>' + escapeHtml(meta) + '</p>' +
        '<p>' + escapeHtml(formatWeight(latest && latest.weight_kg)) + '</p>' +
        '<span class="my-pet-accent" aria-hidden="true"></span>' +
        '</a>';
    }).join('');
    resetFavoriteCarousel();
  }

  async function loadFavoriteFoods(userId) {
    els.favoriteRail.innerHTML = '<div class="my-favorite-loading">관심 사료를 불러오는 중입니다.</div>';

    const favoritesResponse = await sb
      .from('favorite_foods')
      .select('id,species,feed_id,dog_feed_id,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (favoritesResponse.error) throw favoritesResponse.error;

    const favorites = favoritesResponse.data || [];
    if (!favorites.length) {
      state.favoriteRows = [];
      renderFavoriteFoods();
      return;
    }

    const catIds = favorites
      .filter(function (row) { return row.species === 'cat' && row.feed_id; })
      .map(function (row) { return row.feed_id; });
    const dogIds = favorites
      .filter(function (row) { return row.species === 'dog' && row.dog_feed_id; })
      .map(function (row) { return row.dog_feed_id; });

    const selectColumns = 'id,type,제조사,제품명,완전식여부,메인단백질,final_me,ca_p_ratio,brands(name)';
    const queries = [];
    queries.push(catIds.length
      ? sb.from('feeds').select(selectColumns).in('id', catIds)
      : Promise.resolve({ data: [], error: null }));
    queries.push(dogIds.length
      ? sb.from('dog_feeds').select(selectColumns).in('id', dogIds)
      : Promise.resolve({ data: [], error: null }));

    const results = await Promise.all(queries);
    const failed = results.find(function (result) { return result.error; });
    if (failed) throw failed.error;

    const productMap = new Map();
    (results[0].data || []).forEach(function (food) {
      productMap.set('cat:' + String(food.id), { ...food, species: 'cat' });
    });
    (results[1].data || []).forEach(function (food) {
      productMap.set('dog:' + String(food.id), { ...food, species: 'dog' });
    });

    state.favoriteRows = favorites.map(function (favorite) {
      const productId = favorite.species === 'dog' ? favorite.dog_feed_id : favorite.feed_id;
      const food = productMap.get(favorite.species + ':' + String(productId));
      return food ? { ...food, favorite_created_at: favorite.created_at } : null;
    }).filter(Boolean);

    renderFavoriteFoods();
  }

  function updateFavoriteCarouselNav() {
    if (!els.favoriteRail || !els.favoritePrev || !els.favoriteNext) return;

    const maxScroll = Math.max(0, els.favoriteRail.scrollWidth - els.favoriteRail.clientWidth);
    const hasOverflow = maxScroll > 4;
    els.favoritePrev.hidden = !hasOverflow;
    els.favoriteNext.hidden = !hasOverflow;

    if (!hasOverflow) return;

    els.favoritePrev.disabled = els.favoriteRail.scrollLeft <= 4;
    els.favoriteNext.disabled = els.favoriteRail.scrollLeft >= maxScroll - 4;
  }

  function resetFavoriteCarousel() {
    if (!els.favoriteRail) return;
    els.favoriteRail.scrollLeft = 0;
    window.requestAnimationFrame(updateFavoriteCarouselNav);
  }

  function scrollFavoriteCarousel(direction) {
    if (!els.favoriteRail) return;
    const card = els.favoriteRail.querySelector('.my-favorite-card-wrap, .my-empty-card');
    const styles = window.getComputedStyle(els.favoriteRail);
    const gap = parseFloat(styles.columnGap || styles.gap) || 14;
    const step = card ? card.getBoundingClientRect().width + gap : els.favoriteRail.clientWidth * 0.8;
    els.favoriteRail.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  function renderFavoriteFoods() {
    const filtered = state.favoriteFilter === 'all'
      ? state.favoriteRows
      : state.favoriteRows.filter(function (food) { return food.species === state.favoriteFilter; });

    if (!state.favoriteRows.length) {
      els.favoriteRail.innerHTML =
        '<article class="my-empty-card my-empty-card--favorite">' +
        '<strong>아직 저장한 관심 사료가 없습니다.</strong>' +
        '<p>사료 찾기에서 관심 제품을 저장하면 최근 저장한 순서대로 이곳에 표시됩니다.</p>' +
        '<a href="/food/">사료 찾기</a>' +
        '</article>';
      resetFavoriteCarousel();
      return;
    }

    if (!filtered.length) {
      els.favoriteRail.innerHTML =
        '<article class="my-empty-card my-empty-card--favorite">' +
        '<strong>' + escapeHtml(state.favoriteFilter === 'dog' ? '저장한 강아지 사료가 없습니다.' : '저장한 고양이 사료가 없습니다.') + '</strong>' +
        '<p>다른 필터를 선택하거나 사료 찾기에서 관심 제품을 저장해 보세요.</p>' +
        '<a href="/food/">사료 찾기</a>' +
        '</article>';
      resetFavoriteCarousel();
      return;
    }

    els.favoriteRail.innerHTML = filtered.map(function (food) {
      const palette = paletteForFood(food);
      const brand = getFoodBrand(food);
      const meta = speciesLabel(food.species) + ' · ' + foodTypeLabel(food.type);

      return '<article class="my-favorite-card-wrap" ' +
        'style="--favorite-accent:' + palette.accent + ';--favorite-soft:' + palette.soft + ';">' +
        '<a class="my-favorite-card" href="' + escapeHtml(buildFoodPath(food)) + '">' +
          '<div class="my-favorite-card__visual">' +
            '<span class="my-favorite-card__type">' +
              foodTypeIcon(food.type) +
              '<span>' + escapeHtml(food.type === 'wet' ? 'WET' : food.type === 'dry' ? 'DRY' : 'FOOD') + '</span>' +
            '</span>' +
            '<strong class="my-favorite-card__visual-title">' + escapeHtml(food.제품명 || '제품명 정보 없음') + '</strong>' +
          '</div>' +
          '<div class="my-favorite-card__body">' +
            '<p class="my-favorite-card__meta">' + escapeHtml(meta) + '</p>' +
            '<p class="my-favorite-card__brand">' + escapeHtml(brand) + '</p>' +
            '<div class="my-favorite-card__stats">' +
              '<span><small>열량</small><b>' + escapeHtml(formatFoodKcal(food.final_me)) + '</b></span>' +
              '<span><small>Ca:P</small><b>' + escapeHtml(formatFoodRatio(food.ca_p_ratio)) + '</b></span>' +
            '</div>' +
          '</div>' +
        '</a>' +
        '<button class="my-favorite-card__heart" type="button" ' +
          'data-my-remove-favorite="' + escapeHtml(food.id) + '" data-my-favorite-species="' + escapeHtml(food.species) + '" ' +
          'aria-label="관심 사료에서 제거" title="관심 사료에서 제거">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.6 10.55 19.3C5.4 14.64 2 11.56 2 7.78 2 4.7 4.42 2.3 7.5 2.3c1.74 0 3.41.81 4.5 2.08A6.04 6.04 0 0 1 16.5 2.3C19.58 2.3 22 4.7 22 7.78c0 3.78-3.4 6.86-8.55 11.53L12 20.6Z"></path></svg>' +
        '</button>' +
      '</article>';
    }).join('');
  }

  function ensureFavoriteUndoToast() {
    let toast = document.getElementById('myFavoriteUndoToast');
    if (toast) return toast;

    toast = document.createElement('div');
    toast.id = 'myFavoriteUndoToast';
    toast.className = 'my-favorite-undo';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML =
      '<span>관심 사료에서 제거했습니다.</span>' +
      '<button type="button" data-favorite-undo>되돌리기</button>';
    document.body.appendChild(toast);

    toast.querySelector('[data-favorite-undo]').addEventListener('click', undoFavoriteRemoval);
    return toast;
  }

  function dismissFavoriteUndo() {
    if (state.favoriteUndoTimer) {
      window.clearTimeout(state.favoriteUndoTimer);
      state.favoriteUndoTimer = null;
    }
    state.favoriteUndo = null;
    const toast = document.getElementById('myFavoriteUndoToast');
    if (toast) toast.classList.remove('is-visible');
  }

  function showFavoriteUndo(food, index, userId) {
    dismissFavoriteUndo();
    state.favoriteUndo = { food, index, userId };
    const toast = ensureFavoriteUndoToast();
    toast.querySelector('span').textContent = '관심 사료에서 제거했습니다.';
    const button = toast.querySelector('[data-favorite-undo]');
    button.disabled = false;
    button.textContent = '되돌리기';
    toast.classList.add('is-visible');
    state.favoriteUndoTimer = window.setTimeout(dismissFavoriteUndo, 5000);
  }

  async function undoFavoriteRemoval() {
    const pending = state.favoriteUndo;
    const toast = document.getElementById('myFavoriteUndoToast');
    const button = toast?.querySelector('[data-favorite-undo]');
    if (!pending || !button || button.disabled) return;

    button.disabled = true;
    button.textContent = '복원 중';

    const food = pending.food;
    const payload = {
      user_id: pending.userId,
      species: food.species,
      feed_id: food.species === 'cat' ? food.id : null,
      dog_feed_id: food.species === 'dog' ? food.id : null,
      created_at: food.favorite_created_at || new Date().toISOString()
    };

    const response = await sb.from('favorite_foods').insert(payload);
    if (response.error && response.error.code !== '23505') {
      console.error('Favorite undo failed:', response.error);
      toast.querySelector('span').textContent = '되돌리지 못했습니다.';
      button.textContent = '다시 시도';
      button.disabled = false;
      return;
    }

    const alreadyPresent = state.favoriteRows.some(function (item) {
      return String(item.id) === String(food.id) && item.species === food.species;
    });
    if (!alreadyPresent) {
      const index = Math.max(0, Math.min(pending.index, state.favoriteRows.length));
      state.favoriteRows.splice(index, 0, food);
    }

    renderFavoriteFoods();
    window.requestAnimationFrame(updateFavoriteCarouselNav);
    dismissFavoriteUndo();
  }

  async function removeFavoriteFood(button) {
    const feedId = String(button?.dataset.myRemoveFavorite || '');
    const species = button?.dataset.myFavoriteSpecies === 'dog' ? 'dog' : 'cat';
    if (!feedId || button.disabled) return;

    const userResponse = await sb.auth.getUser();
    const user = userResponse.data && userResponse.data.user;
    if (!user) return;

    button.disabled = true;
    button.setAttribute('aria-label', '관심 사료에서 제거 중');

    try {
      let query = sb
        .from('favorite_foods')
        .delete()
        .eq('user_id', user.id)
        .eq('species', species);

      query = species === 'dog'
        ? query.eq('dog_feed_id', feedId)
        : query.eq('feed_id', feedId);

      const response = await query;
      if (response.error) throw response.error;

      const card = button.closest('.my-favorite-card-wrap');
      if (card) {
        card.classList.add('is-removing');
        await new Promise(function (resolve) {
          window.setTimeout(resolve, 180);
        });
      }

      const removedIndex = state.favoriteRows.findIndex(function (food) {
        return String(food.id) === feedId && food.species === species;
      });
      const removedFood = removedIndex >= 0 ? state.favoriteRows[removedIndex] : null;

      state.favoriteRows = state.favoriteRows.filter(function (food) {
        return !(String(food.id) === feedId && food.species === species);
      });

      renderFavoriteFoods();
      window.requestAnimationFrame(updateFavoriteCarouselNav);
      if (removedFood) showFavoriteUndo(removedFood, removedIndex, user.id);
    } catch (error) {
      console.error('Favorite remove failed:', error);
      button.disabled = false;
      button.setAttribute('aria-label', '관심 사료에서 제거');
      button.title = '관심 사료에서 제거';
    }
  }

  async function loadComparisonHistory(userId) {
    if (!els.compareList) return;

    els.compareList.innerHTML = '<div class="my-compare-loading">최근 비교를 불러오는 중입니다.</div>';

    const response = await sb
      .from('food_comparison_history')
      .select('id,species,product_a_id,product_b_id,product_a_brand,product_a_name,product_b_brand,product_b_name,compared_at')
      .eq('user_id', userId)
      .order('compared_at', { ascending: false })
      .limit(20);

    if (response.error) throw response.error;

    state.comparisonRows = response.data || [];
    renderComparisonHistory();
  }

  function renderComparisonHistory() {
    if (!els.compareList) return;

    if (!state.comparisonRows.length) {
      els.compareList.innerHTML =
        '<article class="my-empty-compare">' +
          '<div>' +
            '<strong>아직 비교 기록이 없습니다.</strong>' +
            '<p>두 사료를 비교하면 최근 비교한 조합이 시간순으로 이곳에 쌓입니다.</p>' +
          '</div>' +
          '<a href="/food/">사료 비교 시작</a>' +
        '</article>';
      return;
    }

    els.compareList.innerHTML = state.comparisonRows.map(function (row) {
      const species = speciesLabel(row.species);
      const date = formatComparisonDate(row.compared_at);
      const aBrand = row.product_a_brand || '브랜드 정보 없음';
      const bBrand = row.product_b_brand || '브랜드 정보 없음';

      return '<a class="my-compare-record" href="' + escapeHtml(buildComparisonPath(row)) + '">' +
        '<div class="my-compare-record__meta">' +
          '<span>' + escapeHtml(species) + '</span>' +
          '<time datetime="' + escapeHtml(row.compared_at || '') + '">' + escapeHtml(date) + '</time>' +
        '</div>' +
        '<div class="my-compare-record__pair">' +
          '<div class="my-compare-record__product">' +
            '<small>A</small>' +
            '<span>' + escapeHtml(aBrand) + '</span>' +
            '<strong>' + escapeHtml(row.product_a_name || '제품명 정보 없음') + '</strong>' +
          '</div>' +
          '<span class="my-compare-record__versus" aria-hidden="true">↔</span>' +
          '<div class="my-compare-record__product">' +
            '<small>B</small>' +
            '<span>' + escapeHtml(bBrand) + '</span>' +
            '<strong>' + escapeHtml(row.product_b_name || '제품명 정보 없음') + '</strong>' +
          '</div>' +
        '</div>' +
        '<svg class="my-compare-record__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>' +
      '</a>';
    }).join('');
  }

  async function renderForCurrentUser() {
    const userResponse = await sb.auth.getUser();
    const user = userResponse.data && userResponse.data.user;

    if (!user) {
      showLoggedOut();
      return;
    }

    showLoggedIn();

    try {
      await Promise.all([
        loadPets(user.id),
        loadFavoriteFoods(user.id),
        loadComparisonHistory(user.id)
      ]);
    } catch (error) {
      console.error('My Page load failed:', error);
      if (els.petStatus) {
        els.petStatus.textContent = '마이페이지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      }
      if (els.favoriteRail) {
        els.favoriteRail.innerHTML = '<div class="my-favorite-loading">관심 사료를 불러오지 못했습니다.</div>';
      }
    }
  }

  async function login(provider) {
    els.authStatus.textContent = (provider === 'google' ? 'Google' : '카카오') + ' 로그인으로 이동합니다...';

    const options = {
      redirectTo: window.location.origin + '/my/'
    };
    if (provider === 'kakao') options.scopes = '';

    const result = await sb.auth.signInWithOAuth({
      provider: provider,
      options: options
    });

    if (result.error) {
      console.error('My Page login failed:', result.error);
      els.authStatus.textContent = '로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
  }

  async function logout() {
    els.accountStatus.textContent = '로그아웃 중입니다...';
    els.logoutButton.disabled = true;

    const result = await sb.auth.signOut();
    if (result.error) {
      els.accountStatus.textContent = '로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      els.logoutButton.disabled = false;
      return;
    }

    els.accountStatus.textContent = '';
    els.logoutButton.disabled = false;
    showLoggedOut();
  }

  function bindFavoriteFilters() {
    document.querySelectorAll('[data-favorite-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelectorAll('[data-favorite-filter]').forEach(function (item) {
          const active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        state.favoriteFilter = button.dataset.favoriteFilter || 'all';
        renderFavoriteFoods();
      });
    });
  }

  function init() {
    els.authGate = $('myAuthGate');
    els.content = $('myContent');
    els.authStatus = $('myAuthStatus');
    els.petStatus = $('myPetStatus');
    els.petRail = $('myPetRail');
    els.favoriteRail = $('myFavoriteRail');
    els.favoritePrev = $('myFavoritePrev');
    els.favoriteNext = $('myFavoriteNext');
    els.compareList = $('myCompareList');
    els.logoutButton = $('myLogoutButton');
    els.accountStatus = $('myAccountStatus');

    document.querySelectorAll('[data-my-login]').forEach(function (button) {
      button.addEventListener('click', function () {
        login(button.dataset.myLogin);
      });
    });

    els.logoutButton.addEventListener('click', logout);
    els.favoritePrev?.addEventListener('click', function () { scrollFavoriteCarousel(-1); });
    els.favoriteNext?.addEventListener('click', function () { scrollFavoriteCarousel(1); });
    els.favoriteRail?.addEventListener('click', function (event) {
      const button = event.target.closest('[data-my-remove-favorite]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      removeFavoriteFood(button);
    });
    els.favoriteRail?.addEventListener('scroll', updateFavoriteCarouselNav, { passive: true });
    window.addEventListener('resize', updateFavoriteCarouselNav);
    bindFavoriteFilters();
    renderForCurrentUser();

    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session && session.user) {
        showLoggedIn();
        Promise.all([
          loadPets(session.user.id),
          loadFavoriteFoods(session.user.id),
          loadComparisonHistory(session.user.id)
        ]).catch(function (error) {
          console.error('My Page reload failed:', error);
        });
      }
      if (event === 'SIGNED_OUT') {
        showLoggedOut();
      }
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
