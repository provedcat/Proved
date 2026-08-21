// -----------------------------------------------
// 로그인 사용자 고양이 불러오기
// -----------------------------------------------
async function getCurrentUser() {
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

function setAuthMessage(message, tone = 'gray') {
  const msg = document.getElementById('authMsg');
  if (!msg) return;

  msg.textContent = message;
  msg.className = `text-xs font-bold ${tone === 'red' ? 'text-red-400' : tone === 'blue' ? 'text-blue-400' : 'text-gray-400'}`;
  msg.classList.toggle('hidden', !message);

  if (typeof provedSetEntryAuthMessage === 'function') {
    provedSetEntryAuthMessage(message, tone);
  }
}

function openAuthSheet() {
  const sheet = document.getElementById('authSheet');
  if (!sheet) return;

  sheet.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeAuthSheet() {
  const sheet = document.getElementById('authSheet');
  if (!sheet) return;

  sheet.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

async function refreshAuthUI() {
  const box = document.getElementById('savedCatLoadBox');
  const calculatorPetLoadButton = document.getElementById('calculatorPetLoadButton');
  const loggedOutAuth = document.getElementById('loggedOutAuth');
  const loggedInAuth = document.getElementById('loggedInAuth');
  const userIdentifier = document.getElementById('userIdentifier');
  const authOpenBtn = document.getElementById('authOpenBtn');
  if (!loggedOutAuth || !loggedInAuth || !userIdentifier) return;

  const user = await getCurrentUser();
  if (!user) {
    resetRecentFeedButtons();
    state.currentUser = null;
    state.selectedSavedCatId = null;
    box?.classList.add('hidden');
    calculatorPetLoadButton?.classList.add('hidden');
    loggedOutAuth.classList.remove('hidden');
    loggedInAuth.classList.add('hidden');
    userIdentifier.textContent = '';
    if (authOpenBtn) authOpenBtn.textContent = '로그인';
    updateSaveFeedingButtonVisibility();
    if (typeof window.updateWetFoodBetaAccess === 'function') {
      await window.updateWetFoodBetaAccess(null);
    }
    return;
  }

  state.currentUser = user;
  loggedOutAuth.classList.add('hidden');
  loggedInAuth.classList.remove('hidden');
  // Do not expose provider metadata or the internal Supabase UUID in the UI.
  userIdentifier.textContent = '로그인됨';
  if (authOpenBtn) authOpenBtn.textContent = '로그인됨';
  box?.classList.remove('hidden');
  calculatorPetLoadButton?.classList.remove('hidden');
  updateSaveFeedingButtonVisibility();
  if (typeof window.updateWetFoodBetaAccess === 'function') {
    await window.updateWetFoodBetaAccess(user);
  }
}

function getCurrentPageRedirectTo() {
  return window.location.href.split('#')[0];
}

async function handleKakaoOAuthLogin() {
  setAuthMessage('카카오 로그인으로 이동합니다...', 'blue');

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: getCurrentPageRedirectTo(),
      // Override Supabase/provider defaults so Kakao receives no optional consent scope.
      scopes: ''
    }
  });

  if (error) {
    setAuthMessage('카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'red');
  }
}

async function handleGoogleOAuthLogin() {
  setAuthMessage('Google 로그인으로 이동합니다...', 'blue');

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getCurrentPageRedirectTo()
    }
  });

  if (error) {
    setAuthMessage('Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'red');
  }
}

async function handleLogout() {
  const logoutButton = document.querySelector('#loggedInAuth button[onclick="handleLogout()"]');
  const originalText = logoutButton?.textContent;

  if (logoutButton) {
    logoutButton.disabled = true;
    logoutButton.textContent = '로그아웃 중...';
  }

  setAuthMessage('로그아웃 중입니다...', 'blue');
  state.isLoggingOut = true;

  const { error } = await sb.auth.signOut();

  if (error) {
    console.error('Logout failed:', error);
    setAuthMessage(`로그아웃 실패: ${error.message}`, 'red');

    state.isLoggingOut = false;

    if (logoutButton) {
      logoutButton.disabled = false;
      logoutButton.textContent = originalText || '로그아웃';
    }
    return;
  }

  state.isLoggingOut = false;

  if (typeof provedResetAccountState === 'function') {
    provedResetAccountState();
  } else {
    state.currentUser = null;
    state.selectedSavedCatId = null;
    state.selectedTrendCatId = null;
    state.lastSavedResultKey = null;
  }

  setAuthMessage('', 'gray');
  await refreshAuthUI();

  if (typeof refreshWeightTrendPage === 'function') {
    refreshWeightTrendPage();
  }

  closeAuthSheet();
}

async function checkLoginState() {
  await refreshAuthUI();
}

// -----------------------------------------------
// 익명/로그인 계산 이벤트 저장
// -----------------------------------------------
const PROVED_ANONYMOUS_SESSION_KEY = 'proved.anonymousSessionId.v1';
let volatileAnonymousSessionId = null;

function createAnonymousSessionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : ((random & 0x3) | 0x8);
    return value.toString(16);
  });
}

function getAnonymousSessionId() {
  if (volatileAnonymousSessionId) return volatileAnonymousSessionId;

  try {
    const existing = localStorage.getItem(PROVED_ANONYMOUS_SESSION_KEY);
    if (existing) {
      volatileAnonymousSessionId = existing;
      return existing;
    }

    const created = createAnonymousSessionId();
    localStorage.setItem(PROVED_ANONYMOUS_SESSION_KEY, created);
    volatileAnonymousSessionId = created;
    return created;
  } catch (error) {
    volatileAnonymousSessionId = createAnonymousSessionId();
    return volatileAnonymousSessionId;
  }
}

