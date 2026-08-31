(function () {
  function ensureColorSystem() {
    if (!document.querySelector('link[data-proved-colors]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/proved-colors.css?v=20260818-color-system-v2';
      link.dataset.provedColors = 'true';
      document.head.appendChild(link);
    }

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#3568FF');
  }

  function ensureLayoutSystem() {
    if (document.querySelector('link[data-proved-layout]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/proved-layout.css?v=20260831-content-layout-v3';
    link.dataset.provedLayout = 'true';
    document.head.appendChild(link);
  }

  ensureColorSystem();
  ensureLayoutSystem();

  const globalItems = [
    { label: '고양이', href: '/cat-food-calculator/', match: '/cat-food-calculator/' },
    { label: '강아지', href: '/dog-food-calculator/', match: '/dog-food-calculator/' },
    // matches는 상위 메뉴의 하위·레거시 URL에서도 활성 상태를 유지하기 위한 경로 묶음입니다.
    // 하위 URL을 추가하거나 기본 진입 경로를 바꿀 때 이 목록도 함께 갱신합니다.
    { label: '사료', href: '/food/', matches: ['/food/', '/feed-registration/'] },
    { label: '아카이브', href: '/guide/calculation-method/', matches: ['/guide/calculation-method/', '/guide/feed-reading/', '/editorial/', '/archive/'] },
    { label: '로그인', auth: true }
  ];

  const sectionItems = {
    cat: [
      { label: '계산기', id: 'navCalculator', page: 'calculatorPage' },
      { label: '체중 추이', id: 'navWeightTrend', page: 'weightTrendPage' },
      { label: '습식 탐험', id: 'navWetFoodBeta', page: 'wetFoodBetaPage', hidden: true }
    ],
    dog: [
      { label: '계산기', id: 'navCalculator', page: 'calculatorPage' },
      { label: '체중 추이', id: 'navWeightTrend', page: 'weightTrendPage' }
    ],
    food: [
      { label: '등록 요청', href: '/feed-registration/', match: '/feed-registration/' },
      { label: '사료 목록', href: '/food/', match: '/food/' },
      { label: '조건으로 찾기', href: '/food/conditions/', match: '/food/conditions/' }
    ],
    archive: [
      { label: '계산 기준', href: '/guide/calculation-method/', match: '/guide/calculation-method/' },
      { label: '사료 읽기', href: '/guide/feed-reading/', matches: ['/guide/feed-reading/'] },
      { label: '에디토리얼', href: '/editorial/', match: '/editorial/' }
    ]
  };

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, '/') || '/';
  }

  function getSectionKey(path = normalizedPath()) {
    if (path.startsWith('/cat-food-calculator/')) return 'cat';
    if (path.startsWith('/dog-food-calculator/')) return 'dog';
    if (path.startsWith('/food/') || path.startsWith('/feed-registration/')) return 'food';
    if (path.startsWith('/archive/') || path.startsWith('/guide/calculation-method/') || path.startsWith('/guide/feed-reading/') || path.startsWith('/editorial/')) return 'archive';
    return null;
  }

  function runAuthAction() {
    if (typeof window.openAuthSheet === 'function') {
      window.openAuthSheet();
      return;
    }
    if (typeof window.provedRenderEntry === 'function') {
      window.provedRenderEntry('login');
      return;
    }
    window.location.href = '/?login=1';
  }

  function createItem(item, className = 'proved-global-header__item') {
    const element = item.href ? document.createElement('a') : document.createElement('button');
    element.className = className;
    element.textContent = item.label;
    if (item.id) element.id = item.id;
    if (item.href) element.href = item.href;
    else element.type = 'button';
    if (item.page) element.addEventListener('click', () => window.showPage?.(item.page));
    if (item.auth) {
      element.dataset.provedAuth = 'true';
      element.addEventListener('click', runAuthAction);
    }
    if (item.hidden) element.classList.add('hidden');
    if (item.disabled) {
      element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
    }

    const path = normalizedPath();
    const isCurrent = item.hash
      ? path === item.match && window.location.hash === item.hash
      : item.hashAbsent
        ? path === item.match && !window.location.hash
        : item.match
          ? path === item.match
      : Array.isArray(item.matches)
        ? item.matches.some(match => path.startsWith(match))
        : false;

    if (isCurrent) {
      element.classList.add('is-current');
      element.setAttribute('aria-current', 'page');
    } else if (item.page || item.match || item.matches) {
      element.setAttribute('aria-current', 'false');
    }
    return element;
  }

  function renderSectionSubnav(root) {
    // 시작 화면의 헤더는 서비스 화면과 분리합니다. 같은 URL 안에 두 헤더가 존재해도
    // 실제 서비스 헤더에만 섹션 탭이 붙도록 해 중복 선과 중복 내비게이션을 막습니다.
    if (root.dataset.provedHeader === 'home') return;

    const sectionKey = getSectionKey();
    const items = sectionItems[sectionKey];
    if (!sectionKey || !items) return;

    const existing = root.parentElement?.querySelector(':scope > .proved-section-subnav');
    if (existing) existing.remove();

    const subnav = document.createElement('nav');
    subnav.className = `proved-section-subnav proved-section-subnav--${sectionKey}`;
    subnav.dataset.section = sectionKey;
    subnav.dataset.visibleItems = String(items.filter(item => !item.hidden).length);
    subnav.setAttribute('aria-label', `${sectionKey === 'cat' ? '고양이' : sectionKey === 'dog' ? '강아지' : sectionKey === 'food' ? '사료' : '아카이브'} 하위 메뉴`);
    if (sectionKey === 'cat' || sectionKey === 'dog') subnav.id = 'mainNav';

    items.forEach(item => {
      subnav.appendChild(createItem(item, 'proved-section-subnav__item'));
    });

    root.classList.add('has-section-subnav');
    root.insertAdjacentElement('afterend', subnav);
  }

  function renderHeader(root) {
    root.className = 'proved-global-header';
    root.innerHTML = '';

    const brand = document.createElement('a');
    brand.className = 'proved-global-header__brand';
    brand.href = '/';
    brand.setAttribute('aria-label', '프루브 홈');

    const brandLogo = document.createElement('img');
    brandLogo.src = '/icons/proved-main-logo.svg';
    brandLogo.alt = '';
    brandLogo.width = 114;
    brandLogo.height = 22;
    brandLogo.style.display = 'block';
    brandLogo.style.width = 'clamp(86px, 10vw, 114px)';
    brandLogo.style.height = 'auto';
    brand.appendChild(brandLogo);

    const nav = document.createElement('nav');
    nav.className = 'proved-global-header__nav';
    nav.setAttribute('aria-label', '주요 메뉴');
    globalItems.forEach(item => nav.appendChild(createItem(item)));
    root.append(brand, nav);
    renderSectionSubnav(root);
  }

  function renderFooter(root) {
    root.className = 'proved-site-footer';
    root.innerHTML = `
      <p class="proved-site-footer__title">사이트맵</p>
      <nav class="proved-site-footer__nav" aria-label="사이트맵">
        <a href="/">홈</a>
        <a href="/cat-food-calculator/">고양이</a>
        <a href="/dog-food-calculator/">강아지</a>
        <a href="/food/">사료</a>
        <a href="/guide/calculation-method/">아카이브</a>
      </nav>
      <p class="proved-site-footer__copyright">© 2026 프루브. All rights reserved.</p>`;
  }

  function setAuthLabel(loggedIn) {
    document.querySelectorAll('[data-proved-auth="true"]').forEach(item => {
      item.textContent = loggedIn ? '로그인됨' : '로그인';
    });
  }

  function enterSpeciesCalculatorByDefault() {
    const sectionKey = getSectionKey();
    if (sectionKey !== 'cat' && sectionKey !== 'dog') return;
    if (!document.getElementById('provedEntry')) return;

    window.addEventListener('DOMContentLoaded', () => {
      if (typeof window.provedChooseSpecies === 'function') {
        window.provedChooseSpecies(sectionKey);
        return;
      }
      document.getElementById('provedEntry')?.classList.add('hidden');
      window.showPage?.('calculatorPage');
    });
  }

  function enhanceFeedPickerSearch() {
    const sectionKey = getSectionKey();
    if (sectionKey !== 'cat' && sectionKey !== 'dog') return;

    window.addEventListener('DOMContentLoaded', () => {
      const modal = document.getElementById('feedPickerModal');
      const sortManufacturer = document.getElementById('feedPickerSortManufacturer');
      const sortBlock = sortManufacturer?.closest('.pb-4');
      if (!modal || !sortBlock || document.getElementById('feedPickerSearchInput')) return;

      const searchWrap = document.createElement('div');
      searchWrap.className = 'pb-4';
      searchWrap.innerHTML = `
        <label for="feedPickerSearchInput" class="block text-xs font-black text-gray-400 mb-2">검색</label>
        <input id="feedPickerSearchInput" type="search" inputmode="search" autocomplete="off"
          placeholder="브랜드 또는 제품명 검색"
          class="w-full min-h-[48px] px-4 border border-gray-200 bg-white text-sm font-bold text-[#3568FF] placeholder:text-gray-400 outline-none focus:border-[#3568FF]" />`;
      sortBlock.insertAdjacentElement('beforebegin', searchWrap);

      const input = document.getElementById('feedPickerSearchInput');
      if (!input) return;

      input.addEventListener('input', () => {
        if (typeof feedPickerState === 'undefined' || typeof renderFeedPicker !== 'function') return;
        feedPickerState.nameFilter = input.value;
        renderFeedPicker();
      });

      const originalOpenFeedPicker = window.openFeedPicker;
      if (typeof originalOpenFeedPicker === 'function' && !originalOpenFeedPicker.__provedSearchEnhanced) {
        const enhancedOpenFeedPicker = function (...args) {
          const result = originalOpenFeedPicker.apply(this, args);
          input.value = '';
          return result;
        };
        enhancedOpenFeedPicker.__provedSearchEnhanced = true;
        window.openFeedPicker = enhancedOpenFeedPicker;
      }
    });
  }

  document.querySelectorAll('[data-proved-header]').forEach(renderHeader);
  document.querySelectorAll('.proved-site-footer, [data-proved-footer]').forEach(renderFooter);
  window.provedSetHeaderAuthState = setAuthLabel;
  window.addEventListener('proved:auth-state', event => setAuthLabel(Boolean(event.detail?.loggedIn)));
  enterSpeciesCalculatorByDefault();
  enhanceFeedPickerSearch();
  if (new URLSearchParams(window.location.search).get('login') === '1') {
    window.setTimeout(runAuthAction, 0);
  }
})();
