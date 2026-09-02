(function initializeGoogleAnalytics() {
  const measurementId = 'G-HV1TPVCQK7';
  const allowedHosts = new Set(['proved.kr', 'www.proved.kr']);
  if (!allowedHosts.has(window.location.hostname) || window.__provedGa4Loaded) return;

  window.__provedGa4Loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}());

(function initializeNaverAnalytics() {
  const siteId = '180a5406af05de0';
  const allowedHosts = new Set(['proved.kr', 'www.proved.kr']);
  if (!allowedHosts.has(window.location.hostname) || window.__provedNaverAnalyticsLoaded) return;

  window.__provedNaverAnalyticsLoaded = true;
  window.wcs_add = window.wcs_add || {};
  window.wcs_add.wa = siteId;

  const trackPage = function () {
    if (window.wcs && typeof window.wcs_do === 'function') {
      window.wcs_do();
    }
  };

  if (window.wcs && typeof window.wcs_do === 'function') {
    trackPage();
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://wcs.pstatic.net/wcslog.js';
  script.onload = trackPage;
  document.head.appendChild(script);
}());

const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQog8PhiP_DQnDwg1b9u_JVoKnxUrcTfS944QOYwJFn7hO4TKNjkzMQrtHU-enpGTFdA/exec';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const PROVED_PENDING_REGISTERED_FEED_KEY = 'proved.pendingRegisteredFeed.v1';
const CALCULATOR_PATHS = new Set(['/', '/cat-food-calculator/', '/dog-food-calculator/']);
const registrationState = {
  species: 'cat',
  type: 'dry',
  userId: null,
  busy: false,
  imageFile: null,
  previewUrl: null,
  returnTo: ''
};
let textWaitTimers = [];
let calculatorReturnTimer = null;

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}

function setChoice(group, value) {
  registrationState[group] = value;
  document.querySelectorAll(`[data-${group}]`).forEach(button => {
    const active = button.dataset[group] === value;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderMessage(id, message, tone = 'info') {
  const colors = { success:'#18864B', warning:'#B85A00', error:'#C53B36', info:'#2F6FED' };
  const container = document.getElementById(id);
  if (container) container.innerHTML = `<p style="margin-top:10px;color:${colors[tone]};font-size:12px;font-weight:750;line-height:1.55">${escapeHtml(message)}</p>`;
}

async function parseResponse(response) {
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch (_) { throw new Error(`분석 서버 응답을 읽지 못했습니다. HTTP ${response.status}`); }
  if (!response.ok) throw new Error(data.오류 || `HTTP ${response.status}`);
  return data;
}

function normalizeCalculatorReturnPath(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    const normalizedPath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    if (url.origin !== window.location.origin || !CALCULATOR_PATHS.has(normalizedPath)) return '';
    return normalizedPath;
  } catch (_) {
    return '';
  }
}

function getDefaultCalculatorPath() {
  return registrationState.species === 'dog' ? '/dog-food-calculator/' : '/cat-food-calculator/';
}

function getRegisteredFeedId(result) {
  const values = [
    result?.registered_feed_id,
    result?.feed_id,
    result?.registeredFeedId,
    result?.등록된사료ID,
    result?.사료ID,
    Array.isArray(result?.result_feed_ids) ? result.result_feed_ids[0] : null,
    Array.isArray(result?.feed_ids) ? result.feed_ids[0] : null
  ];
  return values.find(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))) || null;
}

function getRegisteredProductName(result, fallbackName = '') {
  const value = Array.isArray(result?.제품명) ? result.제품명[0] : result?.제품명;
  return String(value || fallbackName || '').trim();
}

function savePendingRegisteredFeed(result, fallbackName) {
  const pending = {
    version: 1,
    species: registrationState.species,
    type: registrationState.type,
    feedId: getRegisteredFeedId(result),
    productName: getRegisteredProductName(result, fallbackName),
    savedAt: Date.now()
  };
  if (!pending.feedId && !pending.productName) return;

  try {
    sessionStorage.setItem(PROVED_PENDING_REGISTERED_FEED_KEY, JSON.stringify(pending));
  } catch (error) {
    console.warn('Registered feed return state could not be saved.', error);
  }
}

function returnToCalculator() {
  if (calculatorReturnTimer) window.clearTimeout(calculatorReturnTimer);
  const destination = registrationState.returnTo || getDefaultCalculatorPath();
  window.location.replace(destination);
}