function getFeedManufacturer(feed) {
  const display = String(feed?.display || '');
  const separatorIndex = display.indexOf(' | ');
  return separatorIndex >= 0 ? display.slice(0, separatorIndex).trim() : '';
}

function getSelectedFeedState(type, name) {
  const feeds = type === 'dry'
    ? (state.dryFeeds || []).filter(Boolean)
    : (state.wetSlotIds || []).map(slotId => state.wetFeedMap?.[slotId]).filter(Boolean);

  return feeds.find(feed => feed?.name === name) || null;
}

async function resolveCalculationFeedAmounts(lastResult) {
  const selections = [
    ...(lastResult.건사료_결과 || []).map(item => ({ type: 'dry', item })),
    ...(lastResult.습식사료_결과 || []).map(item => ({ type: 'wet', item }))
  ];

  if (!selections.length) return [];

  const table = lastResult.species === 'dog' ? 'dog_feeds' : 'feeds';
  const names = [...new Set(selections.map(({ item }) => item.이름).filter(Boolean))];
  const { data, error } = await sb
    .from(table)
    .select('id,제품명,제조사,type')
    .in('제품명', names);

  if (error) throw error;

  return selections.map(({ type, item }) => {
    const selectedFeed = getSelectedFeedState(type, item.이름);
    const manufacturer = getFeedManufacturer(selectedFeed);
    const candidates = (data || []).filter(row => row.제품명 === item.이름 && row.type === type);
    const matched = manufacturer
      ? candidates.find(row => String(row.제조사 || '').trim() === manufacturer) || candidates[0]
      : candidates[0];

    return {
      feed_id: matched?.id || null,
      feed_type: type,
      feed_name: item.이름,
      amount_g: Number(item.급여량_g) || 0,
      kcal: Number(item.담당칼로리) || 0
    };
  });
}

async function persistCalculationEvent(lastResult) {
  if (!lastResult || !sb) return;

  const weight = Number(document.getElementById('catWeight')?.value);
  const ageMonths = Math.max(0, Math.floor(Number(lastResult.caloriePlan?.months) || 0));
  const neuteredValue = document.getElementById('catNeutered')?.value;
  if (!Number.isFinite(weight) || !['true', 'false'].includes(neuteredValue)) return;

  const feedAmounts = await resolveCalculationFeedAmounts(lastResult);
  const dryFeedIds = feedAmounts.filter(item => item.feed_type === 'dry' && item.feed_id).map(item => item.feed_id);
  const wetFeedIds = feedAmounts.filter(item => item.feed_type === 'wet' && item.feed_id).map(item => item.feed_id);
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData?.session?.user || null;
  const isDog = lastResult.species === 'dog';
  const expectedAdultWeight = Number(document.getElementById('dogExpectedAdultWeight')?.value);

  const payload = {
    anonymous_session_id: getAnonymousSessionId(),
    species: lastResult.species === 'dog' ? 'dog' : 'cat',
    weight_kg: weight,
    age_months: ageMonths,
    is_neutered: neuteredValue === 'true',
    is_diet: Boolean(document.getElementById('isDiet')?.checked),
    is_pregnant: Boolean(document.getElementById('isPregnant')?.checked),
    is_lactating: Boolean(document.getElementById('isLactating')?.checked),
    dog_activity: isDog ? (document.querySelector('input[name="dogActivity"]:checked')?.value || 'normal') : null,
    expected_adult_weight_kg: isDog && Number.isFinite(expectedAdultWeight) && expectedAdultWeight > 0 ? expectedAdultWeight : null,
    dry_feed_ids: dryFeedIds,
    wet_feed_ids: wetFeedIds,
    dry_ratio_pct: Math.round(Number(lastResult.dryRatio || 0) * 100),
    wet_ratio_pct: Math.round(Number(lastResult.wetRatio || 0) * 100),
    treat_kcal: Number(lastResult.treatKcal) || 0,
    der_kcal: Number(lastResult.DER) || 0,
    food_kcal: Number(lastResult.foodKcal) || 0,
    feed_amounts: feedAmounts,
    calculated_at: new Date().toISOString(),
    is_logged_in: Boolean(user?.id),
    user_id: user?.id || null
  };

  const { error } = await sb.from('calculation_events').insert(payload);
  if (error) throw error;
}

function installCalculationEventTracking() {
  const originalCalculate = window.calculate;
  if (typeof originalCalculate !== 'function' || originalCalculate.__provedCalculationTrackingWrapped) return;

  function trackedCalculate(...args) {
    const previousResult = state.lastResult;
    const returnValue = originalCalculate.apply(this, args);
    const currentResult = state.lastResult;

    if (currentResult && currentResult !== previousResult && !state.isCalculationDirty) {
      void persistCalculationEvent(currentResult).catch(error => {
        console.warn('계산 이벤트를 저장하지 못했습니다.', error);
      });
    }

    return returnValue;
  }

  trackedCalculate.__provedCalculationTrackingWrapped = true;
  window.calculate = trackedCalculate;
}

installCalculationEventTracking();

window.openAuthSheet = openAuthSheet;
window.closeAuthSheet = closeAuthSheet;
window.handleKakaoOAuthLogin = handleKakaoOAuthLogin;
window.handleGoogleOAuthLogin = handleGoogleOAuthLogin;
window.handleLogout = handleLogout;
window.checkLoginState = checkLoginState;
