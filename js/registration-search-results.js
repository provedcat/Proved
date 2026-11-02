(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProvedRegistrationSearchResults = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function canSelectCandidate(candidate) {
    const identity = candidate?.identity_verification || {};
    return Boolean(
      identity.brand_and_product_confirmed === true
      && identity.reliable_source_confirmed === true
    );
  }

  function renderCandidate(candidate) {
    const name = String(candidate?.product_name || candidate?.official_product_name || '').trim();
    const manufacturer = String(candidate?.manufacturer || '').trim();
    const index = Number(candidate?.candidate_index);
    if (!name || !Number.isInteger(index) || index < 0) return '';
    const selectable = canSelectCandidate(candidate);
    const title = [manufacturer, name].filter(Boolean).join(' · ');
    const reasons = Array.isArray(candidate?.match_reasons)
      ? candidate.match_reasons.filter(Boolean).slice(0, 2).join(' · ') : '';
    const type = candidate?.detected_feed_type === 'wet' ? '습식'
      : candidate?.detected_feed_type === 'dry' ? '건식' : '';
    return '<li class="registration-search-result">'
      + '<div class="registration-search-result__body"><strong>' + escapeHtml(title) + '</strong>'
      + (type ? '<span class="registration-search-result__type">' + type + '</span>' : '')
      + (reasons ? '<p>' + escapeHtml(reasons) + '</p>' : '')
      + (!selectable ? '<p>브랜드·제품명 또는 신뢰 출처를 확인해야 등록할 수 있어요.</p>' : '')
      + '</div>'
      + (selectable ? '<button type="button" class="registration-search-result__select" data-register-candidate-index="'
          + index + '">이 제품 등록</button>' : '')
      + '</li>';
  }

  function renderResponse(result) {
    const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
    const candidateHtml = candidates.map(renderCandidate).filter(Boolean).join('');
    const outcome = String(result?.outcome || '');
    const isMissing = result?.needs_more_info === true || result?.needs_candidate_selection === true
      || outcome === 'needs_candidate_selection' || outcome === 'needs_more_info';
    const isNotFound = outcome === 'not_found';
    const isError = !isMissing && !isNotFound && result?.성공 !== true;
    const title = candidateHtml
      ? '사료 검색 결과 · 제품을 확인해 주세요'
      : isNotFound ? '사료 검색 결과 · 제품을 찾지 못했어요'
      : isError ? '사료 검색을 완료하지 못했어요'
      : '사료 검색 결과 · 추가 정보가 필요해요';
    const guidance = String(result?.안내 || result?.오류 || '').trim();
    const missing = Array.isArray(result?.missing_information)
      ? result.missing_information.filter(Boolean).slice(0, 4).join(' · ') : '';
    const info = !candidateHtml && !guidance
      ? '제품의 브랜드, 맛, 연령 또는 제형을 더 알려주시거나 라벨 사진을 올려 주세요.' : '';
    return '<section class="registration-search-results" role="region" aria-label="사료 검색 결과">'
      + '<h3>' + escapeHtml(title) + '</h3>'
      + (guidance ? '<p class="registration-search-results__intro">' + escapeHtml(guidance) + '</p>' : '')
      + (info ? '<p class="registration-search-results__intro">' + escapeHtml(info) + '</p>' : '')
      + (missing ? '<p class="registration-search-results__hint">추가 확인 사항: ' + escapeHtml(missing) + '</p>' : '')
      + (candidateHtml ? '<ul class="registration-search-results__list">' + candidateHtml + '</ul>' : '')
      + (result?.too_many_candidates === true
        ? '<p class="registration-search-results__hint">표시된 제품 외에도 후보가 있어요. 제품명을 더 구체적으로 입력해 주세요.</p>' : '')
      + '<div class="registration-search-results__actions">'
      + '<button type="button" data-registration-refine>제품명 수정하기</button>'
      + '<button type="button" data-registration-upload-trigger>라벨 사진으로 찾기</button>'
      + '</div></section>';
  }

  return { escapeHtml, canSelectCandidate, renderCandidate, renderResponse };
});
