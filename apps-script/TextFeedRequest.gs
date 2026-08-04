// ============================================================
// Proved - 제품명 기반 사료 등록 요청
// 기존 Apps Script 프로젝트에 이 파일을 추가해서 사용합니다.
// Code.gs의 doPost에는 README의 text_request 분기를 추가해야 합니다.
// ============================================================

const TEXT_FEED_MODELS = {
  SEARCH: 'gemini-3.5-flash-lite',
  VERIFY: 'gemini-3.5-flash-lite',
  ESCALATE: 'gemini-3.5-flash'
};

function _handleTextFeedRequest(body) {
  const species = _normalizeSpecies(body.species);
  const type = _normalizeFoodType(body.type);
  const query = String(body.query || '').trim().slice(0, 120);

  if (!species || !type) {
    return { 성공: false, 오류: '등록 요청 정보를 확인해 주세요.' };
  }
  if (query.length < 2) {
    return { 성공: false, 오류: '브랜드와 제품명을 두 글자 이상 입력해 주세요.' };
  }

  const requestRow = _saveTextFeedRequest({
    request_text: query,
    species,
    feed_type: type,
    user_id: body.user_id
  });
  if (!requestRow?.id) {
    return { 성공: false, 오류: '등록 요청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  let result;
  try {
    result = _processTextFeedRequest(body);
  } catch (error) {
    const detail = error?.stack || error?.message || String(error);
    Logger.log(`[텍스트 사료 처리 예외] request_id=${requestRow.id}, detail=${detail}`);
    _updateTextFeedRequest(requestRow.id, 'needs_review', {
      error_detail: detail.slice(0, 4000)
    });
    return {
      성공: true,
      요청접수: true,
      검색완료: false,
      request_id: requestRow.id
    };
  }

  if (result?.성공) {
    const status = result.중복 ? 'duplicate' : 'registered';
    const resultIds = Array.isArray(result.등록ID)
      ? result.등록ID.filter(Boolean)
      : (result.등록ID ? [result.등록ID] : []);
    _updateTextFeedRequest(requestRow.id, status, {
      result_table: species === 'dog' ? 'dog_feeds' : 'feeds',
      result_feed_ids: resultIds,
      error_detail: null
    });
    return {
      ...result,
      요청접수: true,
      검색완료: true,
      request_id: requestRow.id
    };
  }

  const internalError = String(result?.오류 || '제품 정보를 자동으로 확인하지 못했습니다.').slice(0, 4000);
  _updateTextFeedRequest(requestRow.id, 'needs_review', {
    error_detail: internalError
  });
  return {
    성공: true,
    요청접수: true,
    검색완료: false,
    request_id: requestRow.id
  };
}

function _saveTextFeedRequest(values) {
  const userId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(values.user_id || '').trim())
    ? String(values.user_id).trim()
    : null;
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/feed_requests`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      apikey: CONFIG.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${CONFIG.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    payload: JSON.stringify({
      request_text: values.request_text,
      species: values.species,
      feed_type: values.feed_type,
      user_id: userId,
      status: 'pending'
    }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const responseBody = response.getContentText();
  Logger.log(`[텍스트 사료 요청 저장] code=${code}, body=${responseBody.substring(0, 700)}`);
  if (code !== 200 && code !== 201) return null;

  try {
    return JSON.parse(responseBody)?.[0] || null;
  } catch (error) {
    Logger.log(`[텍스트 사료 요청 응답 파싱 실패] ${error.message}`);
    return null;
  }
}

function _updateTextFeedRequest(requestId, status, details) {
  if (!requestId) return false;
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/feed_requests?id=eq.${encodeURIComponent(requestId)}`;
  const payload = {
    status,
    processed_at: new Date().toISOString(),
    ...(details || {})
  };
  const response = UrlFetchApp.fetch(url, {
    method: 'patch',
    headers: {
      apikey: CONFIG.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${CONFIG.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    Logger.log(`[텍스트 사료 요청 상태 저장 실패] request_id=${requestId}, code=${code}, body=${response.getContentText().substring(0, 700)}`);
    return false;
  }
  return true;
}

function _processTextFeedRequest(body) {
  const species = _normalizeSpecies(body.species);
  const type = _normalizeFoodType(body.type);
  const query = String(body.query || '').trim().slice(0, 120);

  if (!species || !type) {
    return { 성공: false, 오류: 'species는 cat 또는 dog, type은 dry 또는 wet이어야 합니다.' };
  }
  if (query.length < 2) {
    return { 성공: false, 오류: '브랜드와 제품명을 두 글자 이상 입력해 주세요.' };
  }

  const earlyDuplicate = _findTextFeedDuplicate(species, type, query, null, null);
  if (earlyDuplicate) {
    return _duplicateTextFeedResponse(earlyDuplicate);
  }

  const searchPrompt = _getTextFeedSearchPrompt(query, species, type);
  const searchCall = _callGeminiTextTool(TEXT_FEED_MODELS.SEARCH, searchPrompt, [
    { google_search: {} }
  ]);
  if (!searchCall.ok) {
    return { 성공: false, 오류: searchCall.error || '공식 자료 검색에 실패했습니다.' };
  }

  const searchData = _parseGeminiJSON(searchCall.text);
  if (!searchData) {
    return { 성공: false, 오류: '검색 결과를 구조화하지 못했습니다.' };
  }

  const sourceUrls = _mergeTextFeedSourceUrls(
    searchData.source_urls,
    searchCall.groundingUrls
  );
  if (!sourceUrls.length) {
    return {
      성공: false,
      오류: '공식 자료 URL을 찾지 못했습니다.',
      안내: '제품명을 더 정확하게 입력하거나 라벨 사진으로 등록해 주세요.'
    };
  }

  const verifyPrompt = _getTextFeedVerificationPrompt(query, species, type, searchData, sourceUrls);
  const verifyCall = _callGeminiTextTool(TEXT_FEED_MODELS.VERIFY, verifyPrompt, [
    { url_context: {} }
  ]);
  if (!verifyCall.ok) {
    return { 성공: false, 오류: verifyCall.error || '공식 URL 확인에 실패했습니다.' };
  }

  let verifiedData = _parseGeminiJSON(verifyCall.text);
  if (!verifiedData) {
    return { 성공: false, 오류: '공식 URL 확인 결과를 구조화하지 못했습니다.' };
  }

  const verifiedProducts = Array.isArray(verifiedData.products) ? verifiedData.products : [];
  const needsEscalation = verifiedData.requires_escalation === true
    || verifiedData.verification_status === 'conflict'
    || verifiedProducts.some(product => product.verification_status === 'conflict');

  if (needsEscalation) {
    const escalationPrompt = _getTextFeedEscalationPrompt(
      query,
      species,
      type,
      verifiedData,
      sourceUrls
    );
    const escalationCall = _callGeminiTextTool(TEXT_FEED_MODELS.ESCALATE, escalationPrompt, [
      { url_context: {} }
    ]);
    if (escalationCall.ok) {
      const escalatedData = _parseGeminiJSON(escalationCall.text);
      if (escalatedData) verifiedData = escalatedData;
    }
  }

  const products = _normalizeTextFeedProducts(verifiedData, sourceUrls, query);
  if (!products.length) {
    return {
      성공: false,
      오류: '등록할 제품 정보를 확정하지 못했습니다.',
      안내: '국내 유통 라벨 사진으로 등록해 주세요.'
    };
  }

  const savedProducts = [];
  const duplicateProducts = [];

  products.forEach(product => {
    const duplicate = _findTextFeedDuplicate(
      species,
      type,
      null,
      product.제조사,
      product.제품명
    );
    if (duplicate) {
      duplicateProducts.push(duplicate);
      return;
    }

    const nutrition = _buildTextFeedNutrition(product, type);
    const metadata = _buildTextFeedMetadata(product, verifiedData, sourceUrls, query, nutrition);
    const saved = _saveTextFeedToDB(nutrition, metadata, species);
    if (saved) {
      savedProducts.push({
        id: saved.id || null,
        제품명: nutrition.제품명,
        검색가능: Boolean(nutrition.final_me > 0 && metadata.verification_status !== 'conflict'),
        verification_status: metadata.verification_status
      });
    }
  });

  if (!savedProducts.length && duplicateProducts.length) {
    return _duplicateTextFeedResponse(duplicateProducts[0]);
  }

  if (!savedProducts.length) {
    return { 성공: false, 오류: 'Supabase 임시 저장에 실패했습니다.' };
  }

  return {
    성공: true,
    중복: false,
    등록수: savedProducts.length,
    제품명: savedProducts.map(item => item.제품명),
    등록ID: savedProducts.map(item => item.id).filter(Boolean),
    검색가능: savedProducts.some(item => item.검색가능),
    검수상태: savedProducts.map(item => item.verification_status),
    중복제외수: duplicateProducts.length
  };
}

function _duplicateTextFeedResponse(row) {
  return {
    성공: true,
    중복: true,
    verified: row.verified === true,
    제품명: row.제조사 ? `${row.제조사} | ${row.제품명}` : row.제품명,
    검수상태: row.verification_status || (row.verified ? 'approved' : 'pending_review'),
    등록ID: row.id || null
  };
}

function _getTextFeedSearchPrompt(query, species, type) {
  const speciesName = species === 'dog' ? '강아지' : '고양이';
  const typeName = type === 'wet' ? '습식사료' : '건사료';

  return `너는 Proved의 반려동물 사료 공식 자료 조사원이다.

사용자가 입력한 제품명: ${query}
대상 동물: ${speciesName}
사료 형태: ${typeName}

Google Search를 사용해 실제 제품을 특정하고, 영양성분·열량·전성분을 확인할 수 있는 공개 URL을 찾는다.

출처 우선순위:
1. 제조사 공식 한국 페이지
2. 제조사 글로벌 또는 생산국 공식 페이지
3. 공식 수입사·유통사 페이지
4. 제품 포장 라벨 이미지나 공식 PDF
5. 대형 판매처

규칙:
- 블로그, 카페, 생성형 요약 페이지는 공식 출처가 없을 때만 보조 자료로 사용한다.
- 한국 수입사나 판매사를 제조사로 오인하지 않는다.
- 같은 제품명의 캔·파우치·건식·용량 차이를 구분한다.
- ${speciesName}용 ${typeName}이 아닌 후보는 제외한다.
- URL은 검색 결과 주소가 아니라 가능한 한 원문 페이지의 공개 URL로 기록한다.
- 아직 성분 수치를 확정하지 말고, 검증할 URL 후보와 제품 식별 정보만 반환한다.
- 설명이나 Markdown 없이 JSON 객체만 반환한다.

반환 형식:
{
  "normalized_query":"",
  "candidate_manufacturer":"",
  "candidate_product_name":"",
  "source_urls":[
    {
      "url":"https://...",
      "title":"",
      "source_level":"manufacturer_official|importer_official|package_label|retailer|other",
      "region":"KR|Global|US|EU|JP|CA|AU|NZ|other",
      "purpose":"identity|nutrition|calorie|ingredients"
    }
  ],
  "likely_formula_status":"same|different|unknown",
  "research_note":"",
  "requires_escalation":false
}`;
}

function _getTextFeedVerificationPrompt(query, species, type, searchData, sourceUrls) {
  const speciesName = species === 'dog' ? '강아지' : '고양이';
  const typeName = type === 'wet' ? '습식사료' : '건사료';
  const urls = sourceUrls.map(item => item.url).slice(0, 12).join('\n');

  return `너는 Proved의 사료 데이터 검수원이다. URL Context로 아래 공개 URL을 직접 읽고 제품 정보를 검증하라.

사용자 입력: ${query}
대상: ${speciesName}용 ${typeName}
검색 단계 결과:
${JSON.stringify(searchData)}

확인할 URL:
${urls}

핵심 원칙:
- URL에서 명시적으로 확인되지 않은 값은 추측하지 말고 0 또는 null로 둔다.
- 국내판과 해외판이 동일 배합이라고 확인될 때만 해외 공식 Typical/Average Analysis를 계산용 수치로 사용할 수 있다.
- 국내판과 해외판의 전성분 또는 보장성분이 실질적으로 다르면 products 배열에 두 제품을 별도로 반환한다.
- 배합이 다른 두 제품은 제품명 뒤에 각각 " (한국 유통판)", " (글로벌판)"을 붙인다.
- 자료가 다르지만 어느 쪽이 현재 제품인지 해결되지 않으면 verification_status를 conflict로 둔다.
- 국내 유통 라벨을 찾지 못했지만 해외 공식 자료가 명확하면 needs_label로 둔다.
- kcal/100g은 kcal/kg으로 10배 환산한다. kcal/g은 1000배 환산한다.
- kcal/캔, kcal/파우치만 있고 제품 중량이 공식 자료에서 명확하지 않으면 kcal/kg을 계산하지 않는다.
- 성분 수치는 as-fed 퍼센트 숫자만 반환한다. 없는 수치는 0이다.
- 완전식여부는 주식, 보조식, 확인불가 중 하나다.
- 설명이나 Markdown 없이 JSON 객체만 반환한다.

반환 형식:
{
  "formula_match_status":"same|different|unknown",
  "requires_escalation":false,
  "verification_status":"pending_review|needs_label|conflict",
  "review_note":"",
  "products":[
    {
      "제조사":null,
      "원산지":null,
      "제품명":"",
      "완전식여부":"주식|보조식|확인불가",
      "메인단백질":null,
      "전성분":null,
      "조단백":0,
      "조지방":0,
      "조회분":0,
      "조섬유":0,
      "수분":0,
      "칼슘":0,
      "인":0,
      "칼로리_kg":0,
      "칼로리_unit":0,
      "겔화제":null,
      "source_level":"manufacturer_official|importer_official|package_label|retailer|other",
      "source_region":"KR|Global|US|EU|JP|CA|AU|NZ|other",
      "source_urls":["https://..."],
      "calorie_source_url":null,
      "domestic_label_status":"found|not_found|conflict",
      "formula_match_status":"same|different|unknown",
      "verification_status":"pending_review|needs_label|conflict",
      "needs_nutrition_review":true,
      "ai_review_note":""
    }
  ]
}`;
}

function _getTextFeedEscalationPrompt(query, species, type, verifiedData, sourceUrls) {
  const urls = sourceUrls.map(item => item.url).slice(0, 12).join('\n');
  return `다음 사료 자료에서 해결되지 않은 충돌을 고급 검수하라.

검색어: ${query}
species: ${species}
type: ${type}
현재 분석:
${JSON.stringify(verifiedData)}

URL:
${urls}

URL Context로 원문을 다시 읽고 다음을 결정한다.
1. 같은 배합인지 다른 배합인지
2. 열량 단위와 환산이 맞는지
3. 한국 유통판과 글로벌판을 별도 제품으로 저장해야 하는지
4. 해결 불가능하면 conflict 상태를 유지할지

확정할 근거가 없으면 추측하지 않는다. 반환 JSON 구조는 현재 분석과 동일하게 유지하고 설명이나 Markdown 없이 JSON만 반환한다.`;
}

function _callGeminiTextTool(model, prompt, tools) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: tools || [],
    generationConfig: { responseMimeType: 'application/json' }
  };

  let response = _fetchGeminiTextTool(url, payload);
  if (response.code === 400 && payload.generationConfig) {
    delete payload.generationConfig;
    response = _fetchGeminiTextTool(url, payload);
  }

  if (response.code < 200 || response.code >= 300) {
    Logger.log(`[텍스트 사료 Gemini 오류] model=${model}, code=${response.code}, body=${response.body.substring(0, 700)}`);
    return { ok: false, error: `Gemini ${response.code} 오류` };
  }

  let json;
  try {
    json = JSON.parse(response.body);
  } catch (error) {
    return { ok: false, error: 'Gemini 응답 JSON 파싱 실패' };
  }

  if (json.error) {
    return { ok: false, error: json.error.message || 'Gemini API 오류' };
  }

  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .map(part => part.text || '')
    .join('\n')
    .trim();

  if (!text) {
    const finishReason = candidate?.finishReason || candidate?.finish_reason || 'unknown';
    const blockReason = json.promptFeedback?.blockReason || json.prompt_feedback?.block_reason || 'none';
    Logger.log(
      `[텍스트 사료 Gemini 빈 응답] model=${model}, finishReason=${finishReason}, blockReason=${blockReason}, body=${response.body.substring(0, 2000)}`
    );
  }

  return {
    ok: Boolean(text),
    text,
    groundingUrls: _extractGeminiGroundingUrls(candidate),
    raw: json,
    error: text ? null : '제품 정보를 자동으로 확인하지 못했습니다.'
  };
}

function _fetchGeminiTextTool(url, payload) {
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': CONFIG.GEMINI_API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true
  });
  return {
    code: response.getResponseCode(),
    body: response.getContentText()
  };
}

