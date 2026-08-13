(function () {
  const globalItems = [
    { label: '고양이', href: '/cat-food-calculator/', match: '/cat-food-calculator/' },
    { label: '강아지', href: '/dog-food-calculator/', match: '/dog-food-calculator/' },
    { label: '사료 등록', href: '/feed-registration/', match: '/feed-registration/' },
    { label: '계산 기준', href: '/guide/calculation-method/', match: '/guide/calculation-method/' },
    { label: '로그인', auth: true }
  ];

  const calculatorItems = [
    { label: '계산기', id: 'navCalculator', page: 'calculatorPage' },
    { label: '체중 추이', id: 'navWeightTrend', page: 'weightTrendPage' },
    { label: '습식 탐험', id: 'navWetFoodBeta', page: 'wetFoodBetaPage', hidden: true }
  ];

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, '/') || '/';
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

    const isCurrent = item.match
      ? normalizedPath() === item.match
      : item.page === 'calculatorPage';

    if (isCurrent) {
      element.classList.add('is-current');
      element.setAttribute('aria-current', 'page');
    } else if (item.page || item.match) {
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
  }

  function renderFooter(root) {
    root.className = 'proved-site-footer';
    root.innerHTML = `
      <p class="proved-site-footer__title">사이트맵</p>
      <nav class="proved-site-footer__nav" aria-label="사이트맵">
        <a href="/">홈</a>
        <a href="/feed-registration/">사료 등록</a>
        <a href="/cat-food-calculator/">고양이</a>
        <a href="/dog-food-calculator/">강아지</a>
        <a href="/guide/calculation-method/">계산 기준</a>
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