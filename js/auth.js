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
  const loggedOutAuth = document.getElementById('loggedOutAuth');
  const loggedInAuth = document.getElementById('loggedInAuth');
  const userIdentifier = document.getElementById('userIdentifier');
  const authOpenBtn = document.getElementById('authOpenBtn');
  if (!box || !loggedOutAuth || !loggedInAuth || !userIdentifier) return;

  const user = await getCurrentUser();
  if (!user) {
    state.currentUser = null;
    state.selectedSavedCatId = null;
    box.classList.add('hidden');
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
  box.classList.remove('hidden');
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

  const { error } = await sb.auth.signOut();

  if (error) {
    console.error('Logout failed:', error);
    setAuthMessage(`로그아웃 실패: ${error.message}`, 'red');

    if (logoutButton) {
      logoutButton.disabled = false;
      logoutButton.textContent = originalText || '로그아웃';
    }
    return;
  }

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

window.openAuthSheet = openAuthSheet;
window.closeAuthSheet = closeAuthSheet;
window.handleKakaoOAuthLogin = handleKakaoOAuthLogin;
window.handleGoogleOAuthLogin = handleGoogleOAuthLogin;
window.handleLogout = handleLogout;
window.checkLoginState = checkLoginState;