function _extractGeminiGroundingUrls(candidate) {
  const metadata = candidate?.groundingMetadata || candidate?.grounding_metadata || {};
  const chunks = metadata.groundingChunks || metadata.grounding_chunks || [];
  const results = [];

  chunks.forEach(chunk => {
    const web = chunk.web || {};
    if (_isSafeTextFeedUrl(web.uri)) {
      results.push({
        url: web.uri,
        title: web.title || null,
        source_level: 'other',
        region: 'other',
        purpose: 'search_grounding'
      });
    }
  });
  return results;
}

function _mergeTextFeedSourceUrls(primary, grounding) {
  const merged = [];
  const seen = {};
  const candidates = [];
  if (Array.isArray(primary)) candidates.push.apply(candidates, primary);
  if (Array.isArray(grounding)) candidates.push.apply(candidates, grounding);

  candidates.forEach(item => {
    const normalized = typeof item === 'string' ? { url: item } : (item || {});
    const url = String(normalized.url || '').trim();
    if (!_isSafeTextFeedUrl(url) || seen[url]) return;
    seen[url] = true;
    merged.push({
      url,
      title: normalized.title || null,
      source_level: _sanitizeTextFeedSourceLevel(normalized.source_level),
      region: String(normalized.region || 'other').slice(0, 30),
      purpose: String(normalized.purpose || 'reference').slice(0, 50)
    });
  });

  return merged.slice(0, 12);
}

