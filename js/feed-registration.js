const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQog8PhiP_DQnDwg1b9u_JVoKnxUrcTfS944QOYwJFn7hO4TKNjkzMQrtHU-enpGTFdA/exec';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const registrationState = { species: 'cat', type: 'dry', userId: null, busy: false, imageFile: null };

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

function showReturnNotice() {
  const complete = document.getElementById('registrationComplete');
  complete?.classList.add('is-visible');
  complete?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  button.textContent = '제품 정보 검색 중...';
  renderMessage('feedTextRequestMsg', '공식 자료와 신뢰할 수 있는 판매 정보를 확인하고 있습니다.');
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
      showReturnNotice();
      return;
    }
    if (!result.성공) throw new Error(result.오류 || '제품 정보를 등록하지 못했습니다.');
    const names = Array.isArray(result.제품명) ? result.제품명.join(', ') : (result.제품명 || query);
    renderMessage('feedTextRequestMsg', result.검색가능 === false
      ? `${names} 자료를 저장했습니다. 검수 후 검색에 표시됩니다.`
      : `${names} 등록 완료 — 계산기에서 ‘검수 전’ 표시로 검색할 수 있습니다.`, result.검색가능 === false ? 'warning' : 'success');
    input.value = '';
    showReturnNotice();
  } catch (error) {
    console.error(error);
    renderMessage('feedTextRequestMsg', '제품 정보를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    registrationState.busy = false;
    button.disabled = false;
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
  registrationState.busy = true;
  button.disabled = true;
  button.textContent = '이미지 분석 중...';
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
    renderMessage('uploadMsg', '등록 완료 — 계산기에서 ‘검수 전’ 표시로 검색할 수 있습니다.', 'success');
    document.getElementById('uploadInput').value = '';
    registrationState.imageFile = null;
    showReturnNotice();
  } catch (error) {
    console.error(error);
    renderMessage('uploadMsg', error.message || '네트워크 또는 분석 서버 오류가 발생했습니다.', 'error');
  } finally {
    registrationState.busy = false;
    button.disabled = false;
    button.textContent = '이미지 분석하기';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  setChoice('species', params.get('species') === 'dog' ? 'dog' : 'cat');
  setChoice('type', params.get('type') === 'wet' ? 'wet' : 'dry');
  document.querySelectorAll('[data-species]').forEach(button => button.addEventListener('click', () => setChoice('species', button.dataset.species)));
  document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => setChoice('type', button.dataset.type)));
  document.getElementById('feedTextRequestBtn').addEventListener('click', submitTextRegistration);
  document.getElementById('feedTextRequestInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); submitTextRegistration(); }
  });
  document.getElementById('uploadInput').addEventListener('change', event => {
    registrationState.imageFile = event.target.files?.[0] || null;
    if (registrationState.imageFile) renderMessage('uploadMsg', `선택됨: ${registrationState.imageFile.name}`);
  });
  document.getElementById('uploadFeedBtn').addEventListener('click', submitImageRegistration);
  const { data } = await sb.auth.getSession();
  registrationState.userId = data.session?.user?.id || null;
});
