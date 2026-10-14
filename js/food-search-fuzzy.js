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

  // Ignore packaging capacity only; preserve product model codes (e.g. 001, 12+).
  function normalizeQuery(value) {
    return normalize(value)
      .replace(/(^|\s)\d+(?:[.,]\d+)?\s*(?:kg|g|ml|oz|그램|그람|킬로그램|밀리리터|리터)(?=\s|$)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(value) {
    return [...new Set(normalizeQuery(value).split(' ').filter(Boolean))];
  }

  // "베이비무스" matches text containing both "베이비" and "무스",
  // even if those parts are separated by other words in a real product name.
  function isCompoundMatch(text, token) {
    if (token.length < 4 || token.length > 30 || /\d/.test(token)) return false;
    function partsMatch(offset, count) {
      if (offset === token.length) return count >= 2;
      if (count >= 3) return false;
      for (let end = offset + 2; end <= token.length; end += 1) {
        const part = token.slice(offset, end);
        const rest = token.length - end;
        if (rest > 0 && rest < 2) continue;
        if (text.includes(part) && partsMatch(end, count + 1)) return true;
      }
      return false;
    }
    return partsMatch(0, 0);
  }

  function tokenMatches(text, compact, token) {
    return text.includes(token) || compact.includes(token) || isCompoundMatch(text, token);
  }

  function matchesText(searchText, query) {
    const tokens = tokenize(query);
    if (!tokens.length) return false;
    const text = normalize(searchText);
    const compact = text.replace(/\s+/g, '');
    return tokens.every(token => tokenMatches(text, compact, token));
  }

  // An edit of a number can change a product model: never fuzzy-match it.
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
      if (tokenMatches(text, compact, token)) {
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
    const tokens = tokenize(query);
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

  return { normalize, normalizeQuery, tokenize, isCompoundMatch, matchesText, permittedEdits, boundedDistance, scoreCandidate, suggestFoods };
});
