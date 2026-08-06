const PROVED_LAST_ACTIVE_KEY = 'proved:last_active_pet';
const PROVED_SPECIES_PATHS = {
  cat: '/cat-food-calculator/',
  dog: '/dog-food-calculator/'
};

function provedGetRequestedSpecies() {
  const path = window.location.pathname.replace(/\/+$/, '/') || '/';
  return Object.entries(PROVED_SPECIES_PATHS)
    .find(([, speciesPath]) => path === speciesPath)?.[0] || null;
}

function provedGetSpeciesPath(species) {
  return PROVED_SPECIES_PATHS[species === 'dog' ? 'dog' : 'cat'];
}
let provedLastFocus = null;
let provedAuthDestinationScheduled = false;
let provedAuthDestinationTimer = null;
let provedAuthDestinationUserId = null;
let provedAuthDestinationKey = null;
let provedCompletedLoginDestinationKey = null;
let provedAuthGeneration = 0;
let provedRememberedCatState = null;
let provedHomeReturnPage = 'calculatorPage';

function provedGetLastActivePet() {
  try {
    return JSON.parse(localStorage.getItem(PROVED_LAST_ACTIVE_KEY) || 'null');
  } catch {
    return null;
  }
}

function provedClearLastActivePet() {
  localStorage.removeItem(PROVED_LAST_ACTIVE_KEY);
}

function provedSetLastActivePet(pet) {
  if (!pet?.id) return;

  localStorage.setItem(PROVED_LAST_ACTIVE_KEY, JSON.stringify({
    id: pet.id,
    species: pet.species || 'cat',
    name: pet.name || '',
    savedAt: new Date().toISOString()
  }));
  state.lastActivePetId = pet.id;
  state.selectedPetSpecies = pet.species || 'cat';
}

function provedApplyCurrentPetState(pet) {
  if (!pet) return;

  const previousSpecies = state.selectedPetSpecies || null;
  const normalizedPet = { ...pet, species: pet.species || 'cat' };
  state.activePet = normalizedPet;
  state.selectedPetSpecies = normalizedPet.species;
  if (normalizedPet.species === 'cat') {
    provedRememberedCatState = {
      pet: normalizedPet,
      userId: state.currentUser?.id || null,
      selectedSavedCatId: state.selectedSavedCatId ?? null,
      selectedTrendCatId: state.selectedTrendCatId ?? null
    };
  }
  if (normalizedPet.id) provedSetLastActivePet(normalizedPet);
  provedUpdateCurrentPetLabel(normalizedPet);
  provedSetDogMode(normalizedPet.species === 'dog');
  if (typeof updateCalculatorSpeciesCopy === 'function') {
    updateCalculatorSpeciesCopy(normalizedPet.species);
  }
  if (previousSpecies && previousSpecies !== normalizedPet.species) {
    if (typeof resetFeedSearchForSpecies === 'function') {
      resetFeedSearchForSpecies();
    }
  }
}

function provedGetVisibleServicePage() {
  return ['calculatorPage', 'weightTrendPage', 'wetFoodBetaPage'].find(id => {
    const page = document.getElementById(id);
    return page && !page.classList.contains('hidden');
  }) || 'calculatorPage';
}

function provedGoHome() {
  if (window.location.pathname !== '/') {
    window.location.assign('/');
    return;
  }

  // During INITIAL_SESSION, null does not yet mean "signed out". Wait for the
  // existing auth listener rather than starting another auth request or route.
  if (!state.authInitialized) return;

  const currentUserId = state.currentUser?.id || null;
  if (
    state.activePet?.species === 'cat' &&
    provedRememberedCatState?.userId === currentUserId
  ) {
    provedRememberedCatState.selectedSavedCatId = state.selectedSavedCatId ?? null;
    provedRememberedCatState.selectedTrendCatId = state.selectedTrendCatId ?? null;
  }

  provedHomeReturnPage = provedGetVisibleServicePage();
  provedShowEntry(state.currentUser ? 'pet' : 'start');
}

