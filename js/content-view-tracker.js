/* PROVED content view analytics: editorial and product pages only. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  var AUTH_KEY = 'sb-qpklvtgnhrdmzxzlstpp-auth-token';
  var VISITOR_KEY = 'proved_content_visitor_v1';
  var LAST_CONTENT_KEY = 'proved_last_content_view_v1';
  var IGNORE_KEY = 'proved_analytics_ignore';
  var timer = 0;
  var submissionQueue = Promise.resolve();
  var lastAttempt = '';
  var lastAttemptAt = 0;

  // An explicit opt-out lets the site operator exclude visits on browsers
  // that are not logged into an administrator account.
  try {
    var params = new URLSearchParams(location.search);
    if (params.get('proved_ignore_views') === '1') {
      localStorage.setItem(IGNORE_KEY, '1');
    }
    if (params.get('proved_ignore_views') === '0') {
      localStorage.removeItem(IGNORE_KEY);
    }
    if (localStorage.getItem(IGNORE_KEY) === '1') return;
  } catch (_) {}

  function validUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ''));
  }

  function visitorId() {
    try {
      var saved = localStorage.getItem(VISITOR_KEY);
      if (validUuid(saved)) return saved;
      var next = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, next);
      return next;
    } catch (_) {
      try {
        var temporary = sessionStorage.getItem(VISITOR_KEY);
        if (validUuid(temporary)) return temporary;
        var ephemeral = crypto.randomUUID();
        sessionStorage.setItem(VISITOR_KEY, ephemeral);
        return ephemeral;
      } catch (e) {
        return null;
      }
    }
  }

  function getPageInfo() {
    var path = location.pathname;
    var editorial = path.match(/^\/editorial\/([a-z0-9][a-z0-9-]{0,90})\/?$/i);
    if (editorial) {
      var h1 = document.querySelector('main h1');
      return {
        type: 'editorial',
        id: editorial[1].toLowerCase(),
        key: 'editorial:' + editorial[1].toLowerCase(),
        title: (h1 && h1.textContent.trim()) || document.title
      };
    }

    var product = path.match(/^\/food\/(cat|dog)\/[^/]+\/?$/);
    var params = new URLSearchParams(location.search);
    var legacy = path === '/food/' && params.has('id');
    if (!product && !legacy) return null;
    var species = product ? product[1] : (params.get('species') === 'dog' ? 'dog' : 'cat');
    var pageConfig = window.__PROVED_FOOD_PAGE__;
    var historyInfo = history.state || {};
    var id = null;

    if (historyInfo.view === 'detail' && historyInfo.species === species && historyInfo.feedId) {
      id = historyInfo.feedId;
    } else if (pageConfig && pageConfig.species === species && pageConfig.id &&
        (pageConfig.path || '').replace(/\/$/, '') === path.replace(/\/$/, '')) {
      id = pageConfig.id;
    } else if (legacy) {
      id = params.get('id');
    } else {
      var detailContent = document.getElementById('foodDetailContent');
      if (detailContent && detailContent.dataset.prerenderedFeedId) id = detailContent.dataset.prerenderedFeedId;
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) return null;

    var titleEl = document.getElementById('foodDetailTitle');
    var pageTitle = titleEl && titleEl.textContent.trim();
    if (!pageTitle) pageTitle = document.title.replace(/\s*\|.*$/, '');
    return {
      type: 'product',
      id: species + ':' + String(id).toLowerCase(),
      key: 'product:' + species + ':' + String(id).toLowerCase(),
      title: pageTitle
    };
  }

  // If a logged-in session is present, send it for authoritative admin
  // exclusion in Postgres. Never silently fall back to anon for an
  // expired or unreadable signed-in session.
  function authorization() {
    try {
      var stored = localStorage.getItem(AUTH_KEY);
      if (!stored) return SUPABASE_ANON_KEY;
      var session = JSON.parse(stored);
      if (!session || !session.access_token) return null;
      if (session.expires_at && session.expires_at <= Date.now() / 1000 + 20) return null;
      return session.access_token;
    } catch (_) {
      return null;
    }
  }

  function previousContent() {
    try {
      return sessionStorage.getItem(LAST_CONTENT_KEY);
    } catch (_) {
      return null;
    }
  }

  function setPreviousContent(key) {
    try {
      sessionStorage.setItem(LAST_CONTENT_KEY, key);
    } catch (_) {}
  }

  async function record(page) {
    if (!page) return;
    if (document.visibilityState === 'hidden') return;

    var attempt = page.key;
    if (attempt === lastAttempt && Date.now() - lastAttemptAt < 1800) return;
    lastAttempt = attempt;
    lastAttemptAt = Date.now();

    var vid = visitorId();
    var token = authorization();
    if (!vid || !token) return;

    try {
      var response = await fetch(SUPABASE_URL + '/rest/v1/rpc/record_content_view', {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          p_visitor_id: vid,
          p_content_type: page.type,
          p_content_id: page.id,
          p_content_title: String(page.title).slice(0, 180),
          p_previous_content_key: previousContent()
        })
      });
      if (!response.ok) return;
      var counted = await response.json();
      // Keep the navigation chain in browsing order even when a repeat
      // view is excluded by the 24-hour server deduplication.
      if (counted === true || counted === false) setPreviousContent(page.key);
    } catch (_) {
      // Analytics must never interrupt normal reading.
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var page = getPageInfo();
      if (!page) return;
      // Serialize RPC requests so rapid A -> B -> C navigation cannot be
      // recorded in the wrong order when network timings differ.
      submissionQueue = submissionQueue.then(function () {
        return record(page);
      }).catch(function () {});
    }, 550);
  }

  // Product pages use client-side pushState, so navigation between products
  // must be observed without adding scripts to every generated HTML file.
  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    if (typeof original !== 'function') return;
    history[method] = function () {
      var result = original.apply(this, arguments);
      schedule();
      return result;
    };
  });
  addEventListener('popstate', schedule);
  addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') schedule();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();
