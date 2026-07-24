const PROVED_LAST_ACTIVE_KEY = 'proved:last_active_pet';

function provedGetLastActivePet() {
  try {
    return JSON.parse(localStorage.getItem(PROVED_LAST_ACTIVE_KEY) || 'null');
  } catch {
    return null;
  }
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

function provedShowEntry(step = 'start') {
  document.getElementById('provedEntry')?.classList.remove('hidden');
  provedRenderEntry(step);
}

function provedHideEntry() {
  document.getElementById('provedEntry')?.classList.add('hidden');
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
            <button class="proved-login-button" onclick="handleGoogleOAuthLogin()"><span class="proved-login-icon">G</span><span>Google로 계속하기</span></button>
            <button class="proved-login-button" onclick="handleKakaoOAuthLogin()"><span class="proved-login-icon" style="font-size:14px">TALK</span><span>카카오로 계속하기</span></button>
          </div>
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
            <button class="proved-choice" type="button" onclick="provedEnterPet({ species: 'cat' })">고양이와</button>
            <button class="proved-choice" type="button" onclick="provedEnterPet({ species: 'dog' })">강아지와</button>
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
  const match = last && pets.find(pet => String(pet.id) === String(last.id));
  if (match) {
    await provedEnterPet(match);
    return;
  }

  if (pets.length === 1) {
    await provedEnterPet(pets[0]);
    return;
  }

  provedHideEntry();
  openPetSelectorModal('calculator');
}

async function provedEnterPet(pet) {
  state.selectedPetSpecies = pet.species || 'cat';
  if (pet.id) provedSetLastActivePet(pet);

  provedHideEntry();
  document.body.classList.toggle('proved-dog-blocked', state.selectedPetSpecies === 'dog');

  const currentName = document.getElementById('provedCurrentPetName');
  if (currentName) {
    currentName.textContent = pet.name
      ? `${pet.name} · ${state.selectedPetSpecies === 'cat' ? '고양이' : '강아지'}`
      : (state.selectedPetSpecies === 'cat' ? '게스트 고양이' : '게스트 강아지');
  }

  if (state.selectedPetSpecies === 'dog') {
    showPage('dogReadyPage');
    return;
  }

  if (pet.id && typeof selectSavedCat === 'function') {
    await selectSavedCat(pet);
  }
  showPage('calculatorPage');
}

let provedLastFocus = null;

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
  if (!modal || !list) return;

  provedLastFocus = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  list.innerHTML = '';
  msg.textContent = '반려동물을 불러오는 중입니다...';

  let pets = [];
  try {
    pets = await provedFetchPets();
  } catch (error) {
    msg.textContent = `불러오기 실패: ${error.message}`;
    return;
  }

  if (!pets.length) {
    msg.textContent = '저장된 고양이가 없습니다.';
    return;
  }

  const active = provedGetLastActivePet();
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

    provedSetLastActivePet(pet);
    closePetSelectorModal();

    if (context === 'weight' && typeof selectTrendCat === 'function') {
      await selectTrendCat(pet);
    } else {
      await provedEnterPet(pet);
    }
  };
  msg.textContent = '불러올 반려동물을 선택해 주세요.';
  modal.querySelector('[data-modal-close]')?.focus();
}

function closePetSelectorModal() {
  const modal = document.getElementById('provedPetSelectorModal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  provedLastFocus?.focus?.();
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closePetSelectorModal();
});

window.provedShowEntry = provedShowEntry;
window.provedRenderEntry = provedRenderEntry;
window.provedEnterPet = provedEnterPet;
window.provedResolveLoginDestination = provedResolveLoginDestination;
window.openPetSelectorModal = openPetSelectorModal;
window.closePetSelectorModal = closePetSelectorModal;
window.provedSetLastActivePet = provedSetLastActivePet;
