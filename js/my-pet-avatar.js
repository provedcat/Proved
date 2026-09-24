(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  function $(id) { return document.getElementById(id); }

  function speciesLabel(species) {
    return species === 'dog' ? '강아지' : '고양이';
  }

  function petIcon(species) {
    if (species === 'dog') {
      return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20 19c-5-8-12-6-12 2 0 6 4 11 9 13"/><path d="M44 19c5-8 12-6 12 2 0 6-4 11-9 13"/>' +
        '<path d="M18 28c0-10 6-17 14-17s14 7 14 17v9c0 10-6 17-14 17S18 47 18 37z"/>' +
        '<circle cx="26" cy="31" r="1.5" fill="currentColor" stroke="none"/><circle cx="38" cy="31" r="1.5" fill="currentColor" stroke="none"/>' +
        '<path d="M29 39c2-2 4-2 6 0-1 3-5 3-6 0z"/><path d="M32 42v3"/></svg>';
    }
    return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 24 15 9l13 9M46 24 49 9 36 18"/><path d="M17 28c0-10 6-17 15-17s15 7 15 17v10c0 10-6 17-15 17S17 48 17 38z"/>' +
      '<circle cx="26" cy="31" r="1.5" fill="currentColor" stroke="none"/><circle cx="38" cy="31" r="1.5" fill="currentColor" stroke="none"/>' +
      '<path d="M29 39c2-2 4-2 6 0-1 3-5 3-6 0z"/><path d="M32 42v3M22 41l-10 1M22 45l-9 4M42 41l10 1M42 45l9 4"/></svg>';
  }

  async function init() {
    const petId = new URLSearchParams(window.location.search).get('id');
    if (!petId) {
      $('avatarGate').hidden = false;
      return;
    }

    const userResult = await sb.auth.getUser();
    const user = userResult.data && userResult.data.user;
    if (!user) {
      $('avatarGate').hidden = false;
      return;
    }

    if (typeof window.provedSetHeaderAuthState === 'function') {
      window.provedSetHeaderAuthState(true);
    }

    const response = await sb.from('pets')
      .select('id,name,species')
      .eq('user_id', user.id)
      .eq('id', petId)
      .limit(1);

    if (response.error || !response.data || !response.data[0]) {
      $('avatarGate').hidden = false;
      return;
    }

    const pet = response.data[0];
    $('avatarContent').hidden = false;
    $('avatarPetName').textContent = pet.name || '반려동물';
    $('avatarPetMeta').textContent = (pet.name || '반려동물') + ' · ' + speciesLabel(pet.species);
    $('avatarPreview').innerHTML = petIcon(pet.species);
    $('avatarBackLink').href = '/my/pet/?id=' + encodeURIComponent(pet.id);
    document.title = (pet.name || '반려동물') + ' 아바타 만들기 | 프루브';
  }

  window.addEventListener('DOMContentLoaded', init);
})();
