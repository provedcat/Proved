(function () {
  const globalItems = [
    { label: '고양이 계산기', href: '/cat-food-calculator/', match: '/cat-food-calculator/' },
    { label: '강아지 계산기', href: '/dog-food-calculator/', match: '/dog-food-calculator/' },
    // matches는 상위 메뉴의 하위·레거시 URL에서도 활성 상태를 유지하기 위한 경로 묶음입니다.
    // 사료/아카이브 아래에 새 하위 URL을 추가할 때 이 목록도 함께 갱신합니다.
    { label: '사료', href: '/food/', matches: ['/food/', '/feed-registration/'] },
    { label: '아카이브', href: '/archive/', matches: ['/archive/', '/guide/calculation-method/'] },
    { label: '로그인', auth: true }
  ];

  const calculatorItems = [
    { label: '계산기', id: 'navCalculator', page: 'calculatorPage' },
    { label: '체중 추이', id: 'navWeightTrend', page: 'weightTrendPage' },
    { label: '습식 탐험', id: 'navWetFoodBeta', page: 'wetFoodBetaPage', hidden: true }
  ];

  const sectionItems = {
    food: [
      { label: '등록 요청', href: '/feed-registration/', match: '/feed-registration/' },
      { label: '사료 목록', disabled: true },
      { label: '조건으로 찾기', disabled: true }
    ],
    archive: [
      { label: '계산 기준', href: '/guide/calculation-method/', match: '/guide/calculation-method/' },
      { label: '사료 읽기', disabled: true },
      { label: '에디토리얼', disabled: true }
    ]
  };

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, '/') || '/';
  }

  function getSectionKey(path = normalizedPath()) {
    if (path.startsWith('/food/') || path.startsWith('/feed-registration/')) return 'food';
    if (path.startsWith('/archive/') || path.startsWith('/guide/calculation-method/')) return 'archive';
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
    const isCurrent = item.match
      ? path === item.match
      : Array.isArray(item.matches)
        ? item.matches.some(match => path.startsWith(match))
        : item.page === 'calculatorPage';

    if (isCurrent) {
      element.classList.add('is-current');
      element.setAttribute('aria-current', 'page');
    } else if (item.page || item.match || item.matches) {
      element.setAttribute('aria-current', 'false');
    }
    return element;
  }

  function renderCalculatorSubnav(root) {
    if (root.dataset.provedHeader !== 'calculator') return;
    const existing = root.parentElement?.querySelector(':scope > .proved-calculator-subnav');
    if (existing) existing.remove();

    const subnav = document.createElement('nav');
    subnav.className = 'proved-calculator-subnav';
    subnav.id = 'mainNav';
    subnav.setAttribute('aria-label', '계산기 메뉴');
    calculatorItems.forEach(item => {
      subnav.appendChild(createItem(item, 'proved-calculator-subnav__item'));
    });
    root.insertAdjacentElement('afterend', subnav);
  }

  function renderSectionSubnav(root) {
    const sectionKey = getSectionKey();
    if (!sectionKey) return;

    const existing = root.parentElement?.querySelector(':scope > .proved-section-subnav');
    if (existing) existing.remove();

    const subnav = document.createElement('nav');
    subnav.className = `proved-section-subnav proved-section-subnav--${sectionKey}`;
    subnav.setAttribute('aria-label', `${sectionKey === 'food' ? '사료' : '아카이브'} 하위 메뉴`);
    sectionItems[sectionKey].forEach(item => {
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
    brand.textContent = 'PROVED';

    const nav = document.createElement('nav');
    nav.className = 'proved-global-header__nav';
    nav.setAttribute('aria-label', '주요 메뉴');
    globalItems.forEach(item => nav.appendChild(createItem(item)));
    root.append(brand, nav);
    renderCalculatorSubnav(root);
    renderSectionSubnav(root);
  }

  function renderFooter(root) {
    root.className = 'proved-site-footer';
    root.innerHTML = `
      <p class="proved-site-footer__title">사이트맵</p>
      <nav class="proved-site-footer__nav" aria-label="사이트맵">
        <a href="/">홈</a>
        <a href="/cat-food-calculator/">고양이 계산기</a>
        <a href="/dog-food-calculator/">강아지 계산기</a>
        <a href="/food/">사료</a>
        <a href="/archive/">아카이브</a>
      </nav>
      <p class="proved-site-footer__copyright">© 2026 프루브. All rights reserved.</p>`;
  }

  function setAuthLabel(loggedIn) {
    document.querySelectorAll('[data-proved-auth="true"]').forEach(item => {
      item.textContent = loggedIn ? '로그인됨' : '로그인';
    });
  }

  document.querySelectorAll('[data-proved-header]').forEach(renderHeader);
  document.querySelectorAll('.proved-site-footer, [data-proved-footer]').forEach(renderFooter);
  window.provedSetHeaderAuthState = setAuthLabel;
  window.addEventListener('proved:auth-state', event => setAuthLabel(Boolean(event.detail?.loggedIn)));
  if (new URLSearchParams(window.location.search).get('login') === '1') {
    window.setTimeout(runAuthAction, 0);
  }
})();