function _normalizeTextFeedProducts(data, fallbackSources, query) {
  let products = Array.isArray(data.products) ? data.products : [];
  if (!products.length && data.product && typeof data.product === 'object') products = [data.product];
  if (!products.length && data.제품명) products = [data];

  return products
    .filter(product => product && String(product.제품명 || '').trim())
    .slice(0, 2)
    .map(product => ({
      ...product,
      제품명: String(product.제품명 || query).trim().slice(0, 240),
      제조사: product.제조사 ? String(product.제조사).trim().slice(0, 160) : null,
      source_urls: _mergeTextFeedSourceUrls(product.source_urls, fallbackSources),
      formula_match_status: _sanitizeFormulaMatchStatus(product.formula_match_status || data.formula_match_status),
      verification_status: _sanitizeTextFeedVerificationStatus(product.verification_status || data.verification_status),
      needs_nutrition_review: product.needs_nutrition_review !== false,
      ai_review_note: String(product.ai_review_note || data.review_note || '').slice(0, 4000)
    }));
}

function _buildTextFeedNutrition(product, type) {
  const nutrition = _calcNutrition(product, type);
  const officialME = _parseKcal(product.칼로리_kg);
  const sourceUrl = String(product.calorie_source_url || product.source_urls?.[0]?.url || '').trim() || null;

  if (officialME > 0) {
    nutrition.final_me = _round1(officialME);
    nutrition.official_me = _round1(officialME);
    nutrition.cal_source = 'official';
    nutrition.calorie_source_detail = 'Official web source verified with Gemini Search and URL Context';
    nutrition.calorie_source_url = sourceUrl;
    nutrition.calorie_confidence = product.source_level === 'manufacturer_official' ? 'high' : 'medium';
    nutrition.needs_calorie_review = product.verification_status === 'conflict';
    nutrition.calorie_note = '제품명 요청 후 공식 웹 자료에서 확인한 열량입니다. 국내 유통 라벨은 최종 관리자 검수 대상입니다.';
  } else {
    nutrition.calorie_source_url = sourceUrl;
    nutrition.needs_calorie_review = true;
  }

  return nutrition;
}