function showReturnNotice({ result = {}, fallbackName = '', searchable = true } = {}) {
  const complete = document.getElementById('registrationComplete');
  const message = document.getElementById('registrationReturnMessage');
  const button = document.getElementById('registrationReturnButton');
  if (!complete || !message || !button) return;

  if (!searchable) {
    message.textContent = '제품 자료를 저장했습니다. 검수가 끝나면 계산기에서 검색할 수 있습니다.';
    button.hidden = true;
    complete.classList.add('is-visible');
    complete.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  savePendingRegisteredFeed(result, fallbackName);
  button.hidden = false;
  button.textContent = '지금 계산기로 돌아가기';
  button.onclick = returnToCalculator;
  if (registrationState.returnTo) {
    message.textContent = '등록이 완료되었습니다. 3초 후 계산기 화면으로 돌아갑니다.';
    calculatorReturnTimer = window.setTimeout(returnToCalculator, 3000);
  } else {
    message.textContent = '등록이 완료되었습니다. 계산기로 돌아가 방금 등록한 제품으로 계산할 수 있습니다.';
  }
  complete?.classList.add('is-visible');
  complete?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearTextWaitTimers() {
  textWaitTimers.forEach(window.clearTimeout);
  textWaitTimers = [];
}

function setTextWaitStage(message, detail) {
  const stage = document.getElementById('feedTextRequestStage');
  const detailNode = document.getElementById('feedTextRequestDetail');
  if (stage) stage.textContent = message;
  if (detail && detailNode) detailNode.textContent = detail;
}

function showTextWait() {
  clearTextWaitTimers();
  const wait = document.getElementById('feedTextRequestWait');
  wait?.classList.add('is-visible');
  wait?.setAttribute('aria-hidden', 'false');
  setTextWaitStage('공식 제품 확인 중', '보통 30초 이내에 완료되며, 경우에 따라 최대 1분 정도 걸릴 수 있어요.');
  textWaitTimers.push(window.setTimeout(() => setTextWaitStage('영양정보 확인 중'), 6000));
  textWaitTimers.push(window.setTimeout(() => setTextWaitStage('등록 결과 정리 중'), 12000));
  textWaitTimers.push(window.setTimeout(() => {
    const alert = document.getElementById('feedTextRequestAlert');
    if (alert) alert.textContent = '조금만 더 기다려 주세요.';
    setTextWaitStage('제품 정보를 꼼꼼히 확인하고 있습니다', '완료될 때까지 이 창을 그대로 두세요.');
  }, 30000));
}

function hideTextWait() {
  clearTextWaitTimers();
  const wait = document.getElementById('feedTextRequestWait');
  wait?.classList.remove('is-visible');
  wait?.setAttribute('aria-hidden', 'true');
  const alert = document.getElementById('feedTextRequestAlert');
  if (alert) alert.textContent = '창을 닫거나 등록 버튼을 다시 누르지 마세요.';
}

async function submitTextRegistration() {
  if (registrationState.busy) return;
  const input = document.getElementById('feedTextRequestInput');
  const button = document.getElementById('feedTextRequestBtn');
  const query = String(input.value || '').trim();
  if (query.split(/\s+/).filter(Boolean).length < 2) {
    renderMessage('feedTextRequestMsg', '브랜드와 정확한 제품명을 함께 입력해 주세요. 예: 조공 소피캣 닭', 'warning');
    input.focus();
    return;
  }

  registrationState.busy = true;
  button.disabled = true;
  button.classList.add('is-loading');
  button.textContent = '사료 정보 확인 중…';
  document.getElementById('feedTextRequestMsg').replaceChildren();
  showTextWait();
  try {
    const { data: requestId, error } = await sb.rpc('create_feed_request', {
      p_request_text: query,
      p_species: registrationState.species,
      p_feed_type: registrationState.type
    });
    if (error || !requestId) throw new Error(error?.message || '등록 요청 기록을 만들지 못했습니다.');
    const result = await parseResponse(await fetch(APPS_SCRIPT_URL, {
      method:'POST',
      body:JSON.stringify({
        action:'text_request', request_id:requestId, query,
        type:registrationState.type, species:registrationState.species,
        user_id:registrationState.userId,
        identification_requirements:{
          brand_and_product_confirmed:true,
          single_product_identified:true,
          trusted_source_confirmed:true
        }
      })
    }));

    const validation = result.validation || result.제품식별검증 || {};
    const needsMoreInfo = result.needs_more_info === true || result.추가정보필요 === true ||
      result.outcome === 'needs_more_info' || result.status === 'needs_more_info' ||
      Object.values(validation).some(value => value === false);
    if (needsMoreInfo) {
      renderMessage('feedTextRequestMsg', result.안내 || '브랜드와 정확한 제품명을 함께 입력해 주세요.', 'warning');
      return;
    }
    if (result.중복) {
      renderMessage('feedTextRequestMsg', `${result.verified ? '이미 등록된' : '이미 검수 전으로 등록된'} 제품입니다. ${result.제품명 || ''}`.trim(), result.verified ? 'success' : 'warning');
      showReturnNotice({ result, fallbackName: query, searchable: result.검색가능 !== false });
      return;
    }
    if (!result.성공) throw new Error(result.오류 || '제품 정보를 등록하지 못했습니다.');
    const names = Array.isArray(result.제품명) ? result.제품명.join(', ') : (result.제품명 || query);
    renderMessage('feedTextRequestMsg', result.검색가능 === false
      ? `${names} 자료를 저장했습니다. 검수 후 검색에 표시됩니다.`
      : `${names} 등록 완료 — 계산기에서 ‘검수 전’ 표시로 검색할 수 있습니다.`, result.검색가능 === false ? 'warning' : 'success');
    input.value = '';
    showReturnNotice({ result, fallbackName: names, searchable: result.검색가능 !== false });
  } catch (error) {
    console.error(error);
    renderMessage('feedTextRequestMsg', '제품 정보를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    hideTextWait();
    registrationState.busy = false;
    button.disabled = false;
    button.classList.remove('is-loading');
    button.textContent = '제품명으로 등록';
  }
}

async function submitImageRegistration() {
  if (registrationState.busy) return;
  const file = registrationState.imageFile;
  if (!file) {
    renderMessage('uploadMsg', '분석할 라벨 사진을 먼저 선택해 주세요.', 'warning');
    return;
  }
  const button = document.getElementById('uploadFeedBtn');
  const fileLabel = document.getElementById('registrationFileLabel');
  const input = document.getElementById('uploadInput');
  registrationState.busy = true;
  button.disabled = true;
  input.disabled = true;
  button.classList.remove('is-visible');
  fileLabel?.classList.add('is-busy');
  renderMessage('uploadMsg', '라벨 정보를 분석하고 있습니다.');
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result.split(',')[1]);
      reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    });
    const result = await parseResponse(await fetch(APPS_SCRIPT_URL, {
      method:'POST',
      body:JSON.stringify({ action:'upload', base64Data:base64, mimeType:file.type, fileName:file.name, type:registrationState.type, species:registrationState.species })
    }));
    if (!result.성공) throw new Error(result.안내 || result.오류 || '등록하지 못했습니다.');
    renderMessage('uploadMsg', result.검색가능 === false
      ? '제품 자료를 저장했습니다. 검수 후 검색에 표시됩니다.'
      : '등록 완료 — 계산기에서 ‘검수 전’ 표시로 검색할 수 있습니다.', result.검색가능 === false ? 'warning' : 'success');
    document.getElementById('uploadInput').value = '';
    registrationState.imageFile = null;
    document.getElementById('uploadPrompt').textContent = '분석 완료';
    showReturnNotice({ result, searchable: result.검색가능 !== false });
  } catch (error) {
    console.error(error);
    renderMessage('uploadMsg', error.message || '네트워크 또는 분석 서버 오류가 발생했습니다.', 'error');
    button.classList.add('is-visible');
  } finally {
    registrationState.busy = false;
    button.disabled = false;
    input.disabled = false;
    fileLabel?.classList.remove('is-busy');
  }
}

