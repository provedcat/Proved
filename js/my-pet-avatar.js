(function () {
  'use strict';
  const URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const sb = window.supabase.createClient(URL, KEY), avatar = window.ProvedAvatar;
  const $ = id => document.getElementById(id);
  const tabs = { shape: '형태', color: '색상', pattern: '패턴', eye: '눈', blush: '볼', nose: '코', background: '배경' };
  const sections = {
    shape: [['shape', '얼굴 형태']], color: [['color', '털 색상']],
    pattern: [['patternCentral','포인트'], ['patternEar','귀 얼룩'], ['patternOuter','얼굴 패턴']],
    eye: [['eyeColor','눈 색상'], ['eyePattern','눈 패턴']],
    blush: [['blush','볼터치']], nose: [['nose','코']], background: [['background','배경지']]
  };
  let pet, user, settings, active = 'shape', revision = 0, saving = false;
  function options(key) {
    if (avatar.groups[key]) return avatar.groups[key];
    const keys = Object.keys(avatar.catalog[key]);
    return (key === 'blush' || key === 'eyePattern') ? [null, ...keys] : keys;
  }
  function thumb(key, value) {
    if (!value) return '';
    if (key === 'background') return avatar.catalog.background[value].src;
    if (['eyeColor','eyePattern','blush','nose'].includes(key)) return '/images/pet-avatar/thumbs/' + avatar.catalog[key][value].file + '.webp?v=20260929-final';
    if (key === 'shape') return avatar.catalog.shape[value].mask;
    return avatar.catalog[key][value].src;
  }
  function renderControls() {
    $('avatarTabs').replaceChildren();
    Object.entries(tabs).forEach(([key, label]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label; button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(active === key));
      button.addEventListener('click', () => { active = key; renderControls(); });
      $('avatarTabs').appendChild(button);
    });
    const panel = $('avatarOptions'); panel.replaceChildren();
    for (const [key, title] of sections[active]) {
      const group = document.createElement('section'), heading = document.createElement('h3'), grid = document.createElement('div');
      heading.textContent = title; grid.className = 'my-avatar-options';
      if (avatar.groups[key]) grid.classList.add('my-avatar-pattern-options');
      if (['color','blush','nose','background'].includes(key)) grid.classList.add('my-avatar-' + key + '-options');
      group.append(heading, grid);
      for (const value of options(key)) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'my-avatar-option';
        button.setAttribute('aria-pressed', String(settings[key] === value));
        const name = value ? avatar.catalog[key][value].name : '없음';
        const image = thumb(key, value);
        if (image) {
          const img = document.createElement('img'); img.src = image; img.alt = ''; img.loading = 'lazy';
          if (key === 'blush') {
            const crop = document.createElement('span'); crop.className = 'my-avatar-blush-crop'; crop.appendChild(img); button.appendChild(crop);
          } else button.appendChild(img);
        }
        else { const mark = document.createElement('span'); mark.className = 'my-avatar-none'; mark.textContent = '—'; button.appendChild(mark); }
        const label = document.createElement('span'); label.textContent = name; button.appendChild(label);
        button.addEventListener('click', () => { settings[key] = avatar.groups[key] && settings[key] === value ? null : value; renderControls(); draw(); });
        grid.appendChild(button);
      }
      panel.appendChild(group);
    }
  }
  async function draw() {
    const current = ++revision;
    try {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
      await avatar.render(canvas, settings, pet.species);
      if (current === revision) {
        const preview = $('avatarPreview'), context = preview.getContext('2d');
        context.clearRect(0, 0, preview.width, preview.height);
        context.drawImage(canvas, 0, 0);
        const image = $('avatarPreviewImage');
        if (image) image.src = canvas.toDataURL('image/png');
      }
      $('avatarStatus').textContent = '';
    } catch (error) { console.error(error); $('avatarStatus').textContent = '이미지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'; }
  }
  function webp(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob && blob.type === 'image/webp'
      ? resolve(blob) : reject(new Error('WebP 이미지를 만들 수 없습니다.')), 'image/webp', .88));
  }
  async function save() {
    if (saving) return;
    saving = true; $('avatarSave').disabled = true; $('avatarStatus').textContent = '저장하고 있습니다…';
    let path;
    try {
      // Render the saved settings afresh so a pending preview render cannot be uploaded.
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
      const selected = avatar.normalize(settings, pet.species);
      await avatar.render(canvas, selected, pet.species);
      const blob = await webp(canvas);
      path = user.id + '/' + pet.id + '/' + crypto.randomUUID() + '.webp';
      const upload = await sb.storage.from('pet-avatars').upload(path, blob, { contentType: 'image/webp', upsert: false });
      if (upload.error) throw upload.error;
      const updated = await sb.from('pets').update({ avatar_settings: selected, avatar_image_url: path })
        .eq('id', pet.id).eq('user_id', user.id).select('id').single();
      if (updated.error || !updated.data) throw updated.error || new Error('펫 정보가 변경되지 않았습니다.');
      const old = pet.avatar_image_url; pet.avatar_image_url = path; settings = selected;
      if (old && old !== path) {
        const removed = await sb.storage.from('pet-avatars').remove([old]);
        if (removed.error) console.warn('Old avatar cleanup failed', removed.error);
      }
      $('avatarStatus').textContent = '저장했습니다.';
      window.location.assign('/my/pet/?id=' + encodeURIComponent(pet.id));
    } catch (error) {
      console.error('Avatar save failed:', error);
      if (path) await sb.storage.from('pet-avatars').remove([path]);
      $('avatarStatus').textContent = '저장하지 못했습니다. 다시 시도해 주세요.';
      saving = false; $('avatarSave').disabled = false;
    }
  }
  async function init() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { $('avatarGate').hidden = false; return; }
    const auth = await sb.auth.getUser(); user = auth.data && auth.data.user;
    if (!user) { $('avatarGate').hidden = false; return; }
    if (typeof window.provedSetHeaderAuthState === 'function') window.provedSetHeaderAuthState(true);
    const result = await sb.from('pets').select('id,user_id,name,species,avatar_settings,avatar_image_url')
      .eq('id', id).eq('user_id', user.id).maybeSingle();
    if (result.error || !result.data) { $('avatarGate').hidden = false; return; }
    pet = result.data; settings = avatar.normalize(pet.avatar_settings, pet.species);
    $('avatarContent').hidden = false;
    $('avatarPetName').textContent = pet.name || '반려동물';
    $('avatarPetMeta').textContent = (pet.name || '반려동물') + ' · ' + (pet.species === 'dog' ? '강아지' : '고양이');
    $('avatarBackLink').href = '/my/pet/?id=' + encodeURIComponent(pet.id);
    $('avatarSave').addEventListener('click', save);
    renderControls(); draw();
  }
  window.addEventListener('DOMContentLoaded', init);
})();