function provedChooseSpecies(species) {
  const normalizedSpecies = species === 'dog' ? 'dog' : 'cat';
  const destination = provedGetSpeciesPath(normalizedSpecies);
  if (window.location.pathname !== destination) {
    window.location.assign(destination);
    return;
  }

  if (normalizedSpecies === 'dog') {
    return setActivePet({ species: 'dog' }, { route: 'dog' });
  }

  const rememberedState = provedRememberedCatState;
  const currentUserId = state.currentUser?.id || null;
  if (rememberedState && rememberedState.userId === currentUserId) {
    provedHideEntry();
    provedApplyCurrentPetState(rememberedState.pet);
    state.selectedSavedCatId = rememberedState.selectedSavedCatId;
    state.selectedTrendCatId = rememberedState.selectedTrendCatId;
    const returnPage = provedHomeReturnPage;
    const previousApplying = state.isApplyingActivePet;
    state.isApplyingActivePet = true;
    try {
      showPage(returnPage);
    } finally {
      state.isApplyingActivePet = previousApplying;
    }
    return;
  }

  return setActivePet({ species: 'cat' }, { route: 'calculator' });
}

function provedSetEntryAuthMessage(message, tone = 'gray') {
  const msg = document.getElementById('provedEntryAuthMsg');
  if (!msg) return;

  msg.textContent = message || '';
  msg.className = `proved-entry-auth-msg ${tone === 'red' ? 'text-red-500' : tone === 'blue' ? 'text-blue-500' : 'text-gray-400'}`;
  msg.classList.toggle('hidden', !message);
}

function provedShowEntry(step = 'start') {
  document.getElementById('provedEntry')?.classList.remove('hidden');
  provedRenderEntry(step);
}

function provedHideEntry() {
  document.getElementById('provedEntry')?.classList.add('hidden');
}

function provedUpdateCurrentPetLabel(pet = null) {
  const currentName = document.getElementById('provedCurrentPetName');
  const weightDate = document.getElementById('provedCurrentPetWeightDate');
  if (!currentName) return;

  if (!pet) {
    currentName.textContent = '반려동물을 선택해 주세요';
    weightDate?.classList.add('hidden');
    return;
  }

  const speciesLabel = (pet.species || 'cat') === 'dog' ? '강아지' : '고양이';
  currentName.textContent = pet.name ? `${pet.name} · ${speciesLabel}` : `게스트 ${speciesLabel}`;
  weightDate?.classList.add('hidden');
}

function provedSetDogMode(enabled) {
  document.body.classList.toggle('proved-dog-mode', enabled);
  ['navWetFoodBeta'].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = enabled;
    button.setAttribute('aria-disabled', String(enabled));
    button.classList.toggle('cursor-not-allowed', enabled);
  });
}

