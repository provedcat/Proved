const WET_BETA_TESTER_IDS = new Set([
  '70720f7f-51c9-415a-948f-c676ede9a35d'
]);

window.wetBetaAccessGranted = false;

let wetFoodBetaScriptPromise = null;

function canAccessWetFoodBeta(user) {
  return Boolean(
    user?.id &&
    WET_BETA_TESTER_IDS.has(user.id)
  );
}

function setWetBetaAccessGranted(granted) {
  window.wetBetaAccessGranted = granted === true;
}

function updateWetBetaNavigation(allowed) {
  const nav = document.getElementById('mainNav');
  const button = document.getElementById('navWetFoodBeta');

  button?.classList.toggle('hidden', !allowed);

  if (nav) {
    nav.classList.toggle('grid-cols-2', !allowed);
    nav.classList.toggle('grid-cols-3', allowed);
  }
}

function loadWetFoodBetaScript() {
  if (window.renderWetFoodBeta) {
    return Promise.resolve();
  }

  if (wetFoodBetaScriptPromise) {
    return wetFoodBetaScriptPromise;
  }

  wetFoodBetaScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[data-wet-food-beta-script="true"]'
    );

    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');

    script.src = 'js/wet-food-beta.js?v=20260710-wet-beta-private';
    script.dataset.wetFoodBetaScript = 'true';

    script.onload = () => resolve();
    script.onerror = () => {
      wetFoodBetaScriptPromise = null;
      reject(new Error('습식 후보 베타 스크립트를 불러오지 못했습니다.'));
    };

    document.body.appendChild(script);
  });

  return wetFoodBetaScriptPromise;
}

function isWetBetaRequested() {
  const params = new URLSearchParams(window.location.search);
  return params.get('beta') === 'wet';
}

async function updateWetFoodBetaAccess(user) {
  const allowed = canAccessWetFoodBeta(user);

  setWetBetaAccessGranted(allowed);
  updateWetBetaNavigation(allowed);

  if (!allowed) {
    const betaPage = document.getElementById('wetFoodBetaPage');
    const currentlyOnBeta = betaPage?.classList.contains('hidden') === false;
    betaPage?.classList.add('hidden');

    if (currentlyOnBeta && typeof window.showPage === 'function') {
      window.showPage('calculatorPage');
    }

    return false;
  }

  try {
    await loadWetFoodBetaScript();

    if (typeof window.renderWetFoodBeta === 'function') {
      window.renderWetFoodBeta();
    }

    if (
      isWetBetaRequested() &&
      typeof window.showPage === 'function'
    ) {
      window.showPage('wetFoodBetaPage');
    }

    return true;
  } catch (error) {
    console.error('Wet food beta initialization failed:', error);

    setWetBetaAccessGranted(false);
    updateWetBetaNavigation(false);

    return false;
  }
}

window.updateWetFoodBetaAccess = updateWetFoodBetaAccess;
