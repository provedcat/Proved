(function (global) {
  'use strict';

  const PRODUCT_ROUTE_RE = /^\/food\/(cat|dog)\/([^/]+)--([a-f0-9]{8})\/?$/i;

  function buildProductSlug(value) {
    return String(value || 'product')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'product';
  }

  function buildProductPath(feed, species) {
    const id = String(feed?.id || '');
    const name = feed?.제품명 || feed?.name || 'product';
    return `/food/${species}/${buildProductSlug(name)}--${id.slice(0, 8).toLowerCase()}/`;
  }

  function readDetailRoute(locationLike = global.location, page = global.__PROVED_FOOD_PAGE__) {
    const pageId = page?.id || page?.feedId || page?.feed?.id;
    if (pageId && (page.species === 'cat' || page.species === 'dog')) {
      return { id: String(pageId), species: page.species, prerendered: true, legacy: false };
    }
    const match = String(locationLike?.pathname || '').match(PRODUCT_ROUTE_RE);
    if (match) {
      return { id: '', idPrefix: match[3].toLowerCase(), species: match[1].toLowerCase(), slug: match[2], prerendered: false, legacy: false };
    }
    const params = new URLSearchParams(locationLike?.search || '');
    const id = params.get('id');
    if (!id) return null;
    return { id, species: params.get('species') === 'dog' ? 'dog' : 'cat', prerendered: false, legacy: true };
  }

  global.ProvedFoodRoutes = { buildProductSlug, buildProductPath, readDetailRoute };
})(window);
