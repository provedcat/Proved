(function () {
  const configs = {
    home: [
      { label: '계산 기준', href: '/guide/calculation-method/' },
      { label: '로그인', auth: true }
    ],
    calculator: [
      { label: '통합 계산기', id: 'navCalculator', page: 'calculatorPage' },
      { label: '체중 추이', id: 'navWeightTrend', page: 'weightTrendPage' },
      { label: '습식 탐험', id: 'navWetFoodBeta', page: 'wetFoodBetaPage', hidden: true },
      { label: '계산 기준', href: '/guide/calculation-method/' },
      { label: '로그인', id: 'authOpenBtn', auth: true }
    ],
    guide: [
      { label: '고양이 계산기', href: '/cat-food-calculator/' },
      { label: '강아지 계산기', href: '/dog-food-calculator/' },
      { label: '사료 등록', href: '/feed-registration/' },
      { label: '계산 기준', href: '/guide/calculation-method/', current: true },
      { label: '로그인', auth: true }
    ],
    registration: [
      { label: '고양이 계산기', href: '/cat-food-calculator/' },
      { label: '강아지 계산기', href: '/dog-food-calculator/' },
      { label: '사료 등록', href: '/feed-registration/', current: true },
      { label: '계산 기준', href: '/guide/calculation-method/' },
      { label: '로그인', auth: true }
    ]
  };

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

  function createItem(item) {
    const element = item.href ? document.createElement('a') : document.createElement('button');
    element.className = 'proved-global-header__item';
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
    if (item.current) {
      element.classList.add('is-current');
      element.setAttribute('aria-current', 'page');
    } else if (item.page) {
      element.setAttribute('aria-current', item.page === 'calculatorPage' ? 'page' : 'false');
      if (item.page === 'calculatorPage') element.classList.add('is-current');
    }
    return element;
  }

  function renderHeader(root) {
    const variant = root.dataset.provedHeader || 'home';
    const items = configs[variant] || configs.home;
    root.className = `proved-global-header proved-global-header--${variant}`;
    root.innerHTML = '';

    const brand = document.createElement('a');
    brand.className = 'proved-global-header__brand';
    brand.href = '/';
    brand.setAttribute('aria-label', '프루브 홈');
    brand.textContent = 'PROVED';

    const nav = document.createElement('nav');
    nav.className = 'proved-global-header__nav';
    nav.setAttribute('aria-label', '주요 메뉴');
    if (variant === 'calculator') nav.id = 'mainNav';
    items.forEach(item => nav.appendChild(createItem(item)));
    root.append(brand, nav);
  }

  function setAuthLabel(loggedIn) {
    document.querySelectorAll('[data-proved-auth="true"]').forEach(item => {
      item.textContent = loggedIn ? '로그인됨' : '로그인';
    });
  }

  document.querySelectorAll('[data-proved-header]').forEach(renderHeader);
  window.provedSetHeaderAuthState = setAuthLabel;
  window.addEventListener('proved:auth-state', event => setAuthLabel(Boolean(event.detail?.loggedIn)));
  if (new URLSearchParams(window.location.search).get('login') === '1') {
    window.setTimeout(runAuthAction, 0);
  }
})();
