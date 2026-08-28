(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  let rafId = 0;

  function splitLongMixedTitle() {
    const hero = document.querySelector('#foodDetailContent .food-detail-hero');
    const title = hero?.querySelector('h1');
    if (!hero || !title || title.dataset.mobileTitlePolished === 'true') return;

    title.dataset.mobileTitlePolished = 'true';

    if (hero.querySelector('.food-detail-hero__secondary')) return;

    const text = title.textContent.trim();
    if (text.length < 36) return;

    const match = text.match(/^(.+?[가-힣])\s+([A-Z][A-Za-z0-9&'’+.,()\-\s]{12,})$/u);
    if (!match) return;

    title.textContent = match[1].trim();

    const secondary = document.createElement('p');
    secondary.className = 'food-detail-hero__secondary is-generated-english-title';
    secondary.textContent = match[2].trim();
    title.insertAdjacentElement('afterend', secondary);
  }

  function closeSmallBlobCenterGap() {
    const svg = document.querySelector('#foodDetailContent .food-tag-blob__svg');
    if (!svg || svg.dataset.centerBridgeApplied === 'true') return;

    const aria = svg.getAttribute('aria-label') || '';
    const match = aria.match(/대표 태그\s*(\d+)개/);
    const count = match ? Number(match[1]) : 0;
    if (count !== 3 && count !== 4) {
      svg.dataset.centerBridgeApplied = 'true';
      return;
    }

    const mask = svg.querySelector('mask');
    const gooGroup = mask?.querySelector('g[filter]');
    if (!gooGroup) return;

    const bridge = document.createElementNS(NS, 'ellipse');
    bridge.setAttribute('cx', '310');
    bridge.setAttribute('cy', count === 3 ? '355' : '360');
    bridge.setAttribute('rx', count === 3 ? '88' : '80');
    bridge.setAttribute('ry', count === 3 ? '102' : '92');
    bridge.setAttribute('fill', '#fff');
    bridge.setAttribute('aria-hidden', 'true');
    bridge.dataset.blobBridge = 'true';
    gooGroup.appendChild(bridge);

    svg.dataset.centerBridgeApplied = 'true';
  }

  function enhance() {
    splitLongMixedTitle();
    closeSmallBlobCenterGap();
  }

  function schedule() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      enhance();
    });
  }

  function init() {
    const target = document.getElementById('foodDetailContent');
    if (!target) return;
    const observer = new MutationObserver(schedule);
    observer.observe(target, { childList: true, subtree: true });
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
