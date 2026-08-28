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

  function darkenHex(hex, amount = 0.30) {
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

  function getFamily(seed) {
    /* Round is the primary visual language. Ellipse remains only as a subtle variation. */
    return (seed % 10 < 8) ? 'round' : 'soft-ellipse';
  }

  function getWeightedCenter(lobes) {
    const sum = lobes.reduce((acc, lobe) => {
      const rx = Number(lobe.getAttribute('rx')) || 1;
      const ry = Number(lobe.getAttribute('ry')) || 1;
      const weight = Math.sqrt(rx * ry);
      acc.x += (Number(lobe.getAttribute('cx')) || 310) * weight;
      acc.y += (Number(lobe.getAttribute('cy')) || 380) * weight;
      acc.w += weight;
      return acc;
    }, { x: 0, y: 0, w: 0 });
    return { x: sum.x / sum.w, y: sum.y / sum.w };
  }

  function mutateOrganicGeometry(sourceLobes, gradients, labels) {
    const count = sourceLobes.length;
    const productId = new URLSearchParams(window.location.search).get('id') || '';
    const labelKey = labels.map(text => text.textContent.trim()).join('|');
    const seed = hashString(`${productId}|${labelKey}|${count}|organic-v4-round`);
    const random = mulberry32(seed);
    const family = getFamily(seed);
    const center = getWeightedCenter(sourceLobes);

    sourceLobes.forEach((lobe, index) => {
      const isCenter = count >= 5 && index === 0;
      const cx = Number(lobe.getAttribute('cx')) || 310;
      const cy = Number(lobe.getAttribute('cy')) || 380;
      const rx = Number(lobe.getAttribute('rx')) || 145;
      const ry = Number(lobe.getAttribute('ry')) || 112;
      const baseArea = rx * ry;

      const sizeScale = isCenter
        ? 1.08 + random() * 0.05
        : 0.98 + random() * 0.14;

      let aspect;
      if (family === 'round') {
        aspect = 0.96 + random() * 0.08;
      } else {
        aspect = 1.03 + random() * 0.10;
        if (random() < 0.5) aspect = 1 / aspect;
      }

      const nextRx = clamp(Math.sqrt(baseArea * sizeScale * aspect), 114, 188);
      const nextRy = clamp(Math.sqrt(baseArea * sizeScale / aspect), 112, 184);

      /* Keep the lobes close enough to read as one unified organic mass. */
      const pull = isCenter ? 0.02 : 0.24 + random() * 0.04;
      const jitterX = isCenter ? (random() - 0.5) * 5 : (random() - 0.5) * 10;
      const jitterY = isCenter ? (random() - 0.5) * 5 : (random() - 0.5) * 10;
      const nextCx = clamp(cx + (center.x - cx) * pull + jitterX, 110, 510);
      const nextCy = clamp(cy + (center.y - cy) * pull + jitterY, 120, 620);

      const baseRotation = parseRotation(lobe.getAttribute('transform'));
      const rotationSpread = family === 'round' ? 5 : 10;
      const nextRotation = family === 'round'
        ? clamp(baseRotation * 0.12 + (random() - 0.5) * rotationSpread, -5, 5)
        : clamp(baseRotation * 0.25 + (random() - 0.5) * rotationSpread, -9, 9);

      lobe.setAttribute('cx', nextCx.toFixed(2));
      lobe.setAttribute('cy', nextCy.toFixed(2));
      lobe.setAttribute('rx', nextRx.toFixed(2));
      lobe.setAttribute('ry', nextRy.toFixed(2));
      lobe.setAttribute('transform', `rotate(${nextRotation.toFixed(2)} ${nextCx.toFixed(2)} ${nextCy.toFixed(2)})`);

      const text = labels[index];
      if (text) {
        const originalX = Number(text.getAttribute('x')) || cx;
        const originalY = Number(text.getAttribute('y')) || cy;
        const labelPull = isCenter ? 0 : pull * 0.76;
        const nextLabelX = originalX + (center.x - originalX) * labelPull + jitterX * 0.35;
        const nextLabelY = originalY + (center.y - originalY) * labelPull + jitterY * 0.35;
        setTextPosition(text, nextLabelX.toFixed(2), nextLabelY.toFixed(2));
        const gradient = gradients[index];
        if (gradient) {
          gradient.setAttribute('cx', nextLabelX.toFixed(2));
          gradient.setAttribute('cy', nextLabelY.toFixed(2));
        }
      }
    });

    return family;
  }

  function applyLabelTreatment(defs, gradients, labels) {
    labels.forEach((text, index) => {
      const color = gradients[index]?.querySelector('stop')?.getAttribute('stop-color') || '#6F7F9A';
      const shadowColor = darkenHex(color, 0.30);
      const filterId = `provedBlobTextOrganic-${index}-${hashString(`${color}|${index}`).toString(36)}`;
      let filter = defs.querySelector(`#${CSS.escape(filterId)}`);
      if (!filter) {
        filter = document.createElementNS(NS, 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('x', '-18%');
        filter.setAttribute('y', '-18%');
        filter.setAttribute('width', '136%');
        filter.setAttribute('height', '140%');
        filter.innerHTML = `<feDropShadow dx="0" dy="0.8" stdDeviation="1.45" flood-color="${shadowColor}" flood-opacity=".22" />`;
        defs.appendChild(filter);
      }
      text.style.setProperty('fill', '#FFFFFF', 'important');
      text.style.setProperty('font-size', '36px', 'important');
      text.style.setProperty('font-weight', '830', 'important');
      text.style.setProperty('filter', `url(#${filterId})`);
    });
  }

  function tuneBlob(svg) {
    if (!svg || svg.dataset.organicV4Applied === 'true') return;
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

    const family = mutateOrganicGeometry(sourceLobes, gradients, labels);
    svg.dataset.blobFamily = family;

    const baseRect = paintRects[0];
    const colorRects = paintRects.slice(1, gradients.length + 1);
    baseRect.setAttribute('opacity', '.10');

    let blur = defs.querySelector('#provedBlobOrganicFieldBlurV4');
    if (!blur) {
      blur = document.createElementNS(NS, 'filter');
      blur.setAttribute('id', 'provedBlobOrganicFieldBlurV4');
      blur.setAttribute('x', '-28%');
      blur.setAttribute('y', '-28%');
      blur.setAttribute('width', '156%');
      blur.setAttribute('height', '156%');
      blur.innerHTML = '<feGaussianBlur stdDeviation="14" />';
      defs.appendChild(blur);
    }

    gradients.forEach((gradient, index) => {
      const lobe = sourceLobes[index];
      const rx = Number(lobe.getAttribute('rx')) || 0;
      const ry = Number(lobe.getAttribute('ry')) || 0;
      gradient.setAttribute('r', String(Math.max(rx, ry) * 1.30));

      const stops = Array.from(gradient.querySelectorAll('stop'));
      const spec = [
        ['0%', '1'],
        ['40%', '.97'],
        ['70%', '.78'],
        ['89%', '.28'],
        ['100%', '0']
      ];
      stops.forEach((stop, stopIndex) => {
        if (!spec[stopIndex]) return;
        stop.setAttribute('offset', spec[stopIndex][0]);
        stop.setAttribute('stop-opacity', spec[stopIndex][1]);
      });

      const localMaskId = `provedBlobOrganicMaskV4-${index}-${hashString(`${index}|${lobe.getAttribute('cx')}|${lobe.getAttribute('cy')}`).toString(36)}`;
      const localMask = document.createElementNS(NS, 'mask');
      localMask.setAttribute('id', localMaskId);
      localMask.setAttribute('maskUnits', 'userSpaceOnUse');
      localMask.setAttribute('x', '-70');
      localMask.setAttribute('y', '-50');
      localMask.setAttribute('width', '780');
      localMask.setAttribute('height', '860');

      const localEllipse = document.createElementNS(NS, 'ellipse');
      localEllipse.setAttribute('cx', lobe.getAttribute('cx'));
      localEllipse.setAttribute('cy', lobe.getAttribute('cy'));
      localEllipse.setAttribute('rx', String(rx * 1.12));
      localEllipse.setAttribute('ry', String(ry * 1.12));
      localEllipse.setAttribute('fill', '#fff');
      localEllipse.setAttribute('filter', 'url(#provedBlobOrganicFieldBlurV4)');
      const transform = lobe.getAttribute('transform');
      if (transform) localEllipse.setAttribute('transform', transform);
      localMask.appendChild(localEllipse);
      defs.appendChild(localMask);

      const rect = colorRects[index];
      if (rect) {
        rect.setAttribute('mask', `url(#${localMaskId})`);
        rect.setAttribute('opacity', '.91');
      }
    });

    applyLabelTreatment(defs, gradients, labels);
    svg.dataset.organicV4Applied = 'true';
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
