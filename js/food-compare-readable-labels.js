(function () {
  'use strict';

  let rafId = 0;

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\s\-_/.,()&]+/g, ' ')
      .trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function removeBrand(name, brand) {
    const source = String(name || '').trim();
    const brandText = String(brand || '').trim();
    if (!source || !brandText) return source;
    const pattern = new RegExp(escapeRegExp(brandText), 'ig');
    return source.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
  }

  function splitTokens(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean);
  }

  function getCompactSameBrandNames(nameA, nameB, brand) {
    let cleanA = removeBrand(nameA, brand) || String(nameA || '').trim();
    let cleanB = removeBrand(nameB, brand) || String(nameB || '').trim();

    const tokensA = splitTokens(cleanA);
    const tokensB = splitTokens(cleanB);
    let prefix = 0;
    const maxPrefix = Math.min(tokensA.length - 1, tokensB.length - 1);
    while (prefix < maxPrefix && normalize(tokensA[prefix]) === normalize(tokensB[prefix])) prefix += 1;

    if (prefix > 0) {
      const nextA = tokensA.slice(prefix).join(' ').trim();
      const nextB = tokensB.slice(prefix).join(' ').trim();
      if (nextA && nextB) {
        cleanA = nextA;
        cleanB = nextB;
      }
    }

    if (normalize(cleanA) === normalize(cleanB)) {
      return [String(nameA || '').trim(), String(nameB || '').trim()];
    }
    return [cleanA, cleanB];
  }

  function getLabels() {
    const cards = Array.from(document.querySelectorAll('#foodCompareContent .food-compare-product')).slice(0, 2);
    if (cards.length !== 2) return null;

    const brands = cards.map(card => card.querySelector('.food-compare-product__brand')?.textContent.trim() || '');
    const products = cards.map(card => card.querySelector('h2')?.textContent.trim() || '');
    if (!brands[0] || !brands[1] || !products[0] || !products[1]) return null;

    if (normalize(brands[0]) !== normalize(brands[1])) {
      return {
        labels: brands,
        fullNames: products,
        mode: 'brand'
      };
    }

    return {
      labels: getCompactSameBrandNames(products[0], products[1], brands[0]),
      fullNames: products,
      mode: 'product'
    };
  }

  function replaceTextNode(node, labelA, labelB) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const next = node.nodeValue
      .replace(/A 제품/g, labelA)
      .replace(/B 제품/g, labelB);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function replaceSectionMarkers(labelA, labelB) {
    document.querySelectorAll('#foodCompareContent .food-compare-section').forEach(section => {
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => replaceTextNode(node, labelA, labelB));
    });
  }

  function applyLabels() {
    const info = getLabels();
    if (!info) return;
    const [labelA, labelB] = info.labels;
    const [fullA, fullB] = info.fullNames;

    document.querySelectorAll('#foodCompareContent .food-compare-table thead tr').forEach(row => {
      const cells = row.querySelectorAll('th');
      if (cells.length < 3) return;
      if (cells[1].textContent.trim() !== labelA) cells[1].textContent = labelA;
      if (cells[2].textContent.trim() !== labelB) cells[2].textContent = labelB;
      cells[1].classList.add('food-compare-table__product-label');
      cells[2].classList.add('food-compare-table__product-label');
      cells[1].dataset.labelMode = info.mode;
      cells[2].dataset.labelMode = info.mode;
      cells[1].title = fullA;
      cells[2].title = fullB;
    });

    replaceSectionMarkers(labelA, labelB);
  }

  function schedule() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      applyLabels();
    });
  }

  function init() {
    const root = document.getElementById('foodCompareContent');
    if (!root) return;
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
