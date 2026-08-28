(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  let rafId = 0;

  function tuneBlob(svg) {
    if (!svg || svg.dataset.localBlendApplied === 'true') return;

    const defs = svg.querySelector('defs');
    if (!defs) return;

    const gradients = Array.from(defs.querySelectorAll('radialGradient[id*="Gradient"]'));
    if (!gradients.length) return;

    const mask = defs.querySelector('mask[id$="Mask"]');
    const sourceLobes = mask ? Array.from(mask.querySelectorAll('g ellipse')).slice(0, gradients.length) : [];
    const paintGroup = svg.querySelector('g[mask]');
    const paintRects = paintGroup ? Array.from(paintGroup.querySelectorAll(':scope > rect')) : [];
    if (!paintGroup || paintRects.length < gradients.length + 1) return;

    const baseRect = paintRects[0];
    const colorRects = paintRects.slice(1, gradients.length + 1);

    /* The previous implementation washed the first tag color across the whole Blob. */
    baseRect.setAttribute('opacity', '.07');

    let blur = defs.querySelector('#provedBlobLocalFieldBlur');
    if (!blur) {
      blur = document.createElementNS(NS, 'filter');
      blur.setAttribute('id', 'provedBlobLocalFieldBlur');
      blur.setAttribute('x', '-20%');
      blur.setAttribute('y', '-20%');
      blur.setAttribute('width', '140%');
      blur.setAttribute('height', '140%');
      blur.innerHTML = '<feGaussianBlur stdDeviation="10" />';
      defs.appendChild(blur);
    }

    gradients.forEach((gradient, index) => {
      const lobe = sourceLobes[index];
      if (!lobe) return;

      const rx = Number(lobe.getAttribute('rx')) || 0;
      const ry = Number(lobe.getAttribute('ry')) || 0;
      const radius = Math.max(rx, ry) * 1.22;
      gradient.setAttribute('r', String(radius));

      const stops = Array.from(gradient.querySelectorAll('stop'));
      const spec = [
        ['0%', '1'],
        ['42%', '.98'],
        ['72%', '.72'],
        ['91%', '.16'],
        ['100%', '0']
      ];
      stops.forEach((stop, stopIndex) => {
        if (!spec[stopIndex]) return;
        stop.setAttribute('offset', spec[stopIndex][0]);
        stop.setAttribute('stop-opacity', spec[stopIndex][1]);
      });

      const localMaskId = `provedBlobLocalMask${index}-${Math.random().toString(36).slice(2, 8)}`;
      const localMask = document.createElementNS(NS, 'mask');
      localMask.setAttribute('id', localMaskId);
      localMask.setAttribute('maskUnits', 'userSpaceOnUse');
      localMask.setAttribute('x', '-60');
      localMask.setAttribute('y', '-40');
      localMask.setAttribute('width', '760');
      localMask.setAttribute('height', '840');

      const localEllipse = document.createElementNS(NS, 'ellipse');
      localEllipse.setAttribute('cx', lobe.getAttribute('cx'));
      localEllipse.setAttribute('cy', lobe.getAttribute('cy'));
      localEllipse.setAttribute('rx', String(rx * 1.07));
      localEllipse.setAttribute('ry', String(ry * 1.07));
      localEllipse.setAttribute('fill', '#fff');
      localEllipse.setAttribute('filter', 'url(#provedBlobLocalFieldBlur)');
      const transform = lobe.getAttribute('transform');
      if (transform) localEllipse.setAttribute('transform', transform);
      localMask.appendChild(localEllipse);
      defs.appendChild(localMask);

      const rect = colorRects[index];
      if (rect) {
        rect.setAttribute('mask', `url(#${localMaskId})`);
        rect.setAttribute('opacity', '.9');
      }
    });

    svg.dataset.localBlendApplied = 'true';
  }

  function enhance() {
    document.querySelectorAll('#foodDetailContent .food-tag-blob__svg').forEach(tuneBlob);
  }

  function schedule() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      enhance();
    });
  }

  function init() {
    const root = document.getElementById('foodDetailContent');
    if (!root) return;
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
