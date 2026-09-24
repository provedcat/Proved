/* Calculator diet is committed only by feeding_records saves.
 * External product links are a one-time working selection, never a saved diet. */
(function () {
  'use strict';

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const params = new URLSearchParams(window.location.search);
  const requestedSpecies = typeof provedGetRequestedSpecies === 'function'
    ? provedGetRequestedSpecies() : 'cat';
  const externalType = params.get('type');
  const externalId = params.get('feed');
  let pendingExternal = UUID.test(externalId || '') && ['wet', 'dry'].includes(externalType)
    ? { id: externalId, type: externalType, species: requestedSpecies || 'cat' } : null;
  let lastAppliedPet = '';
  let latestSaved = null;
  let sequence = 0;

  function normalizeSavedEntries(result) {
    if (!result || typeof result !== 'object') return [];
    const dry = Array.isArray(result.건사료_결과) ? result.건사료_결과.slice(0, 2) : [];
    const wet = Array.isArray(result.습식사료_결과) ? result.습식사료_결과.slice(0, 3) : [];
    return dry.map(item => ({ type: 'dry', id: item.사료_id || null, name: item.이름 || '', pct: Number(item.비율) }))
      .concat(wet.map(item => ({ type: 'wet', id: item.사료_id || null, name: item.이름 || '', pct: Number(item.비율) })))
      .filter(entry => Boolean(entry.id || entry.name));
  }

  function savedDietPolicy(savedExists, explicitExternal) {
    return explicitExternal ? 'external-preview' : savedExists ? 'saved-diet' : 'draft';
  }

  function ensureStatus() {
    const page = document.getElementById('calculatorPage');
    if (!page) return null;
    let notice = document.getElementById('calculatorDietNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'calculatorDietNotice';
      notice.className = 'pc-diet-notice';
      notice.setAttribute('role', 'status');
      notice.innerHTML = '<p id="calculatorDietMessage"></p>' +
        '<button id="calculatorRestoreSavedDiet" type="button" hidden>저장된 식단으로 돌아가기</button>';
      page.insertBefore(notice, page.firstChild);
      document.getElementById('calculatorRestoreSavedDiet').addEventListener('click', () => {
        restoreCachedSavedDiet().catch(error => console.warn('Saved diet restore failed:', error));
      });
    }
    return notice;
  }

  function message(text, showRestore) {
    const notice = ensureStatus();
    if (!notice) return;
    notice.querySelector('#calculatorDietMessage').textContent = text;
    notice.querySelector('#calculatorRestoreSavedDiet').hidden = !showRestore;
    notice.hidden = !text;
  }

  function clearSelectedFeeds() {
    if (typeof resetWetSlotsToDefault === 'function') resetWetSlotsToDefault();
    state.dryFeeds = [null, null];
    state.wetFeedMap = {};
    ['dryInput1', 'dryInput2'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
    ['drySelected1', 'drySelected2'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = '';
        element.classList.add('hidden');
      }
    });
    state.wetSlotIds.forEach(id => {
      const input = document.getElementById('wetInput_' + id);
      const selected = document.getElementById('wetSelected_' + id);
      if (input) input.value = '';
      if (selected) {
        selected.textContent = '';
        selected.classList.add('hidden');
      }
    });
    const switching = document.getElementById('drySwitching');
    if (switching) switching.checked = false;
    if (typeof toggleDrySwitching === 'function') toggleDrySwitching();
    state.lastResult = null;
    state.lastSavedResultKey = null;
    state.isCalculationDirty = false;
    document.getElementById('resultArea')?.classList.add('hidden');
    if (typeof updateResultActionState === 'function') updateResultActionState();
  }

  async function getFeedById(species, type, id) {
    const table = species === 'dog' ? 'dog_feeds' : 'feeds';
    const result = await sb.from(table).select(getFeedSearchColumns())
      .eq('id', id).eq('type', type)
      .or('verified.eq.true,searchable_before_review.eq.true')
      .gt('final_me', 0).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function resolveSavedFeed(species, entry) {
    if (entry.id && UUID.test(String(entry.id))) {
      return getFeedById(species, entry.type, entry.id);
    }
    // Old records have names but no product UUID. Never guess if names collide.
    const table = species === 'dog' ? 'dog_feeds' : 'feeds';
    const response = await sb.from(table).select(getFeedSearchColumns())
      .eq('type', entry.type).eq('제품명', entry.name)
      .or('verified.eq.true,searchable_before_review.eq.true')
      .gt('final_me', 0).limit(2);
    if (response.error) throw response.error;
    return response.data?.length === 1 ? response.data[0] : null;
  }

  function selectAllResolved(entries, result) {
    clearSelectedFeeds();
    const dry = entries.filter(item => item.type === 'dry');
    const wet = entries.filter(item => item.type === 'wet');
    if (dry.length > 1) {
      document.getElementById('drySwitching').checked = true;
      toggleDrySwitching();
    }
    dry.forEach((entry, index) => selectFeed('dry', index, entry.feed, 'dryList' + (index + 1)));
    while (state.wetSlotIds.length < wet.length && typeof addWetSlot === 'function') addWetSlot();
    wet.forEach((entry, index) => {
      const id = state.wetSlotIds[index];
      if (id != null) selectFeed('wet', id, entry.feed, 'wetList_' + id);
    });

    const slider = document.getElementById('ratioSlider');
    const savedDry = Number(result.dryRatio);
    const dryShare = Number.isFinite(savedDry) ? Math.max(0, Math.min(100, Math.round(savedDry * 100)))
      : Math.max(0, Math.min(100, dry.reduce((sum, entry) => sum + (entry.pct || 0), 0)));
    if (slider) slider.value = String(dryShare);

    if (dry.length > 1) {
      const total = dry.reduce((sum, item) => sum + (item.pct || 0), 0);
      dry.forEach((entry, index) => {
        const input = document.getElementById('drySwPct' + (index + 1));
        if (input) input.value = String(total > 0 ? Math.round(entry.pct / total * 100) : (index === 0 ? 50 : 50));
      });
    }
    if (wet.length > 1) {
      const total = wet.reduce((sum, item) => sum + (item.pct || 0), 0);
      wet.slice(1).forEach((entry, index) => {
        const input = document.getElementById('wetPct_' + state.wetSlotIds[index + 1]);
        if (input) input.value = String(total > 0 ? Math.round(entry.pct / total * 100) : 0);
      });
    }
    if (typeof updateRatio === 'function') updateRatio(String(dryShare));
    if (typeof saveCalculatorDraft === 'function') saveCalculatorDraft();
  }

  async function applySavedDiet(record, species, currentSequence) {
    const entries = normalizeSavedEntries(record.result_data);
    if (!entries.length) return false;
    const resolved = await Promise.all(entries.map(async entry => ({
      ...entry, feed: await resolveSavedFeed(species, entry)
    })));
    if (currentSequence !== sequence) return false;
    if (resolved.some(entry => !entry.feed)) {
      message('저장 기록에 제품을 정확히 식별할 수 없는 항목이 있습니다. 사료를 직접 선택해 주세요.', false);
      return false;
    }
    selectAllResolved(resolved, record.result_data);
    return true;
  }

  async function restoreCachedSavedDiet() {
    if (!latestSaved) return;
    const serial = ++sequence;
    const applied = await applySavedDiet(latestSaved.record, latestSaved.species, serial);
    if (applied) {
      message('최근 저장한 식단을 다시 불러왔습니다.', false);
    }
  }

  function clearExternalQuery() {
    const url = new URL(window.location.href);
    url.searchParams.delete('feed');
    url.searchParams.delete('type');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }

  async function applyExternal(species, serial) {
    const external = pendingExternal;
    if (!external || external.species !== species) return;
    let feed;
    try {
      feed = await getFeedById(species, external.type, external.id);
    } catch (error) {
      console.warn('Linked food could not be loaded:', error);
      message('연결된 사료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', Boolean(latestSaved));
      return;
    }
    if (serial !== sequence) return;
    if (!feed) {
      message('해당 사료의 열량 또는 제품 정보를 확인할 수 없어 자동 선택하지 못했습니다.', Boolean(latestSaved));
      return;
    }

    if (external.type === 'dry') {
      if (state.dryFeeds[1]?.id === feed.id) {
        state.dryFeeds[1] = null;
        const selected = document.getElementById('drySelected2');
        if (selected) selected.classList.add('hidden');
      }
      selectFeed('dry', 0, feed, 'dryList1');
    } else {
      state.wetSlotIds.slice(1).forEach(id => {
        if (state.wetFeedMap[id]?.id === feed.id && typeof removeWetSlot === 'function') removeWetSlot(id);
      });
      if (!state.wetSlotIds.length) addWetSlot();
      selectFeed('wet', state.wetSlotIds[0], feed, 'wetList_' + state.wetSlotIds[0]);
    }

    // A saved 100%-opposite-type diet should not hide the linked candidate at 0%.
    const slider = document.getElementById('ratioSlider');
    if (slider) {
      const dryPct = Number(slider.value);
      if (external.type === 'dry' && dryPct === 0) slider.value = '100';
      if (external.type === 'wet' && dryPct === 100) slider.value = '0';
      if (typeof updateRatio === 'function') updateRatio(slider.value);
    }

    pendingExternal = null;
    clearExternalQuery();
    if (typeof provedHideEntry === 'function') provedHideEntry();
    if (typeof showPage === 'function') showPage('calculatorPage');
    message('사료를 임시 선택했습니다. 계산 후 결과를 저장하기 전까지 기존 식단은 변경되지 않습니다.', Boolean(latestSaved));
    if (typeof saveCalculatorDraft === 'function') saveCalculatorDraft();
    document.getElementById('step2Title')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function applyOnPetSelection(pet) {
    if (typeof state === 'undefined' || !state.authInitialized) return;
    const species = pet?.species === 'dog' ? 'dog' : 'cat';
    if (requestedSpecies && species !== requestedSpecies) return;
    const userId = state.currentUser?.id || '';
    const petId = userId && pet?.id ? String(pet.id) : '';
    const key = userId + ':' + petId + ':' + species;

    if (lastAppliedPet === key && !pendingExternal) return;
    const serial = ++sequence;
    lastAppliedPet = key;
    latestSaved = null;
    try {
      if (petId) {
        const response = await sb.from('feeding_records').select('result_data,created_at')
          .eq('user_id', userId).eq('pet_id', petId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (serial !== sequence) return;
        if (response.error) throw response.error;
        if (response.data?.result_data) {
          latestSaved = { species, record: response.data };
          const applied = await applySavedDiet(response.data, species, serial);
          if (serial !== sequence) return;
          if (applied && !pendingExternal) message('최근 저장한 식단을 불러왔습니다.', false);
        }
      }
      if (pendingExternal) await applyExternal(species, serial);
    } catch (error) {
      console.warn('Saved feeding plan could not be loaded:', error);
      message('저장된 식단을 불러오지 못했습니다. 기존 기록은 유지됩니다.', false);
    }
  }

  function afterSave({ userId, petId, result } = {}) {
    if (!userId || !petId || !result) return;
    if (String(state.currentUser?.id) !== String(userId)) return;
    latestSaved = { species: state.selectedPetSpecies || 'cat', record: { result_data: result } };
    lastAppliedPet = userId + ':' + petId + ':' + latestSaved.species;
    message('방금 계산한 결과를 최신 식단으로 저장했습니다.', false);
    if (typeof saveCalculatorDraft === 'function') saveCalculatorDraft();
  }

  window.provedRestoreSavedDietAndHandoff = applyOnPetSelection;
  window.provedOnFeedingPlanSaved = afterSave;

  if (pendingExternal) {
    // The signed-in destination resolver activates its pet asynchronously.
    // For signed-out visitors, ensure the initial species selection can receive the handoff.
    sb.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION' || session?.user) return;
      window.setTimeout(() => {
        if (!pendingExternal || !state.authInitialized) return;
        const active = state.activePet && state.activePet.species === pendingExternal.species
          ? state.activePet : { species: pendingExternal.species };
        if (typeof setActivePet === 'function') setActivePet(active, { route: 'calculator' });
      }, 0);
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalizeSavedEntries, savedDietPolicy };
  }
})();
