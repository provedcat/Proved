// Render a crawlable brand directory using the same verified feed groups as the SEO pages.
// All hrefs, labels and product counts are present in the initial HTML response.
export function renderBrandDirectoryHtml(brandGroups, { buildBrandPath, escapeHtml }) {
  const groups = [...brandGroups].sort((a, b) =>
    String(a.brand.displayName || a.brand.name).localeCompare(
      String(b.brand.displayName || b.brand.name), 'ko'
    )
  );
  const cards = groups.map(({ brand, items }) => {
    const original = String(brand.name || '').trim();
    const korean = String(brand.nameKo || '').trim();
    const fallback = String(brand.displayName || '').trim();
    let mainName = original || fallback || korean;
    let secondaryName = korean && korean !== mainName ? korean : '';

    // Brands such as "Royal Canin 로얄캐닌" may already contain both scripts.
    // Show the Korean name once, with the Latin name on its own line.
    if (secondaryName && mainName.includes(secondaryName)) {
      mainName = mainName.replace(secondaryName, '').trim() || mainName;
    } else if (secondaryName && secondaryName.includes(mainName)) {
      secondaryName = secondaryName.replace(mainName, '').trim();
    }
    if (/[가-힣]/.test(mainName) && /[A-Za-z]/.test(mainName) && !secondaryName) {
      const hangulName = (mainName.match(/[가-힣]+(?:\s+[가-힣]+)*/g) || []).join(' ').trim();
      const latinName = mainName.replace(/[가-힣]+/g, '').replace(/\s+/g, ' ').trim();
      if (hangulName && latinName) {
        mainName = latinName;
        secondaryName = hangulName;
      }
    }
    if (!/[A-Za-z]/.test(mainName) && /[A-Za-z]/.test(secondaryName)
      && !/[가-힣]/.test(secondaryName)) {
      [mainName, secondaryName] = [secondaryName, mainName];
    }
    if (mainName === secondaryName) secondaryName = '';

    const dryCount = items.filter(({ feed }) => feed.type === 'dry').length;
    const wetCount = items.filter(({ feed }) => feed.type === 'wet').length;
    const url = buildBrandPath(brand);
    return '<li><a class="brand-directory__item" href="' + escapeHtml(url) + '">'
      + '<span class="brand-directory__brand"><strong class="brand-directory__name">' + escapeHtml(mainName) + '</strong>'
      + (secondaryName ? '<span class="brand-directory__name-ko">' + escapeHtml(secondaryName) + '</span>' : '')
      + '</span>'
      + '<span class="brand-directory__metric brand-directory__metric--dry"><span class="brand-directory__metric-label">건사료</span><strong>' + dryCount + '<span class="brand-directory__unit">개</span></strong></span>'
      + '<span class="brand-directory__metric brand-directory__metric--wet"><span class="brand-directory__metric-label">습식사료</span><strong>' + wetCount + '<span class="brand-directory__unit">개</span></strong></span>'
      + '<span class="brand-directory__chevron" aria-hidden="true">›</span>'
      + '</a></li>';
  }).join('\n');
  const title = '사료 브랜드 전체 목록 | PROVED';
  const description = 'PROVED에 등록된 ' + groups.length
    + '개 반려동물 사료 브랜드를 한곳에서 확인하세요. 브랜드를 선택하면 고양이·강아지 사료의 성분과 칼로리 정보를 볼 수 있습니다.';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="https://proved.kr/food/brands/">
  <meta property="og:site_name" content="프루브">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="https://proved.kr/food/brands/">
  <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/variable/woff2/SUIT-Variable.css">
  <link rel="stylesheet" href="/css/food-list.css">
  <link rel="stylesheet" href="/css/proved-header.css">
  <link rel="stylesheet" href="/css/brand-directory.css">
  <script defer src="/js/proved-header.js?v=20261016-about-v1"></script>
</head>
<body>
  <div class="food-shell">
    <header data-proved-header="food"></header>
    <main class="brand-directory">
      <nav class="brand-directory__breadcrumb" aria-label="현재 위치"><a href="/food/">사료 찾기</a><span aria-hidden="true">/</span><span>전체 브랜드</span></nav>
      <header class="brand-directory__intro">
        <p class="food-eyebrow">BRANDS</p>
        <h1>사료 브랜드 전체 목록</h1>
        <p>등록된 ${groups.length}개 브랜드를 확인하고 원하는 브랜드의 사료 목록으로 이동하세요.</p>
      </header>
      <div class="brand-directory__list-heading"><strong>${groups.length}개의 전체 브랜드</strong><span>등록된 건사료·습식사료 수</span></div>
      <ul class="brand-directory__list">
        ${cards}
      </ul>
    </main>
    <footer class="proved-site-footer" data-proved-footer>
      <p class="proved-site-footer__title">사이트맵</p>
      <nav class="proved-site-footer__nav" aria-label="사이트맵">
        <a href="/">홈</a>
        <a href="/food/">사료 찾기</a>
        <a href="/food/brands/">전체 브랜드</a>
      </nav>
    </footer>
  </div>
</body>
</html>
`;
}
