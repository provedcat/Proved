(function () {
  'use strict';
  const avatar = window.ProvedAvatar;
  const $ = id => document.getElementById(id);
  const tabs = { shape: '형태', color: '색상', pattern: '패턴', eye: '눈', blush: '볼', nose: '코' };
  const sections = {
    shape: [['shape', '얼굴 형태']],
    color: [['color', '털 색상']],
    pattern: [['patternCentral', '포인트'], ['patternEar', '귀 얼룩'], ['patternOuter', '얼굴 패턴']],
    eye: [['eyeColor', '눈 색상'], ['eyePattern', '눈 패턴']],
    blush: [['blush', '볼터치']],
    nose: [['nose', '코']]
  };
  let species = 'cat';
  let settings = avatar.defaults(species);
  let active = 'shape';
  let revision = 0;

  function options(key) {
    if (avatar.groups[key]) return avatar.groups[key];
    const keys = Object.keys(avatar.catalog[key]);
    return (key === 'blush' || key === 'eyePattern') ? [null, ...keys] : keys;
  }

  function thumb(key, value) {
    if (!value) return '';
    if (['eyeColor', 'eyePattern', 'blush', 'nose'].includes(key)) {
      return '/images/pet-avatar/thumbs/' + avatar.catalog[key][value].file + '.webp?v=20260929-final';
    }
    if (key === 'shape') return avatar.catalog.shape[value].mask;
    return avatar.catalog[key][value].src;
  }

  function updateMeta() {
    const name = $('promoPetName').value.trim() || '반려동물';
    $('promoPetNamePreview').textContent = name;
    $('promoPetMeta').textContent = (species === 'dog' ? '강아지' : '고양이') + ' · 로그인 없이 체험 중';
  }

  function renderControls() {
    $('promoAvatarTabs').replaceChildren();
    Object.entries(tabs).forEach(([key, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(active === key));
      button.addEventListener('click', () => {
        active = key;
        renderControls();
      });
      $('promoAvatarTabs').appendChild(button);
    });

    const panel = $('promoAvatarOptions');
    panel.replaceChildren();
    for (const [key, title] of sections[active]) {
      const group = document.createElement('section');
      const heading = document.createElement('h3');
      const grid = document.createElement('div');
      heading.textContent = title;
      grid.className = 'my-avatar-options';
      if (avatar.groups[key]) grid.classList.add('my-avatar-pattern-options');
      if (['color', 'blush', 'nose'].includes(key)) grid.classList.add('my-avatar-' + key + '-options');
      group.append(heading, grid);

      for (const value of options(key)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'my-avatar-option';
        button.setAttribute('aria-pressed', String(settings[key] === value));
        const name = value ? avatar.catalog[key][value].name : '없음';
        const image = thumb(key, value);

        if (image) {
          const img = document.createElement('img');
          img.src = image;
          img.alt = '';
          img.loading = 'lazy';
          if (key === 'blush') {
            const crop = document.createElement('span');
            crop.className = 'my-avatar-blush-crop';
            crop.appendChild(img);
            button.appendChild(crop);
          } else {
            button.appendChild(img);
          }
        } else {
          const mark = document.createElement('span');
          mark.className = 'my-avatar-none';
          mark.textContent = '—';
          button.appendChild(mark);
        }

        const label = document.createElement('span');
        label.textContent = name;
        button.appendChild(label);
        button.addEventListener('click', () => {
          settings[key] = avatar.groups[key] && settings[key] === value ? null : value;
          renderControls();
          draw();
        });
        grid.appendChild(button);
      }
      panel.appendChild(group);
    }
  }

  async function draw() {
    const current = ++revision;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      await avatar.render(canvas, settings, species);
      if (current !== revision) return;
      const preview = $('promoAvatarPreview');
      const context = preview.getContext('2d');
      context.clearRect(0, 0, preview.width, preview.height);
      context.drawImage(canvas, 0, 0);
      $('promoStatus').textContent = '';
    } catch (error) {
      console.error(error);
      $('promoStatus').textContent = '이미지를 불러오지 못했습니다. 다시 시도해 주세요.';
    }
  }

  function setSpecies(next) {
    if (next === species) return;
    species = next;
    settings = avatar.defaults(species);
    document.querySelectorAll('[data-promo-species]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.promoSpecies === species));
    });
    updateMeta();
    renderControls();
    draw();
  }

  async function download() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      await avatar.render(canvas, settings, species);
      const name = $('promoPetName').value.trim() || 'my-pet';
      const safe = name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
      const link = document.createElement('a');
      link.download = 'proved-' + safe + '-my-pet.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      $('promoStatus').textContent = '이미지를 저장했습니다.';
    } catch (error) {
      console.error(error);
      $('promoStatus').textContent = '이미지를 저장하지 못했습니다.';
    }
  }

  function init() {
    $('promoPetName').addEventListener('input', updateMeta);
    document.querySelectorAll('[data-promo-species]').forEach(button => {
      button.addEventListener('click', () => setSpecies(button.dataset.promoSpecies));
    });
    $('promoDownload').addEventListener('click', download);
    updateMeta();
    renderControls();
    draw();
  }

  window.addEventListener('DOMContentLoaded', init);
})();