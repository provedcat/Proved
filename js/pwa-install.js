(function () {
  const GA4_MEASUREMENT_ID = 'G-HV1TPVCQK7';
  const GA4_HOSTS = new Set(['proved.kr', 'www.proved.kr']);

  function initializeGoogleAnalytics() {
    if (!GA4_HOSTS.has(window.location.hostname) || window.__provedGa4Loaded) return;

    window.__provedGa4Loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', GA4_MEASUREMENT_ID);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  }

  initializeGoogleAnalytics();

  const IOS_INSTALL_MESSAGE = 'Safari 공유 메뉴에서 “홈 화면에 추가”를 선택해 주세요.';
  const FALLBACK_INSTALL_MESSAGE = '브라우저 메뉴에서 “홈 화면에 추가”를 선택해 주세요.';
  const INSTALL_UNAVAILABLE_MESSAGE = '지금은 브라우저 메뉴에서 “홈 화면에 추가”를 선택해 주세요.';
  const HIDE_STORAGE_KEY = 'provedcat:pwa-install-hidden-until';
  const HIDE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
  const MESSAGE_HIDE_DELAY_MS = 4000;

  let deferredInstallPrompt = null;
  let fallbackHideTimer = null;
  let sessionHidden = false;

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isMobileBrowser() {
    const ua = window.navigator.userAgent || '';
    const uaDataMobile = window.navigator.userAgentData?.mobile === true;
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser/i.test(ua);
    const touchDevice = window.matchMedia('(pointer: coarse)').matches;

    return uaDataMobile || mobileUA || (touchDevice && window.matchMedia('(max-width: 767px)').matches);
  }

  function isSamsungBrowser() {
    return /SamsungBrowser/i.test(window.navigator.userAgent || '');
  }

  function isIosSafari() {
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);

    return isIosDevice && isSafari;
  }

  function getHiddenUntil() {
    try {
      return Number(window.localStorage.getItem(HIDE_STORAGE_KEY)) || 0;
    } catch (error) {
      return 0;
    }
  }

  function isTemporarilyHidden() {
    return sessionHidden || Date.now() < getHiddenUntil();
  }

  function hideForAWhile() {
    sessionHidden = true;

    try {
      window.localStorage.setItem(HIDE_STORAGE_KEY, String(Date.now() + HIDE_DURATION_MS));
    } catch (error) {
      // localStorage가 막힌 환경에서는 현재 세션에서만 버튼을 숨깁니다.
    }
  }

  function setInstallMessage(message) {
    const messageEl = document.getElementById('pwaInstallMsg');
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.classList.remove('hidden');
  }

  function clearInstallMessage() {
    const messageEl = document.getElementById('pwaInstallMsg');
    if (messageEl) messageEl.classList.add('hidden');
  }

  function updateInstallPromptVisibility() {
    const promptEl = document.getElementById('pwaInstallPrompt');
    if (!promptEl) return;

    const shouldShow = !isStandaloneMode() && !isTemporarilyHidden() && (deferredInstallPrompt || isMobileBrowser());
    promptEl.classList.toggle('hidden', !shouldShow);

    if (!shouldShow) clearInstallMessage();
  }

  function showFallbackAndTemporarilyHide(message = FALLBACK_INSTALL_MESSAGE) {
    window.clearTimeout(fallbackHideTimer);
    setInstallMessage(message);
    hideForAWhile();

    fallbackHideTimer = window.setTimeout(() => {
      updateInstallPromptVisibility();
    }, MESSAGE_HIDE_DELAY_MS);
  }

  async function handleInstallClick() {
    if (isStandaloneMode()) {
      updateInstallPromptVisibility();
      return;
    }

    if (deferredInstallPrompt && isSamsungBrowser()) {
      deferredInstallPrompt = null;
      showFallbackAndTemporarilyHide(FALLBACK_INSTALL_MESSAGE);
      return;
    }

    if (deferredInstallPrompt) {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      hideForAWhile();

      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;

        if (choice?.outcome === 'accepted') {
          clearInstallMessage();
        } else {
          setInstallMessage(FALLBACK_INSTALL_MESSAGE);
        }
      } catch (error) {
        setInstallMessage(FALLBACK_INSTALL_MESSAGE);
      }

      window.setTimeout(updateInstallPromptVisibility, MESSAGE_HIDE_DELAY_MS);
      return;
    }

    if (isIosSafari()) {
      showFallbackAndTemporarilyHide(IOS_INSTALL_MESSAGE);
      return;
    }

    showFallbackAndTemporarilyHide(isMobileBrowser() ? FALLBACK_INSTALL_MESSAGE : INSTALL_UNAVAILABLE_MESSAGE);
  }

  function handleInstallDismiss() {
    hideForAWhile();
    updateInstallPromptVisibility();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch((error) => {
        console.warn('ProvedCat service worker registration failed:', error);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallPromptVisibility();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideForAWhile();
    updateInstallPromptVisibility();
  });

  window.addEventListener('DOMContentLoaded', () => {
    const installButton = document.getElementById('pwaInstallBtn');
    const dismissButton = document.getElementById('pwaInstallDismissBtn');

    if (installButton) installButton.addEventListener('click', handleInstallClick);
    if (dismissButton) dismissButton.addEventListener('click', handleInstallDismiss);

    updateInstallPromptVisibility();
  });

  window.addEventListener('resize', updateInstallPromptVisibility);

  const standaloneMedia = window.matchMedia('(display-mode: standalone)');
  if (standaloneMedia.addEventListener) {
    standaloneMedia.addEventListener('change', updateInstallPromptVisibility);
  } else if (standaloneMedia.addListener) {
    standaloneMedia.addListener(updateInstallPromptVisibility);
  }

  registerServiceWorker();
}());
