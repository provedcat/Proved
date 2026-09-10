(function () {
  "use strict";

  const SUPABASE_URL = "https://qpklvtgnhrdmzxzlstpp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM";
  const PAGE_SIZE = 24;
  const FETCH_PAGE_SIZE = 1000;
  const TAG_CATEGORY_ORDER = [
    "protein_source",
    "life_stage",
    "management_purpose",
    "processing_method",
    "ingredient_condition",
    "preparation_type",
  ];
  const TAG_CATEGORY_LABELS = {
    protein_source: "주 단백질원",
    life_stage: "생애주기",
    management_purpose: "수의사의 진단을 바탕으로 처방되는 기능성 사료",
    processing_method: "제조 방식",
    ingredient_condition: "원재료 조건",
    preparation_type: "급여 형태",
  };
  const TAG_TAB_LABELS = {
    protein_source: "단백질",
    life_stage: "생애",
    management_purpose: "기능",
    processing_method: "제조",
    ingredient_condition: "원재료",
    preparation_type: "급여",
  };
  const foodSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const state = {
    species: "all",
    type: "all",
    role: "all",
    sort: "brand",
    query: "",
    selectedTagIds: [],
    activeTagCategory: "",
    tagSearchQueries: {},
    total: 0,
    rows: [],
    loaded: PAGE_SIZE,
    loading: false,
    requestSerial: 0,
    tags: [],
    tagsLoading: false,
  };
  const listColumns = [
    "id",
    "type",
    "제조사",
    "제품명",
    "완전식여부",
    "메인단백질",
    "final_me",
    "ca_p_ratio",
    "verified",
    "verification_status",
    "searchable_before_review",
    "brand_id",
    "brands(name,official_url)",
  ].join(",");
  // Compatibility contract: 'needs_calorie_review', '쿠팡_링크', 'brand_id'
  const detailColumns = [
    "id",
    "type",
    "제조사",
    "원산지",
    "제품명",
    "완전식여부",
    "메인단백질",
    "전성분",
    "조단백",
    "조지방",
    "조회분",
    "조섬유",
    "수분",
    "칼슘",
    "인",
    "ca_p_ratio",
    "dm_단백",
    "dm_지방",
    "dm_회분",
    "dm_섬유",
    "dm_칼슘",
    "dm_인",
    "겔화제",
    "final_me",
    "cal_unit",
    "cal_source",
    "eb_단백",
    "eb_지방",
    "eb_탄수화물",
    "eb_칼슘",
    "eb_인",
    "verified",
    "verification_status",
    "searchable_before_review",
    "calorie_confidence",
    "calorie_note",
    "needs_calorie_review",
    "쿠팡_링크",
    "brand_id",
    "brands(name,official_url)",
  ].join(",");
  const detailColumnsWithoutCoupang = detailColumns
    .split(",")
    .filter((column) => column !== "쿠팡_링크")
    .join(",");
  const els = {};
  let searchTimer;

  function $(id) {
    return document.getElementById(id);
  }
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function normalizeEnum(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }
  function uniqueIds(value) {
    return [
      ...new Set(
        String(value || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ].slice(0, 20);
  }
  function isPresent(value) {
    return (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(Number(value))
    );
  }
  function formatNumber(value, maxFraction = 2) {
    return isPresent(value)
      ? new Intl.NumberFormat("ko-KR", {
          maximumFractionDigits: maxFraction,
        }).format(Number(value))
      : "—";
  }
  function formatKcal(value) {
    return isPresent(value) ? `${formatNumber(value, 1)} kcal/kg` : "—";
  }
  function formatPercent(value, maxFraction = 2) {
    return isPresent(value) ? `${formatNumber(value, maxFraction)}%` : "—";
  }
  function formatRatio(value) {
    return isPresent(value) && Number(value) > 0
      ? `${formatNumber(value, 2)} : 1`
      : "—";
  }
  function safeHttpUrl(value) {
    const text = String(value || "").trim();
    return /^https?:\/\//i.test(text) ? text : null;
  }
  function getBrand(feed) {
    const relation = Array.isArray(feed?.brands)
      ? feed.brands[0]
      : feed?.brands;
    return {
      name: relation?.name || feed?.제조사 || "브랜드 정보 없음",
      officialUrl: safeHttpUrl(relation?.official_url),
    };
  }
  function splitProductName(name) {
    const text = String(name || "").trim();
    const match = text.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
    return match
      ? { primary: match[1].trim(), secondary: match[2].trim() }
      : { primary: text || "제품명 정보 없음", secondary: "" };
  }
  function getSpeciesLabel(species = state.species) {
    return species === "cat" ? "고양이" : species === "dog" ? "강아지" : "전체";
  }
  function getTypeLabel(type) {
    return type === "wet"
      ? "습식사료"
      : type === "dry"
        ? "건사료"
        : "형태 확인중";
  }
  function getRoleLabel(role) {
    return role || "분류 확인중";
  }
  function isProvisional(feed) {
    return feed?.verified !== true;
  }
  function getFeedSemanticClass(feed) {
    const type = ["dry", "wet"].includes(feed?.type) ? feed.type : "";
    return type && feed.species ? `is-${feed.species}-${type}` : "";
  }
  function normalizeSearch(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("ko-KR");
  }

  function buildSearchPattern(query) {
    return `"*${String(query).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}*"`;
  }

  function buildProductSlug(value) {
    return window.ProvedFoodRoutes.buildProductSlug(value);
  }

  function buildProductPath(feed, species) {
    return window.ProvedFoodRoutes.buildProductPath(feed, species);
  }

  function readDetailRoute() {
    return window.ProvedFoodRoutes.readDetailRoute();
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(location.search);
    state.species = normalizeEnum(params.get("species"), ["cat", "dog"], "all");
    state.type = normalizeEnum(params.get("type"), ["dry", "wet"], "all");
    state.role = normalizeEnum(params.get("role"), ["주식", "보조식"], "all");
    state.sort = normalizeEnum(params.get("sort"), ["product"], "brand");
    state.query = String(params.get("q") || "")
      .trim()
      .slice(0, 120);
    state.selectedTagIds = uniqueIds(params.get("tags"));
  }
  function stateParams() {
    const params = new URLSearchParams();
    if (state.species !== "all") params.set("species", state.species);
    if (state.type !== "all") params.set("type", state.type);
    if (state.role !== "all") params.set("role", state.role);
    if (state.sort !== "brand") params.set("sort", state.sort);
    if (state.query) params.set("q", state.query);
    if (state.selectedTagIds.length)
      params.set("tags", state.selectedTagIds.join(","));
    return params;
  }
  function writeListStateToUrl(replace = true, extraState = {}) {
    if (readDetailRoute()) return;
    const query = stateParams().toString();
    history[replace ? "replaceState" : "pushState"](
      { ...history.state, ...extraState },
      "",
      `${location.pathname}${query ? `?${query}` : ""}`,
    );
  }
  function cacheElements() {
    Object.assign(els, {
      listView: $("foodListView"),
      detailView: $("foodDetailView"),
      searchInput: $("foodSearchInput"),
      searchClear: $("foodSearchClear"),
      speciesFilters: $("foodSpeciesFilters"),
      typeFilters: $("foodTypeFilters"),
      roleFilters: $("foodRoleFilters"),
      sortSelect: $("foodSortSelect"),
      results: $("foodResults"),
      resultsCount: $("foodResultsHeading"),
      listStatus: $("foodListStatus"),
      loadMore: $("foodLoadMore"),
      back: $("foodBackToList"),
      detailContent: $("foodDetailContent"),
      detailStatus: $("foodDetailStatus"),
      conditionFolders: $("foodConditionFolders"),
      selectedConditions: $("foodSelectedConditions"),
      conditionStatus: $("foodConditionStatus"),
      conditionReset: $("foodConditionReset"),
    });
  }
  function syncControls() {
    els.searchInput.value = state.query;
    els.searchClear.hidden = !state.query;
    els.sortSelect.value = state.sort;
    document
      .querySelectorAll("[data-species]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.species === state.species),
        ),
      );
    document
      .querySelectorAll("[data-type]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.type === state.type)),
      );
    document
      .querySelectorAll("[data-role]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.role === state.role)),
      );
    renderConditionFinder();
  }
  function resetAndLoad() {
    state.loaded = PAGE_SIZE;
    writeListStateToUrl(true);
    loadFeeds(true);
  }
  function bindEvents() {
    els.searchInput.addEventListener("input", () => {
      state.query = els.searchInput.value.trim().slice(0, 120);
      els.searchClear.hidden = !state.query;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(resetAndLoad, 280);
    });
    els.searchClear.addEventListener("click", () => {
      clearTimeout(searchTimer);
      state.query = "";
      els.searchInput.value = "";
      els.searchClear.hidden = true;
      resetAndLoad();
      els.searchInput.focus();
    });
    [
      [els.speciesFilters, "species"],
      [els.typeFilters, "type"],
      [els.roleFilters, "role"],
    ].forEach(([root, key]) =>
      root.addEventListener("click", (event) => {
        const b = event.target.closest(`[data-${key}]`);
        if (!b || b.dataset[key] === state[key]) return;
        state[key] = b.dataset[key];
        syncControls();
        resetAndLoad();
      }),
    );
    els.sortSelect.addEventListener("change", () => {
      state.sort = normalizeEnum(els.sortSelect.value, ["product"], "brand");
      resetAndLoad();
    });
    els.conditionFolders.addEventListener("click", (event) => {
      const tab = event.target.closest(".condition-folder__tab[data-category]");
      if (tab) {
        state.activeTagCategory = tab.dataset.category;
        renderConditionFinder();
        return;
      }
      const clear = event.target.closest("[data-condition-search-clear]");
      if (clear) {
        const input = clear
          .closest(".condition-folder__body")
          .querySelector("[data-condition-search]");
        input.value = "";
        state.tagSearchQueries[input.dataset.category] = "";
        renderConditionFinder();
        requestAnimationFrame(() =>
          els.conditionFolders
            .querySelector(
              `[data-condition-search][data-category="${CSS.escape(input.dataset.category)}"]`,
            )
            ?.focus(),
        );
        return;
      }
      const tag = event.target.closest("[data-tag-id]");
      if (tag) toggleTag(tag.dataset.tagId);
    });
    els.conditionFolders.addEventListener("input", (event) => {
      const input = event.target.closest("[data-condition-search]");
      if (!input) return;
      state.tagSearchQueries[input.dataset.category] = input.value;
      filterVisibleTags(input);
    });
    els.selectedConditions.addEventListener("click", (event) => {
      const b = event.target.closest("[data-remove-tag-id]");
      if (b) toggleTag(b.dataset.removeTagId);
    });
    els.conditionReset.addEventListener("click", () => {
      state.selectedTagIds = [];
      renderConditionFinder();
      resetAndLoad();
    });
    els.results.addEventListener("click", (event) => {
      const link = event.target.closest("[data-product-path]");
      if (link) saveFinderReturn(link.dataset.productPath);
    });
    els.loadMore.addEventListener("click", () => {
      state.loaded += PAGE_SIZE;
      loadFeeds(false);
    });
    window.addEventListener("popstate", async (event) => {
      if (readDetailRoute()) return;
      readStateFromUrl();
      syncControls();
      state.loaded = Number(event.state?.foodFinder?.loaded) || PAGE_SIZE;
      await loadFeeds(true);
      restoreScroll(event.state?.foodFinder?.scrollY);
    });
  }
  function compareTags(a, b) {
    return (
      (Number(a.sort_order) || 9999) - (Number(b.sort_order) || 9999) ||
      String(a.label_ko).localeCompare(String(b.label_ko), "ko")
    );
  }
  async function loadConditionTags() {
    state.tagsLoading = true;
    const { data, error } = await foodSb
      .from("food_tags")
      .select("id,label_ko,category,sort_order,is_active")
      .eq("is_active", true)
      .in("category", TAG_CATEGORY_ORDER)
      .order("sort_order", { ascending: true });
    state.tagsLoading = false;
    if (error) {
      els.conditionStatus.textContent = "조건을 불러오지 못했습니다.";
      return;
    }
    state.tags = (data || []).filter(
      (t) => t.id && t.label_ko && TAG_CATEGORY_LABELS[t.category],
    );
    const available = new Set(state.tags.map((t) => String(t.id)));
    state.selectedTagIds = state.selectedTagIds.filter((id) =>
      available.has(id),
    );
    state.activeTagCategory =
      TAG_CATEGORY_ORDER.find((c) =>
        state.tags.some((t) => t.category === c),
      ) || "";
    els.conditionStatus.textContent = "";
    renderConditionFinder();
    writeListStateToUrl(true);
  }
  function renderConditionFinder() {
    if (!els.conditionFolders) return;
    const categories = TAG_CATEGORY_ORDER.filter((c) =>
      state.tags.some((t) => t.category === c),
    );
    if (!categories.length) {
      els.conditionFolders.innerHTML = state.tagsLoading
        ? ""
        : '<p class="food-condition-empty">사용 가능한 조건이 아직 없습니다.</p>';
      return;
    }
    if (!categories.includes(state.activeTagCategory))
      state.activeTagCategory = categories[0];
    els.conditionFolders.innerHTML = categories
      .map((category, index) => {
        const active = category === state.activeTagCategory;
        const tags = state.tags
          .filter((t) => t.category === category)
          .sort(compareTags);
        const q = String(state.tagSearchQueries[category] || "");
        const nq = normalizeSearch(q);
        const visible = tags.filter(
          (t) => !nq || normalizeSearch(t.label_ko).includes(nq),
        ).length;
        const count = state.selectedTagIds.filter((id) =>
          tags.some((t) => String(t.id) === id),
        ).length;
        return `<section class="condition-folder${active ? " is-open" : ""}" style="--tab-index:${index};--layer-z:${active ? 60 : 10 + index}"><button class="condition-folder__tab" type="button" data-category="${category}" aria-expanded="${active}"><span>${TAG_TAB_LABELS[category]}</span>${count ? `<b>${count}</b>` : ""}</button><div class="condition-folder__body" ${active ? "" : "hidden"}><h2>${escapeHtml(TAG_CATEGORY_LABELS[category])}</h2><div class="condition-tag-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg><input type="search" data-condition-search data-category="${category}" value="${escapeHtml(q)}" placeholder="조건 검색" aria-label="${escapeHtml(TAG_CATEGORY_LABELS[category])} 조건 검색" autocomplete="off"><button class="condition-tag-search__clear" type="button" data-condition-search-clear ${q ? "" : "hidden"}>지우기</button></div><div class="condition-tags">${tags
          .map((tag) => {
            const selected = state.selectedTagIds.includes(String(tag.id));
            const hidden = nq && !normalizeSearch(tag.label_ko).includes(nq);
            return `<button type="button" data-tag-id="${escapeHtml(tag.id)}" data-tag-search-text="${escapeHtml(normalizeSearch(tag.label_ko))}" aria-pressed="${selected}" ${hidden ? "hidden" : ""}>${escapeHtml(tag.label_ko)}${selected ? '<span aria-hidden="true">✓</span>' : ""}</button>`;
          })
          .join(
            "",
          )}<p class="condition-tags-empty" ${visible ? "hidden" : ""}>일치하는 조건이 없습니다.</p></div></div></section>`;
      })
      .join("");
    const selected = state.selectedTagIds
      .map((id) => state.tags.find((t) => String(t.id) === id))
      .filter(Boolean);
    els.conditionReset.hidden = !selected.length;
    els.selectedConditions.hidden = !selected.length;
    els.selectedConditions.innerHTML = selected.length
      ? `<p><strong>선택한 조건</strong><span>${selected.length}개 조건의 교집합</span></p><div>${selected.map((t) => `<button type="button" data-remove-tag-id="${escapeHtml(t.id)}">${escapeHtml(t.label_ko)}<span aria-hidden="true">×</span></button>`).join("")}</div>`
      : "";
  }
  function filterVisibleTags(input) {
    const body = input.closest(".condition-folder__body");
    const q = normalizeSearch(input.value);
    let visible = 0;
    body.querySelectorAll("[data-tag-id]").forEach((b) => {
      b.hidden = Boolean(q && !b.dataset.tagSearchText.includes(q));
      if (!b.hidden) visible++;
    });
    body.querySelector(".condition-tags-empty").hidden = visible > 0;
    body.querySelector("[data-condition-search-clear]").hidden = !input.value;
  }
  function toggleTag(id) {
    id = String(id);
    state.selectedTagIds = state.selectedTagIds.includes(id)
      ? state.selectedTagIds.filter((v) => v !== id)
      : [...state.selectedTagIds, id];
    renderConditionFinder();
    resetAndLoad();
  }
  async function resolveFeedIds(species) {
    if (!state.selectedTagIds.length) return null;
    const table = species === "dog" ? "dog_feed_food_tags" : "feed_food_tags";
    const col = species === "dog" ? "dog_feed_id" : "feed_id";
    const rows = [];
    for (let from = 0; ; from += FETCH_PAGE_SIZE) {
      const { data, error } = await foodSb
        .from(table)
        .select(`${col},tag_id`)
        .in("tag_id", state.selectedTagIds)
        .range(from, from + FETCH_PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < FETCH_PAGE_SIZE) break;
    }
    const required = new Set(state.selectedTagIds),
      byFeed = new Map();
    rows.forEach((row) => {
      const fid = String(row[col] || ""),
        tid = String(row.tag_id || "");
      if (!fid || !required.has(tid)) return;
      if (!byFeed.has(fid)) byFeed.set(fid, new Set());
      byFeed.get(fid).add(tid);
    });
    return [...byFeed]
      .filter(([, ids]) => ids.size === required.size)
      .map(([id]) => id);
  }
  async function fetchSpeciesRows(species) {
    const ids = await resolveFeedIds(species);
    if (Array.isArray(ids) && !ids.length) return { rows: [], count: 0 };
    const idChunks = Array.isArray(ids)
      ? Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
          ids.slice(i * 100, i * 100 + 100),
        )
      : [null];
    const responses = await Promise.all(
      idChunks.map(async (chunk) => {
        let query = foodSb
          .from(species === "dog" ? "dog_feeds" : "feeds")
          .select(listColumns, { count: "exact" })
          .or("verified.eq.true,searchable_before_review.eq.true");
        if (state.type !== "all") query = query.eq("type", state.type);
        if (state.role !== "all") query = query.eq("완전식여부", state.role);
        if (state.query) {
          const pattern = buildSearchPattern(state.query);
          query = query.or(`제품명.ilike.${pattern},제조사.ilike.${pattern}`);
        }
        if (chunk) query = query.in("id", chunk);
        query = state.sort === "product"
          ? query.order("제품명", { ascending: true }).order("제조사", { ascending: true })
          : query.order("제조사", { ascending: true }).order("제품명", { ascending: true });
        const { data, error, count } = await query.order("id", { ascending: true }).range(0, state.loaded - 1);
        if (error) throw error;
        return { rows: (data || []).map((row) => ({ ...row, species })), count: Number(count) || 0 };
      }),
    );
    return {
      rows: responses.flatMap((response) => response.rows),
      count: responses.reduce((sum, response) => sum + response.count, 0),
    };
  }
  function sortRows(rows) {
    const key =
      state.sort === "product"
        ? (f) => String(f.제품명 || "")
        : (f) => String(f.제조사 || getBrand(f).name);
    const secondary =
      state.sort === "product"
        ? (f) => String(f.제조사 || getBrand(f).name)
        : (f) => String(f.제품명 || "");
    return rows.sort(
      (a, b) =>
        key(a).localeCompare(key(b), "ko") ||
        secondary(a).localeCompare(secondary(b), "ko") ||
        a.species.localeCompare(b.species) ||
        String(a.id).localeCompare(String(b.id)),
    );
  }
  async function loadFeeds(reset) {
    const serial = ++state.requestSerial;
    state.loading = true;
    els.loadMore.hidden = true;
    if (reset) {
      state.rows = [];
      els.results.innerHTML = Array.from(
        { length: 5 },
        () => '<div class="food-skeleton" aria-hidden="true"></div>',
      ).join("");
      els.resultsCount.textContent = "사료를 불러오는 중입니다.";
    }
    try {
      const species =
        state.species === "all" ? ["cat", "dog"] : [state.species];
      const responses = await Promise.all(species.map(fetchSpeciesRows));
      if (serial !== state.requestSerial) return;
      state.rows = sortRows(responses.flatMap((response) => response.rows)).slice(0, state.loaded);
      state.total = responses.reduce((sum, response) => sum + response.count, 0);
      state.loading = false;
      renderResults();
    } catch (error) {
      if (serial !== state.requestSerial) return;
      state.loading = false;
      els.results.innerHTML = "";
      els.resultsCount.textContent = "사료 찾기";
      els.listStatus.textContent =
        `사료 목록을 불러오지 못했습니다. ${error.message || ""}`.trim();
    }
  }
  function renderResults() {
    const suffix = [
      state.query && `“${state.query}” 검색`,
      state.selectedTagIds.length && `조건 ${state.selectedTagIds.length}개`,
    ]
      .filter(Boolean)
      .join(" · ");
    els.resultsCount.textContent = `${formatNumber(state.total, 0)}개의 ${getSpeciesLabel()} 사료${suffix ? ` · ${suffix}` : ""}`;
    els.listStatus.textContent = "";
    if (!state.rows.length) {
      const actions = [];
      if (state.query)
        actions.push(
          '<button type="button" data-empty-action="query">검색어 지우기</button>',
        );
      if (state.selectedTagIds.length)
        actions.push(
          '<button type="button" data-empty-action="tags">조건 전체 해제</button>',
        );
      if (state.species !== "all")
        actions.push(
          '<button type="button" data-empty-action="species">전체 사료에서도 찾아보기</button>',
        );
      if (state.type !== "all")
        actions.push(
          '<button type="button" data-empty-action="type">전체 형태로 보기</button>',
        );
      els.results.innerHTML = `<div class="food-empty"><strong>조건을 만족하는 사료가 없습니다.</strong><span>${state.selectedTagIds.length ? "선택한 조건을 하나씩 줄여보세요." : "적용한 검색과 필터를 조정해 보세요."}</span><div class="food-empty__actions">${actions.join("")}</div></div>`;
      bindEmptyActions();
      els.loadMore.hidden = true;
      return;
    }
    els.results.innerHTML = state.rows.map(renderResultRow).join("");
    els.loadMore.hidden = state.rows.length >= state.total;
  }
  function bindEmptyActions() {
    els.results.querySelectorAll("[data-empty-action]").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.emptyAction === "query") state.query = "";
        if (b.dataset.emptyAction === "tags") state.selectedTagIds = [];
        if (b.dataset.emptyAction === "species") state.species = "all";
        if (b.dataset.emptyAction === "type") state.type = "all";
        syncControls();
        resetAndLoad();
      }),
    );
  }
  function renderResultRow(feed) {
    const brand = getBrand(feed);
    const product = splitProductName(feed.제품명);
    const semantic = getFeedSemanticClass(feed);
    const productPath = buildProductPath(feed, feed.species);
    const meta = [getTypeLabel(feed.type), getRoleLabel(feed.완전식여부), feed.메인단백질 || "주 단백질 확인중"];
    return `<a class="food-result ${semantic}" href="${escapeHtml(productPath)}" data-product-path="${escapeHtml(productPath)}" aria-label="${escapeHtml(getSpeciesLabel(feed.species))} ${escapeHtml(brand.name)} ${escapeHtml(product.primary)} 상세 보기"><span class="food-result__brand"><span class="food-result__species">${getSpeciesLabel(feed.species)}</span>${escapeHtml(brand.name)}</span><span class="food-result__title-wrap"><span class="food-result__title">${escapeHtml(product.primary)}${isProvisional(feed) ? '<span class="food-review-badge">검수 전</span>' : ""}</span>${product.secondary ? `<span class="food-result__secondary-title">${escapeHtml(product.secondary)}</span>` : ""}<span class="food-result__meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</span></span><span class="food-result__stats"><span class="food-result-stat food-result-stat--energy ${semantic}"><span class="food-result-stat__label">열량</span><span class="food-result-stat__value">${escapeHtml(formatKcal(feed.final_me))}</span></span><span class="food-result-stat"><span class="food-result-stat__label">Ca:P</span><span class="food-result-stat__value">${escapeHtml(formatRatio(feed.ca_p_ratio))}</span></span><svg class="food-result__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg></span></a>`;
  }

  function saveFinderReturn(productPath) {
    const foodFinder = {
      url: `${location.pathname}${location.search}`,
      scrollY: window.scrollY,
      loaded: state.loaded,
      productPath,
      savedAt: Date.now(),
    };
    history.replaceState({ ...history.state, foodFinder }, "", location.href);
    sessionStorage.setItem("provedFoodFinderReturn", JSON.stringify(foodFinder));
  }

  function getFinderReturn(productPath = location.pathname) {
    try {
      const saved = JSON.parse(sessionStorage.getItem("provedFoodFinderReturn") || "null");
      return saved?.productPath === productPath && Date.now() - saved.savedAt < 1800000 ? saved : null;
    } catch (_) {
      return null;
    }
  }

  async function loadDetail(route) {
    if (!route.id && route.idPrefix) {
      const table = route.species === "dog" ? "dog_feeds" : "feeds";
      const lowerBound = `${route.idPrefix}-0000-0000-0000-000000000000`;
      const { data, error } = await foodSb.from(table).select("id").gte("id", lowerBound)
        .order("id", { ascending: true }).limit(1).maybeSingle();
      if (!error && String(data?.id || "").toLowerCase().startsWith(route.idPrefix)) route.id = data.id;
    }
    if (!route.id) {
      els.detailStatus.textContent = "제품 주소를 확인하지 못했습니다.";
      return;
    }
    let { data, error } = await fetchDetail(route.id, detailColumns, route.species);
    if (error && String(error.message || "").includes("쿠팡_링크")) {
      ({ data, error } = await fetchDetail(route.id, detailColumnsWithoutCoupang, route.species));
    }
    if (error || !data) {
      els.detailStatus.textContent = error ? `제품 정보를 불러오지 못했습니다. ${error.message || ""}`.trim() : "제품 정보를 찾지 못했습니다.";
      return;
    }
    data.species = route.species;
    if (route.legacy) {
      location.replace(buildProductPath(data, route.species));
      return;
    }
    els.detailStatus.textContent = "";
    renderDetail(data);
  }

  function fetchDetail(id, columns, species) {
    return foodSb.from(species === "dog" ? "dog_feeds" : "feeds").select(columns).eq("id", id)
      .or("verified.eq.true,searchable_before_review.eq.true").maybeSingle();
  }

  function enhanceProductBackLink() {
    if (!els.back) return;
    const saved = getFinderReturn();
    if (!saved) return;
    els.back.href = saved.url;
    els.back.textContent = "검색 결과로 돌아가기";
  }

  function renderDetail(feed) {
    const brand = getBrand(feed);
    const product = splitProductName(feed.제품명);
    const semanticClass = getFeedSemanticClass(feed);
    const basic = [
      ["대상", getSpeciesLabel(feed.species)],
      ["형태", getTypeLabel(feed.type)],
      ["분류", getRoleLabel(feed.완전식여부)],
      ["주 단백질", feed.메인단백질 || "정보 없음"],
      ["원산지", feed.원산지 || "정보 없음"],
    ];

    const nutritionRows = [
      ["조단백", feed.조단백, feed.dm_단백],
      ["조지방", feed.조지방, feed.dm_지방],
      ["조회분", feed.조회분, feed.dm_회분],
      ["조섬유", feed.조섬유, feed.dm_섬유],
      ["수분", feed.수분, null],
      ["칼슘", feed.칼슘, feed.dm_칼슘],
      ["인", feed.인, feed.dm_인],
    ].filter(([, asFed, dm]) => isPresent(asFed) || isPresent(dm));

    const verificationLabel = feed.verified === true ? "검수 완료" : "검수 전";
    const calorieSourceLabel = getCalorieSourceLabel(feed.cal_source);
    const officialLink = brand.officialUrl
      ? `<a class="food-brand-link" href="${escapeHtml(brand.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(brand.name)} 공식 홈페이지 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"></path><path d="m10 14 9-9"></path><path d="M19 13v6H5V5h6"></path></svg></a>`
      : "";
    const coupangLink = String(feed.쿠팡_링크 ?? "");
    const coupangCta = coupangLink.trim()
      ? `<aside class="food-coupang-cta" aria-label="쿠팡 파트너스 구매 링크">
          <div class="food-coupang-cta__row">
            <span class="food-coupang-cta__label">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a4 4 0 0 0 5.7 0l2.1-2.1a4 4 0 0 0-5.7-5.7l-1.2 1.2"></path><path d="M13.4 10.6a4 4 0 0 0-5.7 0l-2.1 2.1a4 4 0 0 0 5.7 5.7l1.2-1.2"></path></svg>
              <span>파트너스 링크</span>
            </span>
            <a class="food-coupang-cta__button" href="${escapeHtml(coupangLink)}" target="_blank" rel="noopener noreferrer sponsored" aria-label="${escapeHtml(product.primary)} 쿠팡에서 구매하기(새 탭)">
              <span>쿠팡에서 구매하기</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"></path><path d="m10 14 9-9"></path><path d="M19 13v6H5V5h6"></path></svg>
            </a>
          </div>
          <p class="food-coupang-cta__disclosure">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
        </aside>`
      : "";

    document.title = `${product.primary} | 프루브`;

    els.detailContent.innerHTML = `
      <article class="food-detail-article">
        <header class="food-detail-hero">
          <div class="food-detail-hero__brand-row">
            <p class="food-detail-brand">${escapeHtml(brand.name)}${isProvisional(feed) ? '<span class="food-review-badge">검수 전</span>' : ""}</p>
            ${officialLink}
          </div>
          <h1 id="foodDetailTitle">${escapeHtml(product.primary)}</h1>
          ${product.secondary ? `<p class="food-detail-hero__secondary">${escapeHtml(product.secondary)}</p>` : ""}
          <a class="food-compare-link" href="/food/compare/?species=${escapeHtml(feed.species)}&ids=${encodeURIComponent(feed.id)}">
            다른 제품과 비교하기
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>
          </a>
        </header>

        <section class="food-detail-section" aria-labelledby="foodBasicHeading">
          ${sectionHeading("01", "기본 정보", "foodBasicHeading")}
          <dl class="food-basic-grid">
            ${basic.map(([label, value]) => `<div class="food-basic-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
          </dl>
        </section>

        <section class="food-detail-section" aria-labelledby="foodMetricsHeading">
          ${sectionHeading("02", "핵심 수치", "foodMetricsHeading")}
          <div class="food-metric-grid">
            ${metricCard("energy", "열량", formatNumber(feed.final_me, 1), "kcal/kg", energyIcon(), semanticClass)}
            ${metricCard("moisture", "수분", formatNumber(feed.수분, 2), "%", moistureIcon())}
            ${metricCard("protein", "단백질 · DM", formatNumber(feed.dm_단백, 2), "%", proteinIcon())}
            ${metricCard("ratio", "칼슘 : 인", isPresent(feed.ca_p_ratio) ? formatNumber(feed.ca_p_ratio, 2) : "—", isPresent(feed.ca_p_ratio) ? ": 1" : "", ratioIcon())}
          </div>
        </section>

        ${
          nutritionRows.length
            ? `
        <section class="food-detail-section" aria-labelledby="foodNutritionHeading">
          ${sectionHeading("03", "영양 정보", "foodNutritionHeading")}
          <table class="food-nutrition-table">
            <thead><tr><th scope="col">항목</th><th scope="col">등록 값</th><th scope="col">건물 기준 DM</th></tr></thead>
            <tbody>
              ${nutritionRows.map(([label, asFed, dm]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(formatPercent(asFed, label === "칼슘" || label === "인" ? 3 : 2))}</td><td>${dm === null ? "—" : escapeHtml(formatPercent(dm, label === "칼슘" || label === "인" ? 3 : 2))}</td></tr>`).join("")}
            </tbody>
          </table>
          <p class="food-table-note">DM은 수분을 제외한 건물 기준 환산값입니다. 등록 값은 데이터베이스에 저장된 수치를 그대로 표시합니다.</p>
        </section>`
            : ""
        }

        ${
          isPresent(feed.칼슘) ||
          isPresent(feed.인) ||
          isPresent(feed.ca_p_ratio)
            ? `
        <section class="food-detail-section" aria-labelledby="foodMineralHeading">
          ${sectionHeading("04", "칼슘 · 인", "foodMineralHeading")}
          <div class="food-mineral-grid">
            ${mineralCard("Ca · 칼슘", formatPercent(feed.칼슘, 3), isPresent(feed.eb_칼슘) ? `${formatNumber(feed.eb_칼슘, 2)} g / 1,000 kcal` : "열량 기준 정보 없음")}
            ${mineralCard("P · 인", formatPercent(feed.인, 3), isPresent(feed.eb_인) ? `${formatNumber(feed.eb_인, 2)} g / 1,000 kcal` : "열량 기준 정보 없음")}
            ${mineralCard("Ca:P", formatRatio(feed.ca_p_ratio), "칼슘과 인의 등록 수치 비율")}
          </div>
        </section>`
            : ""
        }

        ${
          feed.전성분
            ? `
        <section class="food-detail-section" aria-labelledby="foodIngredientsHeading">
          ${sectionHeading("05", "원재료", "foodIngredientsHeading")}
          <p class="food-ingredients">${escapeHtml(feed.전성분)}</p>
          ${feed.겔화제 ? `<div class="food-additive-row"><strong>겔화제 · 점증제</strong><span>${escapeHtml(feed.겔화제)}</span></div>` : ""}
        </section>`
            : ""
        }

        <section class="food-detail-section" aria-labelledby="foodSourceHeading">
          ${sectionHeading(feed.전성분 ? "06" : "05", "정보 상태", "foodSourceHeading")}
          <dl class="food-source-list">
            <div class="food-source-row"><dt>영양정보</dt><dd class="${feed.verified === true ? "" : "is-review"}">${escapeHtml(verificationLabel)}</dd></div>
            <div class="food-source-row"><dt>열량</dt><dd>${escapeHtml(calorieSourceLabel)}</dd></div>
            ${feed.calorie_note ? `<div class="food-source-row"><dt>열량 메모</dt><dd>${escapeHtml(feed.calorie_note)}</dd></div>` : ""}
          </dl>
        </section>
        ${coupangCta}
      </article>`;
  }

  function sectionHeading(number, title, id) {
    return `<div class="food-section-heading"><span>${number}</span><h2 id="${id}">${escapeHtml(title)}</h2></div>`;
  }

  function metricCard(kind, label, value, unit, icon, modifier = "") {
    return `<div class="food-metric food-metric--${kind} ${modifier}">${icon}<div><span class="food-metric__label">${escapeHtml(label)}</span><span class="food-metric__value">${escapeHtml(value)}</span>${unit ? `<span class="food-metric__unit">${escapeHtml(unit)}</span>` : ""}</div></div>`;
  }

  function mineralCard(label, value, sub) {
    return `<div class="food-mineral-item"><p class="food-mineral-item__label">${escapeHtml(label)}</p><p class="food-mineral-item__value">${escapeHtml(value)}</p><p class="food-mineral-item__sub">${escapeHtml(sub)}</p></div>`;
  }

  function getCalorieSourceLabel(source) {
    const labels = {
      official: "제조사 공식 정보",
      label: "제품 라벨 정보",
      seller: "판매처 정보",
      estimated_corrected: "Proved 추정값 · 습식 보정",
      estimated: "Proved 추정값",
      manual_review: "검토 필요",
    };
    return labels[source] || "출처 확인중";
  }

  function energyIcon() {
    return '<svg class="food-metric__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M26 5 13 27h10l-2 16 14-24H25z"></path></svg>';
  }

  function moistureIcon() {
    return '<svg class="food-metric__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5S11 20 11 30a13 13 0 0 0 26 0C37 20 24 5 24 5Z"></path><path d="M18 31c1 4 4 6 8 6"></path></svg>';
  }

  function proteinIcon() {
    return '<svg class="food-metric__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M10 31c0-10 8-18 18-18 7 0 12 4 12 10 0 10-10 18-21 18-6 0-9-4-9-10Z"></path><path d="M27 22c4-2 8 0 8 4 0 5-5 9-10 9-4 0-6-2-6-5 0-4 4-7 8-8Z"></path></svg>';
  }

  function ratioIcon() {
    return '<svg class="food-metric__icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8v30"></path><path d="M12 15h24"></path><path d="m15 15-6 12h12z"></path><path d="m33 15-6 12h12z"></path><path d="M16 40h16"></path></svg>';
  }

  async function init() {
    cacheElements();
    const detailRoute = readDetailRoute();
    if (detailRoute) {
      enhanceProductBackLink();
      await loadDetail(detailRoute);
      return;
    }
    readStateFromUrl();
    syncControls();
    bindEvents();
    await loadConditionTags();
    await loadFeeds(true);
    const saved = history.state?.foodFinder;
    if (saved?.url === `${location.pathname}${location.search}`) {
      state.loaded = Number(saved.loaded) || PAGE_SIZE;
      if (state.loaded > PAGE_SIZE) await loadFeeds(false);
      restoreScroll(saved.scrollY);
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
