(function () {
  const GA4_MEASUREMENT_ID = 'G-HV1TPVCQK7';
  const NAVER_ANALYTICS_ID = '180a5406af05de0';
  const ANALYTICS_HOSTS = new Set(['proved.kr', 'www.proved.kr']);

  function initializeGoogleAnalytics() {
    if (!ANALYTICS_HOSTS.has(window.location.hostname) || window.__provedGa4Loaded) return;

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

  function initializeNaverAnalytics() {
    if (!ANALYTICS_HOSTS.has(window.location.hostname) || window.__provedNaverAnalyticsLoaded) return;

    window.__provedNaverAnalyticsLoaded = true;
    window.wcs_add = window.wcs_add || {};
    window.wcs_add.wa = NAVER_ANALYTICS_ID;

    const trackPage = function () {
      if (window.wcs && typeof window.wcs_do === 'function') {
        window.wcs_do();
      }
    };

    if (window.wcs && typeof window.wcs_do === 'function') {
      trackPage();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://wcs.pstatic.net/wcslog.js';
    script.onload = trackPage;
    document.head.appendChild(script);
  }

  initializeGoogleAnalytics();
  initializeNaverAnalytics();

  const IOS_INSTALL_MESSAGE = 'Safari 하단의 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택해 주세요.';
  const FALLBACK_INSTALL_MESSAGE = '브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해 주세요.';
  const INSTALL_UNAVAILABLE_MESSAGE = '모바일 브라우저에서 접속하면 홈 화면에 추가할 수 있습니다.';
  const HIDE_STORAGE_KEY = 'provedcat:pwa-install-hidden-until';
  const HIDE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
  const MESSAGE_HIDE_DELAY_MS = 6500;

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
    const ua = window.navigator.userAgent || '';
    const isIosDevice = /iPad|iPhone|iPod/.test(ua)
      || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);

    return isIosDevice && isSafari;
  }

  function ensureInstallPromptMarkup() {
    if (!document.body || document.getElementById('pwaInstallPrompt')) return;

    if (!document.getElementById('provedPwaInstallStyles')) {
      const style = document.createElement('style');
      style.id = 'provedPwaInstallStyles';
      style.textContent = `
        .proved-pwa-install {
          position: fixed;
          z-index: 9999;
          left: 12px;
          right: 12px;
          bottom: calc(12px + env(safe-area-inset-bottom));
          display: flex;
          align-items: center;
          gap: 11px;
          width: min(620px, calc(100% - 24px));
          margin: 0 auto;
          padding: 12px;
          border: 1px solid #dfe5ec;
          border-radius: 14px;
          background: rgba(255,255,255,.97);
          box-shadow: 0 14px 38px rgba(31,41,55,.18);
          backdrop-filter: blur(12px);
          color: #263141;
          font-family: inherit;
        }
        .proved-pwa-install.hidden { display: none !important; }
        .proved-pwa-install__icon {
          flex: 0 0 auto;
          width: 42px;
          height: 42px;
          border-radius: 11px;
          box-shadow: 0 3px 10px rgba(47,111,237,.14);
        }
        .proved-pwa-install__copy { min-width: 0; flex: 1 1 auto; }
        .proved-pwa-install__copy strong {
          display: block;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.35;
          letter-spacing: -.02em;
        }
        .proved-pwa-install__copy span,
        .proved-pwa-install__message {
          display: block;
          margin-top: 3px;
          color: #727b89;
          font-size: 11px;
          font-weight: 650;
          line-height: 1.45;
        }
        .proved-pwa-install__message { color: #315c9e; }
        .proved-pwa-install__message.hidden { display: none !important; }
        .proved-pwa-install__actions {
          display: flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 6px;
        }
        .proved-pwa-install__button {
          min-height: 38px;
          padding: 0 12px;
          border: 0;
          border-radius: 10px;
          background: #2f6fed;
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          cursor: pointer;
        }
        .proved-pwa-install__dismiss {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 50%;
          background: #f1f3f6;
          color: #7b8492;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }
        @media (max-width: 420px) {
          .proved-pwa-install { align-items: flex-start; gap: 9px; }
          .proved-pwa-install__icon { width: 38px; height: 38px; }
          .proved-pwa-install__actions { flex-direction: column-reverse; align-items: flex-end; }
          .proved-pwa-install__button { min-height: 36px; padding-inline: 10px; }
          .proved-pwa-install__dismiss { width: 30px; height: 30px; }
        }
      `;
      document.head.appendChild(style);
    }

    const prompt = document.createElement('aside');
    prompt.id = 'pwaInstallPrompt';
    prompt.className = 'proved-pwa-install hidden';
    prompt.setAttribute('aria-label', 'Proved 홈 화면 추가 안내');
    prompt.innerHTML = `
      <img class="proved-pwa-install__icon" src="/icons/icon-192.png" alt="" aria-hidden="true">
      <div class="proved-pwa-install__copy">
        <strong>Proved를 앱처럼 사용하세요</strong>
        <span>홈 화면에 추가하면 계산기를 바로 열 수 있습니다.</span>
        <p id="pwaInstallMsg" class="proved-pwa-install__message hidden" role="status" aria-live="polite"></p>
      </div>
      <div class="proved-pwa-install__actions">
        <button id="pwaInstallBtn" class="proved-pwa-install__button" type="button">홈 화면에 추가</button>
        <button id="pwaInstallDismissBtn" class="proved-pwa-install__dismiss" type="button" aria-label="설치 안내 닫기">×</button>
      </div>
    `;
    document.body.appendChild(prompt);
  }

  function ensureGuideFooterLink() {
    document.querySelectorAll('.proved-site-footer__nav').forEach((nav) => {
      if (nav.querySelector('a[href="/guide/calculation-method/"]')) return;
      const link = document.createElement('a');
      link.href = '/guide/calculation-method/';
      link.textContent = '계산 기준';
      nav.appendChild(link);
    });
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

    const shouldShow = !isStandaloneMode()
      && !isTemporarilyHidden()
      && (deferredInstallPrompt || isMobileBrowser());
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
        console.warn('Proved service worker registration failed:', error);
      });
    });
  }

  window.provedRequestInstall = handleInstallClick;

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
    ensureInstallPromptMarkup();
    ensureGuideFooterLink();

    document.getElementById('pwaInstallBtn')?.addEventListener('click', handleInstallClick);
    document.getElementById('pwaInstallDismissBtn')?.addEventListener('click', handleInstallDismiss);

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