function _buildTextFeedMetadata(product, root, fallbackSources, query, nutrition) {
  const sourceUrls = _mergeTextFeedSourceUrls(product.source_urls, fallbackSources);
  let status = _sanitizeTextFeedVerificationStatus(product.verification_status || root.verification_status);
  const formulaStatus = _sanitizeFormulaMatchStatus(product.formula_match_status || root.formula_match_status);
  const domesticStatus = String(product.domestic_label_status || '').toLowerCase();

  if (status !== 'conflict' && domesticStatus === 'not_found') status = 'needs_label';
  if (formulaStatus === 'unknown' && product.needs_nutrition_review !== false && status === 'pending_review') {
    status = 'needs_label';
  }
  if (!nutrition.final_me || nutrition.final_me <= 0) {
    product.needs_nutrition_review = true;
  }

  return {
    verified: false,
    uploaded_by: 'text_request',
    image_url: null,
    submission_method: 'text_request',
    requested_query: query,
    source_urls: sourceUrls,
    source_level: _sanitizeTextFeedSourceLevel(product.source_level),
    source_region: String(product.source_region || 'other').slice(0, 30),
    formula_match_status: formulaStatus,
    ai_review_note: String(product.ai_review_note || root.review_note || '').slice(0, 4000),
    needs_nutrition_review: product.needs_nutrition_review !== false,
    verification_status: status
  };
}