function provedRenderEntry(step) {
  const root = document.getElementById('provedEntryMain');
  if (!root) return;

  root.dataset.step = step;

  const steps = activeStep => `
    <div class="proved-steps" aria-hidden="true">
      <span class="proved-step ${activeStep === 1 ? 'active' : ''}"></span>
      <span class="proved-step ${activeStep === 2 ? 'active' : ''}"></span>
    </div>`;

  const isStart = step === 'start';
  const isLogin = step === 'login';
  const option = (label, modifier, attributes = '') =>
    `<button class="proved-entry-option proved-entry-option--${modifier}" type="button" ${attributes}>${label}</button>`;

  const speciesOptions = isLogin ? '' : `
      ${option(step === 'pet' ? '고양이와' : '고양이', step === 'pet' ? 'active proved-entry-option--cat' : 'muted proved-entry-option--cat', step === 'pet' ? "onclick=\"provedChooseSpecies('cat')\"" : 'disabled')}
      ${option(step === 'pet' ? '강아지와' : '강아지', step === 'pet' ? 'active proved-entry-option--dog' : 'muted proved-entry-option--dog', step === 'pet' ? "onclick=\"provedChooseSpecies('dog')\"" : 'disabled')}`;

  const options = `
    <div class="proved-entry-options">
      ${option('로그인', isLogin || isStart ? 'active proved-entry-option--login' : 'muted proved-entry-option--login', isLogin ? '' : "onclick=\"provedRenderEntry('login')\"")}
      ${option('로그인 없이', isStart || step === 'pet' ? 'active proved-entry-option--guest' : 'muted proved-entry-option--guest', step === 'pet' ? '' : "onclick=\"provedRenderEntry('pet')\"")}
      <div class="proved-entry-divider" aria-hidden="true"></div>
      ${speciesOptions}
    </div>`;

  const detail = isLogin ? `
    <div class="proved-login-area">
      <p class="proved-entry__hint">로그인 방법을 선택해 주세요.</p>
      <div class="proved-login-list">
        <button class="proved-login-button" type="button" onclick="provedHandleEntryOAuthLogin('google')">
          <span class="proved-login-provider-icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3.1l5.7-5.7A19.9 19.9 0 0 0 24 4C13 4 4 13 4 24s9 20 20 20c11 0 20-9 20-20 0-1.2-.1-2.4-.4-3.5z"/></svg></span>
          <span>Google로 계속하기</span>
        </button>
        <button class="proved-login-button" type="button" onclick="provedHandleEntryOAuthLogin('kakao')">
          <span class="proved-login-provider-icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><path d="M24 6C12.95 6 4 13.16 4 22c0 5.72 3.75 10.74 9.39 13.57l-2.4 8.82a1 1 0 0 0 1.48 1.1l10.53-6.7c.33.02.66.03 1 .03 11.05 0 20-7.16 20-16S35.05 6 24 6zm-9.1 12.08h-3.13V28h-2.5v-9.92H6.14V16h8.76v2.08zM23.72 28h-2.56l-.77-2.33h-3.61L16.02 28h-2.55l4.12-12h2.04l4.09 12zm8.03 0h-7.24V16h2.5v9.92h4.74V28zm9.45 0h-2.93l-3.16-4.9-.94 1.14V28h-2.5V16h2.5v5.02L38.11 16h2.98l-4.31 5.24L41.2 28zm-23.74-4.42h2.25l-1.11-3.55-1.14 3.55z"/></svg></span>
          <span>카카오로 계속하기</span>
        </button>
      </div>
      <p id="provedEntryAuthMsg" class="proved-entry-auth-msg hidden" role="status" aria-live="polite"></p>
      <button class="proved-login-guest" type="button" onclick="provedRenderEntry('pet')">로그인 없이 시작하기</button>
    </div>` : `<p class="proved-entry__hint">${isStart ? '로그인 없이 시작하면 선택할 수 있어요.' : '함께할 반려동물을 선택해 주세요.'}</p>`;

  root.innerHTML = `
    <div class="proved-entry__main">
      <div class="proved-entry__content">
        <h2 class="proved-entry__title">${step === 'pet' ? '누구와 함께할까요?' : isLogin ? '로그인 방법을 선택해주세요' : '먼저 로그인 방식을 선택해주세요'}</h2>
        ${options}
        ${detail}
        ${steps(step === 'pet' ? 2 : 1)}
      </div>
    </div>`;
}

async function provedHandleEntryOAuthLogin(provider) {
  provedSetEntryAuthMessage(`${provider === 'google' ? 'Google' : '카카오'} 로그인으로 이동합니다...`, 'blue');
  if (provider === 'google') await handleGoogleOAuthLogin();
  if (provider === 'kakao') await handleKakaoOAuthLogin();
}

async function provedFetchPets() {
  if (!state.currentUser && typeof getCurrentUser === 'function') {
    state.currentUser = await getCurrentUser();
  }
  if (!state.currentUser) return [];

  return typeof fetchMyCats === 'function' ? await fetchMyCats(state.currentUser.id) : [];
}

async function provedResolveLoginDestination() {
  const pets = await provedFetchPets();
  const requestedSpecies = provedGetRequestedSpecies();

  if (requestedSpecies) {
    const matchingPets = pets.filter(pet => (pet.species || 'cat') === requestedSpecies);
    const last = provedGetLastActivePet();
    const matchingLast = last && matchingPets.find(pet => String(pet.id) === String(last.id));

    if (matchingLast) {
      await setActivePet(matchingLast, { route: 'calculator' });
      return;
    }

    if (matchingPets.length === 1) {
      await setActivePet(matchingPets[0], { route: 'calculator' });
      return;
    }

    await setActivePet({ species: requestedSpecies }, { route: 'calculator' });
    return;
  }

  if (!pets.length) {
    provedShowEntry('pet');
    return;
  }

  const last = provedGetLastActivePet();
  const match = last && pets.find(pet =>
    String(pet.id) === String(last.id) && pet.species === last.species
  );
  if (match) {
    await setActivePet(match, { route: 'calculator' });
    return;
  }

  if (pets.length === 1) {
    await setActivePet(pets[0], { route: 'calculator' });
    return;
  }

  provedHideEntry();
  openPetSelectorModal('calculator');
}

