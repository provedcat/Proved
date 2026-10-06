(() => {
  const root = document.getElementById('foodBrandFinder');
  if (!root) return;

  const rangeButtons = [...root.querySelectorAll('[data-brand-range-toggle]')];
  const panels = [...root.querySelectorAll('[data-brand-range-panel]')];

  function hideBrandGroups(panel) {
    panel.querySelectorAll('[data-brand-group]').forEach(group => { group.hidden = true; });
    panel.querySelectorAll('[data-brand-initial]').forEach(button => {
      button.setAttribute('aria-pressed', 'false');
    });
  }

  function closeRange(range) {
    const button = root.querySelector(`[data-brand-range-toggle="${range}"]`);
    const panel = root.querySelector(`[data-brand-range-panel="${range}"]`);
    if (!button || !panel) return;
    button.setAttribute('aria-expanded', 'false');
    button.classList.remove('is-open');
    panel.hidden = true;
    hideBrandGroups(panel);
  }

  function openRange(range) {
    rangeButtons.forEach(button => {
      const other = button.dataset.brandRangeToggle;
      if (other !== range) closeRange(other);
    });
    const button = root.querySelector(`[data-brand-range-toggle="${range}"]`);
    const panel = root.querySelector(`[data-brand-range-panel="${range}"]`);
    if (!button || !panel) return;
    button.setAttribute('aria-expanded', 'true');
    button.classList.add('is-open');
    panel.hidden = false;
  }

  rangeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const range = button.dataset.brandRangeToggle;
      if (!range) return;
      const open = button.getAttribute('aria-expanded') === 'true';
      if (open) closeRange(range);
      else openRange(range);
    });
  });

  panels.forEach(panel => {
    panel.addEventListener('click', event => {
      const button = event.target.closest('[data-brand-initial]');
      if (!button || button.disabled) return;
      const initial = button.dataset.brandInitial;
      const range = button.dataset.brandInitialRange;
      if (!initial || !range) return;

      panel.querySelectorAll('[data-brand-initial]').forEach(item => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      panel.querySelectorAll('[data-brand-group]').forEach(group => {
        group.hidden = !(group.dataset.brandGroup === initial && group.dataset.brandGroupRange === range);
      });
    });
  });

  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    rangeButtons.forEach(button => {
      const range = button.dataset.brandRangeToggle;
      if (range) closeRange(range);
    });
  });
})();