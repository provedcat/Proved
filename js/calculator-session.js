const PROVED_CALCULATOR_SESSION_KEY = 'proved.calculatorDraft.v1';

const calculatorDraftFieldSelectors = [
  '#catName', '#catBirth', '#catWeight', '#catNeutered',
  '#isDiet', '#bcsValue', '#isPregnant', '#isLactating', '#dogExpectedAdultWeight',
  '#drySwitching', '#drySwPct1', '#drySwPct2', '#ratioSlider', '#treatKcalInput',
  'input[name="dogActivity"]', 'input[name="treatReservePct"]'
];

function readCalculatorDraftFields() {
  const fields = {};
  document.querySelectorAll(calculatorDraftFieldSelectors.join(',')).forEach(element => {
    const key = element.id || `${element.name}:${element.value}`;
    fields[key] = element.type === 'checkbox' || element.type === 'radio'
      ? element.checked
      : element.value;
  });
  return fields;
}

function saveCalculatorDraft() {
  if (typeof state === 'undefined') return;

  const firstWetSlotId = Array.isArray(state.wetSlotIds) ? state.wetSlotIds[0] : null;
  const wetFeeds = firstWetSlotId == null
    ? []
    : [{
        slotId: firstWetSlotId,
        feed: state.wetFeedMap[firstWetSlotId] || null,
        input: document.getElementById(`wetInput_${firstWetSlotId}`)?.value || '',
        ratio: ''
      }];

  const draft = {
    version: 1,
    species: state.selectedPetSpecies || 'cat',
    fields: readCalculatorDraftFields(),
    dryFeeds: state.dryFeeds,
    wetFeeds,
    scrollY: window.scrollY,
    savedAt: Date.now()
  };

  try {
    sessionStorage.setItem(PROVED_CALCULATOR_SESSION_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('Calculator draft could not be saved.', error);
  }
}

function restoreFieldValue(key, value) {
  const element = key.includes(':')
    ? document.querySelector(`input[name="${key.split(':')[0]}"][value="${CSS.escape(key.split(':').slice(1).join(':'))}"]`)
    : document.getElementById(key);
  if (!element) return;
  if (element.type === 'checkbox' || element.type === 'radio') element.checked = Boolean(value);
  else element.value = value ?? '';
}

function renderRestoredFeed(type, slotId, feed) {
  if (!feed) return;
  const selectedId = type === 'dry' ? `drySelected${slotId + 1}` : `wetSelected_${slotId}`;
  const selected = document.getElementById(selectedId);
  if (!selected) return;
  selected.textContent = `✓ ${feed.name} (${feed.kcal} kcal/kg)${feed.provisional ? ' · 검수 전' : ''}`;
  selected.classList.toggle('pc-selected-feed--provisional', Boolean(feed.provisional));
  selected.classList.remove('hidden');
}

function getWetSlotIdFromElement(slot) {
  const match = String(slot?.id || '').match(/^wetSlot_(\d+)$/);
  return match ? Number(match[1]) : null;
}

function resetWetSlotsToDefault() {
  if (typeof state === 'undefined') return;

  const container = document.getElementById('wetSlots');
  if (!container) return;

  const domSlots = [...container.querySelectorAll('.pc-wet-slot')];
  const firstSlot = domSlots[0] || null;
  const firstSlotId = getWetSlotIdFromElement(firstSlot);

  domSlots.slice(1).forEach(slot => {
    const slotId = getWetSlotIdFromElement(slot);
    slot.remove();
    if (slotId != null) delete state.wetFeedMap[slotId];
  });

  if (firstSlotId == null) {
    container.replaceChildren();
    state.wetSlotIds = [];
    state.wetFeedMap = {};
    if (typeof addWetSlot === 'function') addWetSlot();
  } else {
    Object.keys(state.wetFeedMap || {}).forEach(key => {
      if (Number(key) !== firstSlotId) delete state.wetFeedMap[key];
    });
    state.wetSlotIds = [firstSlotId];
    state.wetSlotIdCounter = Math.max(Number(state.wetSlotIdCounter) || 0, firstSlotId + 1);
  }

  document.getElementById('addWetBtn')?.classList.remove('hidden');
}

function restoreCalculatorDraft() {
  resetWetSlotsToDefault();

  let draft;
  try {
    draft = JSON.parse(sessionStorage.getItem(PROVED_CALCULATOR_SESSION_KEY) || 'null');
  } catch (_) {
    return;
  }
  if (!draft || draft.version !== 1 || typeof state === 'undefined') return;

  Object.entries(draft.fields || {}).forEach(([key, value]) => restoreFieldValue(key, value));
  if (Array.isArray(draft.dryFeeds)) {
    state.dryFeeds = draft.dryFeeds;
    draft.dryFeeds.forEach((feed, slotId) => {
      if (!feed) return;
      const input = document.getElementById(`dryInput${slotId + 1}`);
      if (input) input.value = feed.display || feed.name || '';
      renderRestoredFeed('dry', slotId, feed);
    });
  }

  const firstWetFeed = Array.isArray(draft.wetFeeds) ? draft.wetFeeds[0] : null;
  const firstWetSlotId = state.wetSlotIds[0];
  if (firstWetFeed && firstWetSlotId != null) {
    state.wetFeedMap[firstWetSlotId] = firstWetFeed.feed || null;
    const input = document.getElementById(`wetInput_${firstWetSlotId}`);
    if (input) input.value = firstWetFeed.input || firstWetFeed.feed?.display || firstWetFeed.feed?.name || '';
    renderRestoredFeed('wet', firstWetSlotId, firstWetFeed.feed);
  }

  toggleDrySwitching();
  updateRatio(document.getElementById('ratioSlider')?.value || 60);
  initializeCalculatorChoices();
  saveCalculatorDraft();

  if (Number.isFinite(draft.scrollY)) {
    requestAnimationFrame(() => window.scrollTo({ top: draft.scrollY, behavior: 'auto' }));
  }
}

let preferredRegistrationType = 'dry';

function getPreferredRegistrationType() {
  return preferredRegistrationType;
}

document.addEventListener('DOMContentLoaded', () => {
  resetWetSlotsToDefault();
  restoreCalculatorDraft();

  requestAnimationFrame(() => {
    resetWetSlotsToDefault();
    saveCalculatorDraft();
  });

  document.getElementById('calculatorPage')?.addEventListener('input', saveCalculatorDraft);
  document.getElementById('calculatorPage')?.addEventListener('change', saveCalculatorDraft);
  document.getElementById('calculatorPage')?.addEventListener('focusin', event => {
    const id = event.target?.id || '';
    if (id.startsWith('wet')) preferredRegistrationType = 'wet';
    if (id.startsWith('dry')) preferredRegistrationType = 'dry';
  });
  document.querySelectorAll('[data-feed-registration-link]').forEach(link => {
    link.addEventListener('click', () => {
      saveCalculatorDraft();
      const species = state.selectedPetSpecies === 'dog' ? 'dog' : 'cat';
      const type = getPreferredRegistrationType();
      link.href = `/feed-registration/?species=${species}&type=${type}`;
    });
  });
  window.addEventListener('pagehide', saveCalculatorDraft);
});