function _saveTextFeedToDB(nutrition, metadata, species) {
  const table = _getFeedTable(species);
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${table}`;
  const payload = JSON.stringify({ ...nutrition, ...metadata });

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      apikey: CONFIG.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${CONFIG.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    payload,
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const responseBody = response.getContentText();
  Logger.log(`[텍스트 사료 DB 저장] table=${table}, code=${code}, body=${responseBody.substring(0, 500)}`);
  if (code !== 200 && code !== 201) return null;
  try {
    return JSON.parse(responseBody)?.[0] || null;
  } catch (error) {
    Logger.log(`[텍스트 사료 DB 응답 파싱 실패] ${error.message}`);
    return null;
  }
}

function _findTextFeedDuplicate(species, type, rawQuery, manufacturer, productName) {
  const table = _getFeedTable(species);
  const select = encodeURIComponent('id,제조사,제품명,verified,verification_status,searchable_before_review');
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${table}?select=${select}&type=eq.${encodeURIComponent(type)}&limit=1000`;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: CONFIG.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${CONFIG.SUPABASE_SERVICE_KEY}`
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    Logger.log(`[텍스트 사료 중복 조회 실패] ${response.getResponseCode()}: ${response.getContentText().substring(0, 300)}`);
    return null;
  }

  let rows = [];
  try {
    rows = JSON.parse(response.getContentText());
  } catch (error) {
    return null;
  }

  const queryKey = _normalizeTextFeedKey(rawQuery);
  const makerKey = _normalizeTextFeedKey(manufacturer);
  const productKey = _normalizeTextFeedKey(productName);

  return rows.find(row => {
    const rowMaker = _normalizeTextFeedKey(row.제조사);
    const rowProduct = _normalizeTextFeedKey(row.제품명);
    const rowCombined = rowMaker + rowProduct;

    if (productKey) {
      const sameProduct = rowProduct === productKey;
      const sameMaker = !makerKey || !rowMaker || rowMaker === makerKey;
      return sameProduct && sameMaker;
    }

    if (!queryKey || queryKey.length < 4) return false;
    if (queryKey === rowProduct || queryKey === rowCombined) return true;
    const shorter = Math.min(queryKey.length, rowCombined.length);
    const longer = Math.max(queryKey.length, rowCombined.length);
    return shorter >= 8
      && shorter / longer >= 0.82
      && (rowCombined.includes(queryKey) || queryKey.includes(rowCombined));
  }) || null;
}

function _normalizeTextFeedKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9가-힣]/g, '');
}

function _sanitizeTextFeedVerificationStatus(value) {
  const status = String(value || '').trim();
  return ['pending_review', 'needs_label', 'conflict'].includes(status)
    ? status
    : 'pending_review';
}

function _sanitizeFormulaMatchStatus(value) {
  const status = String(value || '').trim();
  return ['same', 'different', 'unknown'].includes(status) ? status : 'unknown';
}

function _sanitizeTextFeedSourceLevel(value) {
  const level = String(value || '').trim();
  return ['manufacturer_official', 'importer_official', 'package_label', 'retailer', 'other'].includes(level)
    ? level
    : 'other';
}

function _isSafeTextFeedUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}
