(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJxcGtsdnRnbmhyZG16eHp6bHN0cHAiLCJyZWYiOiJxcGtsdnRnbmhyZG16eHp6bHN0cHAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3NTk2MTUyMiwiZXhwIjoyMDkxNTM3NTIyfQ.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const EXCLUDED_CATEGORIES = new Set(['product_class', 'food_form', 'protein_source']);
  const CATEGORY_ORDER = [
    'life_stage',
    'management_purpose',
    'processing_method',
    'ingredient_condition',
    'preparation_type'
  ];

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let requestSerial = 0;
  let rafId = 0;
  let loadingKey = '';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getContext() {
    const params = new URLSearchParams(window.location.search);
    const feedId = params.get('id');
    const species = params.get('species') === 'dog' ? 'dog' : 'cat';
    return { feedId, species };
  }

  function ensureSixthCell() {
    const grid = document.querySelector('#foodDetailContent .food-detail-profile-grid .food-basic-grid');
    if (!grid) return null;

    const originItem = Array.from(grid.querySelectorAll('.food-basic-item')).find(item =>
      item.querySelector('dt')?.textContent.trim() === '원산지'
    );
    const originValue = originItem?.querySelector('dd');
    if (originValue && (!originValue.textContent.trim() || originValue.textContent.trim() === '—')) {
      originValue.textContent = '확인되지 않음';
    }

    let item = grid.querySelector('.food-basic-item--extra');
    if (!item) {
      item = document.createElement('div');
      item.className = 'food-basic-item food-basic-item--extra';
      item.innerHTML = '<dt>부가 특성</dt><dd class="food-basic-extra-tags" aria-live="polite">—</dd>';
      grid.appendChild(item);
    }
    return item.querySelector('.food-basic-extra-tags');
  }

  function fitBlobBounds() {
    const svg = document.querySelector('#foodDetailContent .food-tag-blob__svg');
    if (!svg || svg.dataset.boundsFitted === 'true') return;

    svg.setAttribute('viewBox', '-50 0 720 760');
    svg.querySelectorAll('rect[width="620"]').forEach(rect => {
      rect.setAttribute('x', '-50');
      rect.setAttribute('width', '720');
    });
    svg.dataset.boundsFitted = 'true';
  }

  function compareTags(a, b) {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    const categoryA = ai === -1 ? 999 : ai;
    const categoryB = bi === -1 ? 999 : bi;
    if (categoryA !== categoryB) return categoryA - categoryB;

    const aOrder = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 9999;
    const bOrder = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 9999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.label_ko || '').localeCompare(String(b.label_ko || ''), 'ko');
  }

  async function loadExtraTags(feedId, species) {
    const mappingTable = species === 'dog' ? 'dog_feed_food_tags' : 'feed_food_tags';
    const idColumn = species === 'dog' ? 'dog_feed_id' : 'feed_id';

    const { data: mappings, error: mappingError } = await sb
      .from(mappingTable)
      .select('tag_id')
      .eq(idColumn, feedId);

    if (mappingError || !Array.isArray(mappings) || !mappings.length) return [];

    const ids = [...new Set(mappings.map(row => row.tag_id).filter(Boolean))];
    if (!ids.length) return [];

    const { data: tags, error: tagError } = await sb
      .from('food_tags')
      .select('id,label_ko,category,sort_order,is_active')
      .in('id', ids)
      .eq('is_active', true);

    if (tagError || !Array.isArray(tags)) return [];

    const seen = new Set();
    return tags
      .filter(tag => tag.label_ko && !EXCLUDED_CATEGORIES.has(tag.category))
      .sort(compareTags)
      .filter(tag => {
        const key = String(tag.label_ko).trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function renderExtraTags(target, tags) {
    if (!target) return;
    if (!tags.length) {
      target.textContent = '—';
      return;
    }

    target.innerHTML = tags
      .map(tag => `<span class="food-basic-extra-tag">${escapeHtml(tag.label_ko)}</span>`)
      .join('');
  }

  async function enhance() {
    fitBlobBounds();

    const target = ensureSixthCell();
    const { feedId, species } = getContext();
    const key = feedId ? `${species}:${feedId}` : '';
    if (!target || !key || target.dataset.loadedFor === key || loadingKey === key) return;

    loadingKey = key;
    const serial = ++requestSerial;
    target.textContent = '불러오는 중…';

    try {
      const tags = await loadExtraTags(feedId, species);
      if (serial !== requestSerial || !target.isConnected) return;
      renderExtraTags(target, tags);
      target.dataset.loadedFor = key;
    } catch (error) {
      if (serial !== requestSerial || !target.isConnected) return;
      target.textContent = '—';
      target.dataset.loadedFor = key;
      console.warn('[Proved] supplemental food tags:', error);
    } finally {
      if (loadingKey === key) loadingKey = '';
    }
  }

  function scheduleEnhance() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      enhance();
    });
  }

  function init() {
    const target = document.getElementById('foodDetailContent');
    if (!target) return;
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(target, { childList: true, subtree: true });
    scheduleEnhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