function provedGetLoginDestinationKey(sessionOrUser) {
  const user = sessionOrUser?.user || sessionOrUser;
  if (!user?.id) return null;

  return `${user.id}:cycle-${provedAuthGeneration}`;
}

function provedCancelScheduledLoginDestination({ resetCompleted = false } = {}) {
  provedAuthGeneration += 1;
  if (provedAuthDestinationTimer) {
    clearTimeout(provedAuthDestinationTimer);
  }
  provedAuthDestinationTimer = null;
  provedAuthDestinationScheduled = false;
  provedAuthDestinationUserId = null;
  provedAuthDestinationKey = null;
  if (resetCompleted) {
    provedCompletedLoginDestinationKey = null;
  }
}

function provedScheduleLoginDestination(sessionOrUser) {
  const user = sessionOrUser?.user || sessionOrUser;
  const destinationKey = provedGetLoginDestinationKey(sessionOrUser);
  if (!user?.id || !destinationKey) return;

  if (provedCompletedLoginDestinationKey === destinationKey) {
    return;
  }

  if (
    provedAuthDestinationScheduled &&
    provedAuthDestinationKey === destinationKey
  ) {
    return;
  }

  if (provedAuthDestinationTimer) {
    clearTimeout(provedAuthDestinationTimer);
  }

  provedAuthDestinationScheduled = true;
  provedAuthDestinationUserId = user.id;
  provedAuthDestinationKey = destinationKey;
  state.currentUser = user;

  const scheduledGeneration = provedAuthGeneration;
  provedAuthDestinationTimer = setTimeout(async () => {
    provedAuthDestinationTimer = null;
    try {
      if (
        scheduledGeneration !== provedAuthGeneration ||
        state.currentUser?.id !== user.id ||
        provedAuthDestinationKey !== destinationKey
      ) {
        return;
      }

      await refreshAuthUI();

      if (
        scheduledGeneration !== provedAuthGeneration ||
        state.currentUser?.id !== user.id ||
        provedAuthDestinationKey !== destinationKey
      ) {
        return;
      }

      await provedResolveLoginDestination();
      provedCompletedLoginDestinationKey = destinationKey;
    } catch (error) {
      console.error('Login destination resolution failed:', error);
    } finally {
      if (provedAuthDestinationKey === destinationKey) {
        provedAuthDestinationScheduled = false;
        provedAuthDestinationUserId = null;
        provedAuthDestinationKey = null;
      }
    }
  }, 0);
}


async function setActivePet(pet, options = {}) {
  const normalizedPet = { ...pet, species: pet.species || 'cat' };
  resetRecentFeedButtons();
  provedHideEntry();
  provedApplyCurrentPetState(normalizedPet);

  const syncCalculator = options.syncCalculator !== false;
  const syncTrend = options.syncTrend !== false;
  const previousApplying = state.isApplyingActivePet;
  state.isApplyingActivePet = true;

  if (options.route === 'weight') {
    showPage('weightTrendPage');
  } else {
    showPage('calculatorPage');
  }

  try {
    if (normalizedPet.id && syncCalculator && typeof selectSavedCat === 'function') {
      await selectSavedCat(normalizedPet);
    }

    if (normalizedPet.id && syncTrend && state.currentUser && typeof selectTrendCat === 'function') {
      await selectTrendCat(normalizedPet);
    }
  } finally {
    state.isApplyingActivePet = previousApplying;
  }

}

async function provedEnterPet(pet) {
  await setActivePet(pet, { route: 'calculator' });
}

