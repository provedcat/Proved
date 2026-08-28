(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let rafId = 0;

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function parseRotation(transform) {
    const match = String(transform || '').match(/rotate\(\s*(-?\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  function darkenHex(hex, amount = 0.34) {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return '#46516A';
    const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
    return `#${channels.map(channel => Math.round(channel * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
  }

  function setTextPosition(text, x, y) {
    if (!text) return;
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y));
    text.querySelectorAll('tspan').forEach(tspan => tspan.setAttribute('x', String(x)));
  }

  function mutateFingerprintGeometry(sourceLobes, gradients, labels) {
    const count = sourceLobes.length;
    const productId = new URLSearchParams(window.location.search).get('id') || '';
    const labelKey = labels.map(text => text.textContent.trim()).join('|');
    const random = mulberry32(hashString(`${productId}|${labelKey}|${count}`));

    sourceLobes.forEach((lobe, index) => {
      const isCenter = count >= 5 && index === 0;
      const cx = Number(lobe.getAttribute('cx')) || 310;
      const cy = Number(lobe.getAttribute('cy')) || 380;
      const rx = Number(lobe.getAttribute('rx')) || 145;
      const ry = Number(lobe.getAttribute('ry')) || 112;
      const area = rx * ry;
      const choices = isCenter
        ? [1.02, 1.08, 1.16, 1.24]
        : [1.01, 1.08, 1.18, 1.30, 1.43, 1.56];
      let ratio = choices[Math.floor(random() * choices.length)];
      if (!isCenter && random() < 0.23) ratio = 1 / ratio;

      const areaScale = isCenter ? 1.04 + random() * 0.06 : 1 + random() * 0.12;
      const nextRx = clamp(Math.sqrt(area * areaScale * ratio), 104, 194);
      const nextRy = clamp(Math.sqrt(area * areaScale / ratio), 100, 184);
      const jitterX = isCenter ? (random() - 0.5) * 12 : (random() - 0.5) * 28;
      const jitterY = isCenter ? (random() - 0.5) * 10 : (random() - 0.5) * 24;
      const nextCx = clamp(cx + jitterX, 92, 528);
      const nextCy = clamp(cy + jitterY, 112, 632);
      const nextRotation = clamp(parseRotation(lobe.getAttribute('transform')) + (random() - 0.5) * 28, -21, 21);

      lobe.setAttribute('cx', nextCx.toFixed(2));
      lobe.setAttribute('cy', nextCy.toFixed(2));
      lobe.setAttribute('rx', nextRx.toFixed(2));
      lobe.setAttribute('ry', nextRy.toFixed(2));
      lobe.setAttribute('transform', `rotate(${nextRotation.toFixed(2)} ${nextCx.toFixed(2)} ${nextCy.toFixed(2)})`);

      const text = labels[index];
      if (text) {
        const oldX = Number(text.getAttribute('x')) || cx;
        const oldY = Number(text.getAttribute('y')) || cy;
        const nextLabelX = oldX + jitterX;
        const nextLabelY = oldY + jitterY;
        setTextPosition(text, nextLabelX.toFixed(2), nextLabelY.toFixed(2));
        const gradient = gradients[index];
        if (gradient) {
          gradient.setAttribute('cx', nextLabelX.toFixed(2));
          gradient.setAttribute('cy', nextLabelY.toFixed(2));
        }
      }
    });
  }

  function applyLabelTreatment(defs, gradients, labels) {
    labels.forEach((text, index) => {
      const color = gradients[index]?.querySelector('stop')?.getAttribute('stop-color') || '#6F7F9A';
      const shadowColor = darkenHex(color, 0.34);
      const filterId = `provedBlobTextShadow-${index}-${hashString(`${color}|${index}`).toString(36)}`;
      let filter = defs.querySelector(`#${CSS.escape(filterId)}`);
      if (!filter) {
        filter = document.createElementNS(NS, 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('x', '-22%');
        filter.setAttribute('y', '-24%');
        filter.setAttribute('width', '144%');
        filter.setAttribute('height', '150%');
        filter.innerHTML = `<feDropShadow dx="0" dy="1.2" stdDeviation="2.2" flood-color="${shadowColor}" flood-opacity=".30" />`;
        defs.appendChild(filter);
      }
      text.style.setProperty('fill', '#FFFFFF', 'important');
      text.style.setProperty('font-size', '40px', 'important');
      text.style.setProperty('font-weight', '850', 'important');
      text.style.setProperty('filter', `url(#${filterId})`);
    });
  }

  function tuneBlob(svg) {
    if (!svg || svg.dataset.localBlendV2Applied === 'true') return;
    const defs = svg.querySelector('defs');
    if (!defs) return;
    const gradients = Array.from(defs.querySelectorAll('radialGradient[id*="Gradient"]'));
    if (!gradients.length) return;
    const mask = defs.querySelector('mask[id$="Mask"]');
    const sourceLobes = mask ? Array.from(mask.querySelectorAll('g ellipse')).slice(0, gradients.length) : [];
    const labels = Array.from(svg.querySelectorAll('.food-tag-blob__labels text')).slice(0, gradients.length);
    const paintGroup = svg.querySelector('g[mask]');
    const paintRects = paintGroup ? Array.from(paintGroup.querySelectorAll(':scope > rect')) : [];
    if (!paintGroup || sourceLobes.length !== gradients.length || paintRects.length < gradients.length + 1) return;

    mutateFingerprintGeometry(sourceLobes, gradients, labels);

    const baseRect = paintRects[0];
    const colorRects = paintRects.slice(1, gradients.length + 1);
    baseRect.setAttribute('opacity', '.055');

    let blur = defs.querySelector('#provedBlobLocalFieldBlurV2');
    if (!blur) {
      blur = document.createElementNS(NS, 'filter');
      blur.setAttribute('id', 'provedBlobLocalFieldBlurV2');
      blur.setAttribute('x', '-20%');
      blur.setAttribute('y', '-20%');
      blur.setAttribute('width', '140%');
      blur.setAttribute('height', '140%');
      blur.innerHTML = '<feGaussianBlur stdDeviation="9" />';
      defs.appendChild(blur);
    }

    gradients.forEach((gradient, index) => {
      const lobe = sourceLobes[index];
      const rx = Number(lobe.getAttribute('rx')) || 0;
      const ry = Number(lobe.getAttribute('ry')) || 0;
      gradient.setAttribute('r', String(Math.max(rx, ry) * 1.18));
      const stops = Array.from(gradient.querySelectorAll('stop'));
      const spec = [['0%', '1'], ['45%', '.98'], ['73%', '.70'], ['91%', '.14'], ['100%', '0']];
      stops.forEach((stop, stopIndex) => {
        if (!spec[stopIndex]) return;
        stop.setAttribute('offset', spec[stopIndex][0]);
        stop.setAttribute('stop-opacity', spec[stopIndex][1]);
      });

      const localMaskId = `provedBlobLocalMaskV2-${index}-${hashString(`${index}|${lobe.getAttribute('cx')}|${lobe.getAttribute('cy')}`).toString(36)}`;
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
      localEllipse.setAttribute('rx', String(rx * 1.055));
      localEllipse.setAttribute('ry', String(ry * 1.055));
      localEllipse.setAttribute('fill', '#fff');
      localEllipse.setAttribute('filter', 'url(#provedBlobLocalFieldBlurV2)');
      const transform = lobe.getAttribute('transform');
      if (transform) localEllipse.setAttribute('transform', transform);
      localMask.appendChild(localEllipse);
      defs.appendChild(localMask);
      const rect = colorRects[index];
      if (rect) {
        rect.setAttribute('mask', `url(#${localMaskId})`);
        rect.setAttribute('opacity', '.92');
      }
    });

    applyLabelTreatment(defs, gradients, labels);
    svg.dataset.localBlendV2Applied = 'true';
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
