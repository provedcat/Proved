/* MY PET weight/optional BCS helpers, shared by the profile and trend views. */
(function (root, factory) {
  const api = factory();
  if (root) root.ProvedWeightRecords = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function normalizeBcs(value) {
    if (value === null || value === undefined || value === '') return null;
    const score = Number(value);
    return Number.isInteger(score) && score >= 1 && score <= 9 ? score : null;
  }

  function suggestedBcs(records) {
    const recent = (records || [])
      .filter(row => normalizeBcs(row.bcs_score) !== null)
      .sort((a, b) => String(b.recorded_date).localeCompare(String(a.recorded_date)));
    return recent.length ? normalizeBcs(recent[0].bcs_score) : 5;
  }

  function normalizeWeightRecords(rows) {
    return (rows || []).map(row => ({
      recorded_date: row.recorded_date,
      weight_kg: Number(row.weight_kg),
      bcs_score: normalizeBcs(row.bcs_score)
    })).filter(row =>
      /^\d{4}-\d{2}-\d{2}$/.test(String(row.recorded_date || '')) &&
      Number.isFinite(row.weight_kg) && row.weight_kg > 0
    ).sort((a, b) => a.recorded_date.localeCompare(b.recorded_date));
  }

  function tooltipBcs(record) {
    const score = normalizeBcs(record && record.bcs_score);
    return score === null ? null : 'BCS : ' + score + '/9';
  }

  function recalculationUrl(pet) {
    const path = pet && pet.species === 'dog' ? '/dog-food-calculator/' : '/cat-food-calculator/';
    return path + '?pet_id=' + encodeURIComponent(pet.id);
  }

  return { normalizeBcs, suggestedBcs, normalizeWeightRecords, tooltipBcs, recalculationUrl };
});
