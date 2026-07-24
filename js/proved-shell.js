const PROVED_LAST_ACTIVE_KEY = 'proved:last_active_pet';
let provedLastFocus = null;
let provedAuthDestinationScheduled = false;

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
  if (!currentName) return;

  if (!pet) {
    currentName.textContent = '반려동물을 선택해 주세요';
    return;
  }

  const speciesLabel = (pet.species || 'cat') === 'dog' ? '강아지' : '고양이';
  currentName.textContent = pet.name ? `${pet.name} · ${speciesLabel}` : `게스트 ${speciesLabel}`;
}

function provedSetDogMode(enabled) {
  document.body.classList.toggle('proved-dog-blocked', enabled);
  ['navCalculator', 'navWeightTrend', 'navWetFoodBeta'].forEach(id => {
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

  const steps = activeStep => `
    <div class="proved-steps" aria-hidden="true">
      <span class="proved-step ${activeStep === 1 ? 'active' : ''}"></span>
      <span class="proved-step ${activeStep === 2 ? 'active' : ''}"></span>
    </div>`;

  if (step === 'login') {
    root.innerHTML = `
      <div class="proved-entry__main">
        <h2 class="proved-entry__title">어떻게 시작할까요?</h2>
        <div>
          <div class="proved-choice-grid">
            <button class="proved-choice" type="button">로그인</button>
            <button class="proved-choice proved-choice--muted" type="button" onclick="provedRenderEntry('pet')">로그인 없이</button>
          </div>
          <p class="proved-entry__hint" style="margin:34px 0 20px">로그인 방법을 선택해 주세요.</p>
          <div class="proved-login-list">
            <button class="proved-login-button" onclick="provedHandleEntryOAuthLogin('google')"><span class="proved-login-icon">G</span><span>Google로 계속하기</span></button>
            <button class="proved-login-button" onclick="provedHandleEntryOAuthLogin('kakao')"><span class="proved-login-icon" style="font-size:14px">TALK</span><span>카카오로 계속하기</span></button>
          </div>
          <p id="provedEntryAuthMsg" class="proved-entry-auth-msg hidden" role="status" aria-live="polite"></p>
          <button class="proved-login-guest" onclick="provedRenderEntry('pet')">로그인 없이 시작하기</button>
        </div>
        ${steps(1)}
      </div>`;
    return;
  }

  if (step === 'pet') {
    root.innerHTML = `
      <div class="proved-entry__main">
        <h2 class="proved-entry__title">누구와 함께할까요?</h2>
        <div>
          <div class="proved-choice-grid">
            <button class="proved-choice proved-choice--muted" type="button" onclick="provedRenderEntry('login')">로그인</button>
            <button class="proved-choice" type="button">로그인 없이</button>
            <button class="proved-choice" type="button" onclick="setActivePet({ species: 'cat' }, { route: 'calculator' })">고양이와</button>
            <button class="proved-choice" type="button" onclick="setActivePet({ species: 'dog' }, { route: 'dog' })">강아지와</button>
          </div>
          <p class="proved-entry__hint" style="margin-top:34px">함께할 반려동물을 선택해 주세요.</p>
          <button class="proved-back" onclick="provedRenderEntry('start')">이전 단계로</button>
        </div>
        ${steps(2)}
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="proved-entry__main">
      <h2 class="proved-entry__title">어떻게 시작할까요?</h2>
      <div>
        <div class="proved-choice-grid">
          <button class="proved-choice" type="button" onclick="provedRenderEntry('login')">로그인</button>
          <button class="proved-choice" type="button" onclick="provedRenderEntry('pet')">로그인 없이</button>
          <button class="proved-choice" type="button" disabled>고양이와</button>
          <button class="proved-choice" type="button" disabled>강아지와</button>
        </div>
        <p class="proved-entry__hint" style="margin-top:34px">로그인 없이 시작하면 선택할 수 있어요.</p>
      </div>
      ${steps(1)}
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

  const cats = typeof fetchMyCats === 'function' ? await fetchMyCats(state.currentUser.id) : [];
  return cats.map(cat => ({ ...cat, species: 'cat' }));
}

async function provedResolveLoginDestination() {
  const pets = await provedFetchPets();

  if (!pets.length) {
    provedShowEntry('pet');
    return;
  }

  const last = provedGetLastActivePet();
  const match = last && pets.find(pet => String(pet.id) === String(last.id) && last.species !== 'dog');
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

function provedScheduleLoginDestination(sessionUser) {
  if (!sessionUser || provedAuthDestinationScheduled) return;
  provedAuthDestinationScheduled = true;
  state.currentUser = sessionUser;
  setTimeout(async () => {
    try {
      await refreshAuthUI();
      await provedResolveLoginDestination();
    } finally {
      provedAuthDestinationScheduled = false;
    }
  }, 0);
}

async function setActivePet(pet, options = {}) {
  const normalizedPet = { ...pet, species: pet.species || 'cat' };
  state.activePet = normalizedPet;
  state.selectedPetSpecies = normalizedPet.species;

  if (normalizedPet.id) {
    provedSetLastActivePet(normalizedPet);
  }

  provedHideEntry();
  provedUpdateCurrentPetLabel(normalizedPet);
  provedSetDogMode(normalizedPet.species === 'dog');

  if (normalizedPet.species === 'dog') {
    state.selectedSavedCatId = null;
    state.selectedTrendCatId = null;
    showPage('dogReadyPage');
    return;
  }

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
  await setActivePet(pet, { route: pet.species === 'dog' ? 'dog' : 'calculator' });
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
      msg.textContent = '저장된 고양이가 없습니다.';
      return;
    }

    const active = state.activePet || provedGetLastActivePet();
    list.innerHTML = pets.map(pet => `
      <button type="button" class="proved-pet-row ${active && String(active.id) === String(pet.id) ? 'is-active' : ''}" data-pet-id="${escapeHtml(pet.id)}">
        <strong>${escapeHtml(pet.name || '이름 없음')}</strong><br>
        <small>${escapeHtml(pet.birth_date || '생년월일 없음')} · 고양이</small>
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
    const focusable = provedGetFocusableElements(modal);
    (focusable[0] || modal).focus();
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
  closePetSelectorModal();
  provedClearLastActivePet();
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

  const focusable = provedGetFocusableElements(modal);
  if (!focusable.length) {
    event.preventDefault();
    modal.focus();
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

window.provedShowEntry = provedShowEntry;
window.provedRenderEntry = provedRenderEntry;
window.provedEnterPet = provedEnterPet;
window.provedResolveLoginDestination = provedResolveLoginDestination;
window.provedScheduleLoginDestination = provedScheduleLoginDestination;
window.provedSetEntryAuthMessage = provedSetEntryAuthMessage;
window.openPetSelectorModal = openPetSelectorModal;
window.closePetSelectorModal = closePetSelectorModal;
window.provedSetLastActivePet = provedSetLastActivePet;
window.provedResetAccountState = provedResetAccountState;
window.setActivePet = setActivePet;