function showImagePreview(file) {
  const preview = document.getElementById('uploadPreview');
  if (registrationState.previewUrl) URL.revokeObjectURL(registrationState.previewUrl);
  registrationState.previewUrl = URL.createObjectURL(file);
  preview.replaceChildren();
  const image = document.createElement('img');
  image.src = registrationState.previewUrl;
  image.alt = '선택한 라벨 사진 미리보기';
  preview.removeAttribute('aria-hidden');
  preview.appendChild(image);
  document.getElementById('uploadPrompt').textContent = file.name;
}

function validateImageFile(file) {
  if (!file.type.startsWith('image/')) return 'JPG 또는 PNG 이미지 파일을 선택해 주세요.';
  if (file.size > 10 * 1024 * 1024) return '사진은 10MB 이하만 등록할 수 있습니다.';
  return '';
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  registrationState.returnTo = normalizeCalculatorReturnPath(params.get('return_to'));
  setChoice('species', params.get('species') === 'dog' ? 'dog' : 'cat');
  setChoice('type', params.get('type') === 'wet' ? 'wet' : 'dry');
  document.querySelectorAll('[data-species]').forEach(button => button.addEventListener('click', () => setChoice('species', button.dataset.species)));
  document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => setChoice('type', button.dataset.type)));
  document.getElementById('feedTextRequestBtn').addEventListener('click', submitTextRegistration);
  document.getElementById('feedTextRequestInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); submitTextRegistration(); }
  });
  document.getElementById('uploadInput').addEventListener('change', async event => {
    const file = event.target.files?.[0] || null;
    if (!file || registrationState.busy) return;
    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      event.target.value = '';
      registrationState.imageFile = null;
      renderMessage('uploadMsg', validationMessage, 'warning');
      return;
    }
    registrationState.imageFile = file;
    showImagePreview(file);
    document.getElementById('uploadFeedBtn').classList.remove('is-visible');
    await submitImageRegistration();
  });
  document.getElementById('uploadFeedBtn').addEventListener('click', submitImageRegistration);
  const { data } = await sb.auth.getSession();
  registrationState.userId = data.session?.user?.id || null;
});

window.addEventListener('pagehide', () => {
  if (registrationState.previewUrl) URL.revokeObjectURL(registrationState.previewUrl);
});
