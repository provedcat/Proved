(function (root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProvedFoodSearchFuzzy = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[()\[\]{}\/\\,._·&+\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // An edit of a number can change a product size or formula: never fuzzy-match it.
  function permittedEdits(token) {
    if (token.length < 3 || /\d/.test(token)) return 0;
    return token.length >= 6 ? 2 : 1;
  }

  function boundedDistance(a, b, limit) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let previousPrevious = null;
    for (let i = 1; i <= a.length; i += 1) {
      const next = [i];
      for (let j = 1; j <= b.length; j += 1) {
        const substitution = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
        let cost = Math.min(prev[j] + 1, next[j - 1] + 1, substitution);
        if (previousPrevious && i > 1 && j > 1
          && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          cost = Math.min(cost, previousPrevious[j - 2] + 1);
        }
        next.push(cost);
      }
      previousPrevious = prev;
      prev = next;
    }
    return prev[b.length];
  }

  function scoreCandidate(searchText, tokens) {
    const text = normalize(searchText);
    if (!text) return null;
    const words = text.split(' ').filter(Boolean);
    const compact = words.join('');
    let edits = 0;
    let exact = 0;

    for (const token of tokens) {
      if (text.includes(token) || compact.includes(token)) {
        exact += 1;
        continue;
      }
      // A two-character typo is allowed only with other query tokens as context.
      const limit = token.length === 2 && tokens.length >= 2 && !/\d/.test(token)
        ? 1 : permittedEdits(token);
      if (!limit) return null;
      let best = limit + 1;
      for (const word of words) {
        if (!word || /\d/.test(word) || Math.abs(word.length - token.length) > limit) continue;
        best = Math.min(best, boundedDistance(token, word, limit));
        if (best === 1) break;
      }
      if (best > limit) return null;
      edits += best;
    }
    return { edits, exact };
  }

  function suggestFoods(rows, query, searchTextFor, limit = 3) {
    const tokens = [...new Set(normalize(query).split(' ').filter(Boolean))];
    if (!tokens.length || tokens.join('').length < 3 || !Array.isArray(rows)) return [];
    const ranked = [];
    for (const feed of rows) {
      const score = scoreCandidate(searchTextFor(feed), tokens);
      // Only called when the strict search returns no results; compact spacing matches belong here too.
      if (!score) continue;
      ranked.push({ feed, ...score });
    }
    ranked.sort((a, b) => a.edits - b.edits || b.exact - a.exact);
    return ranked.slice(0, limit).map(item => item.feed);
  }

  return { normalize, permittedEdits, boundedDistance, scoreCandidate, suggestFoods };
});