function provedGetFocusableElements(container) {
  return Array.from(container.querySelectorAll([
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(','))).filter(element => element.offsetParent !== null);
}

async function openPetSelectorModal(context) {
  context = context || (
    document.getElementById('weightTrendPage') &&
    !document.getElementById('weightTrendPage').classList.contains('hidden')
      ? 'weight'
      : 'calculator'
  );

  const modal = document.getElementById('provedPetSelectorModal');
  const list = document.getElementById('provedPetSelectorList');
  const msg = document.getElementById('provedPetSelectorMsg');
  if (!modal || !list || !msg) return;

  provedLastFocus = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  list.innerHTML = '';
  msg.textContent = '반려동물을 불러오는 중입니다...';

  try {
    const pets = await provedFetchPets();

    if (!pets.length) {
      msg.textContent = '저장된 반려동물이 없습니다.';
      return;
    }

    const active = state.activePet || provedGetLastActivePet();
    list.innerHTML = pets.map(pet => `
      <button type="button" class="proved-pet-row ${active && String(active.id) === String(pet.id) ? 'is-active' : ''}" data-pet-id="${escapeHtml(pet.id)}">
        <strong>${escapeHtml(pet.name || '이름 없음')}</strong><br>
        <small>${escapeHtml(pet.birth_date || '생년월일 없음')} · ${pet.species === 'dog' ? '강아지' : '고양이'}</small>
      </button>
    `).join('');
    list._pets = pets;
    list.onclick = async event => {
      const button = event.target.closest('[data-pet-id]');
      if (!button) return;

      const pet = list._pets.find(item => String(item.id) === String(button.dataset.petId));
      if (!pet) return;

      closePetSelectorModal();
      await setActivePet(pet, { route: context });
    };
    msg.textContent = '불러올 반려동물을 선택해 주세요.';
  } catch (error) {
    msg.textContent = `불러오기 실패: ${error.message}`;
  } finally {
    const panel = modal.querySelector('.proved-pet-modal__panel');
    const focusable = provedGetFocusableElements(panel || modal);
    (focusable[0] || panel || modal).focus();
  }
}

function closePetSelectorModal() {
  const modal = document.getElementById('provedPetSelectorModal');
  if (!modal || modal.classList.contains('hidden')) return;

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  provedLastFocus?.focus?.();
}

function provedResetAccountState() {
  resetRecentFeedButtons();
  provedCancelScheduledLoginDestination({ resetCompleted: true });
  closePetSelectorModal();
  provedClearLastActivePet();
  provedRememberedCatState = null;
  state.currentUser = null;
  state.activePet = null;
  state.selectedSavedCatId = null;
  state.selectedTrendCatId = null;
  state.selectedPetSpecies = null;
  state.lastActivePetId = null;
  state.lastSavedResultKey = null;

  const myCatList = document.getElementById('myCatList');
  if (myCatList) {
    myCatList.innerHTML = '';
    myCatList._cats = [];
    myCatList.classList.add('hidden');
  }

  const trendCatList = document.getElementById('trendCatList');
  if (trendCatList) {
    trendCatList.innerHTML = '';
    trendCatList._trendCats = [];
  }

  if (typeof resetWeightTrendView === 'function') {
    resetWeightTrendView('로그인하면 내 고양이의 체중 추이를 확인할 수 있습니다.');
  }

  provedSetDogMode(false);
  provedUpdateCurrentPetLabel(null);
  provedShowEntry('start');
}

document.addEventListener('keydown', event => {
  const modal = document.getElementById('provedPetSelectorModal');
  if (!modal || modal.classList.contains('hidden')) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closePetSelectorModal();
    return;
  }

  if (event.key !== 'Tab') return;

  const panel = modal.querySelector('.proved-pet-modal__panel');
  const focusable = provedGetFocusableElements(panel || modal);
  if (!focusable.length) {
    event.preventDefault();
    (panel || modal).focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const requestedSpecies = provedGetRequestedSpecies();
  if (!requestedSpecies) return;

  setTimeout(() => {
    if (!state.activePet || (state.activePet.species || 'cat') !== requestedSpecies) {
      setActivePet({ species: requestedSpecies }, { route: 'calculator' });
    }
  }, 0);
});

window.provedShowEntry = provedShowEntry;
window.provedGoHome = provedGoHome;
window.provedChooseSpecies = provedChooseSpecies;
window.provedRenderEntry = provedRenderEntry;
window.provedEnterPet = provedEnterPet;
window.provedResolveLoginDestination = provedResolveLoginDestination;
window.provedScheduleLoginDestination = provedScheduleLoginDestination;
window.provedSetEntryAuthMessage = provedSetEntryAuthMessage;
window.openPetSelectorModal = openPetSelectorModal;
window.closePetSelectorModal = closePetSelectorModal;
window.provedSetLastActivePet = provedSetLastActivePet;
window.provedApplyCurrentPetState = provedApplyCurrentPetState;
window.provedCancelScheduledLoginDestination = provedCancelScheduledLoginDestination;
window.provedResetAccountState = provedResetAccountState;
window.setActivePet = setActivePet;
