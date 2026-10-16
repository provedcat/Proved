(function () {
  'use strict';
  var URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  if (!window.supabase) return;
  var sb = window.supabase.createClient(URL, KEY);
  var state = { user: null, operator: false, threads: [], selected: null, busy: false };
  function el(id) { return document.getElementById(id); }
  function status(message, error, target) {
    var node = el(target || 'supportStatus');
    node.textContent = message || '';
    node.classList.toggle('is-error', Boolean(error));
  }
  function when(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }
  function setBusy(value) {
    state.busy = value;
    el('supportSend').disabled = value;
    el('supportText').disabled = value;
    el('supportFile').disabled = value;
  }
  async function login(provider) {
    status('로그인 페이지로 이동합니다.', false, 'supportAuthStatus');
    var options = { redirectTo: window.location.origin + '/support/' };
    if (provider === 'kakao') options.scopes = '';
    var response = await sb.auth.signInWithOAuth({ provider: provider, options: options });
    if (response.error) status('로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.', true, 'supportAuthStatus');
  }
  async function initialize() {
    try {
      var response = await sb.auth.getUser();
      state.user = response.error ? null : response.data.user;
      el('supportAuth').hidden = Boolean(state.user);
      el('supportWorkspace').hidden = !state.user;
      if (!state.user) return;
      var admin = await sb.from('support_operators').select('user_id').eq('user_id', state.user.id).maybeSingle();
      if (admin.error) throw admin.error;
      state.operator = Boolean(admin.data);
      el('threadHeading').textContent = state.operator ? '접수된 쪽지' : '나의 쪽지';
      el('newSupportThread').hidden = state.operator;
      await loadThreads();
    } catch (error) {
      console.error('Support startup:', error);
      status('쪽지를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.', true);
    }
  }
  async function loadThreads(preferredId) {
    var result = await sb.from('support_threads')
      .select('id,user_id,created_at').order('created_at', { ascending: false }).limit(100);
    if (result.error) throw result.error;
    state.threads = result.data || [];
    var preferred = preferredId || (state.selected && state.selected.id);
    state.selected = state.threads.find(function (row) { return row.id === preferred; }) || state.threads[0] || null;
    renderThreads();
    await loadMessages();
  }
  function renderThreads() {
    var list = el('supportThreadList');
    list.replaceChildren();
    if (!state.threads.length) {
      var notice = document.createElement('p');
      notice.className = 'pa-small';
      notice.textContent = state.operator ? '아직 접수된 쪽지가 없습니다.' : '아직 쪽지가 없습니다. 오른쪽에서 첫 쪽지를 작성해 주세요.';
      list.appendChild(notice);
      return;
    }
    state.threads.forEach(function (thread, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pa-thread-item';
      button.setAttribute('aria-current', String(Boolean(state.selected && state.selected.id === thread.id)));
      var strong = document.createElement('strong');
      strong.textContent = '대화 ' + (state.threads.length - index);
      var time = document.createElement('small');
      time.textContent = when(thread.created_at);
      button.append(strong, time);
      button.addEventListener('click', async function () {
        state.selected = thread;
        renderThreads();
        try { await loadMessages(); } catch (error) { status('대화를 불러오지 못했습니다.', true); }
      });
      list.appendChild(button);
    });
  }
  async function markRead(threadId) {
    if (!state.user) return;
    var result = await sb.from('support_reads').upsert({
      thread_id: threadId, user_id: state.user.id, last_read_at: new Date().toISOString()
    }, { onConflict: 'thread_id,user_id' });
    if (result.error) console.warn('Unable to mark support messages read:', result.error);
  }
  async function loadMessages() {
    var box = el('supportMessages');
    box.replaceChildren();
    el('supportConversationHeading').textContent = state.selected ? '대화 내용' : '새 쪽지 작성';
    if (!state.selected) {
      var blank = document.createElement('p');
      blank.className = 'pa-small';
      blank.textContent = state.operator ? '접수된 쪽지를 선택해 주세요.' : '내용을 입력하면 비공개 대화가 시작됩니다.';
      box.appendChild(blank);
      return;
    }
    var response = await sb.from('support_messages').select('id,sender_id,body,attachment_path,created_at')
      .eq('thread_id', state.selected.id).order('created_at', { ascending: true }).limit(200);
    if (response.error) throw response.error;
    var messages = response.data || [];
    if (!messages.length) {
      var empty = document.createElement('p');
      empty.className = 'pa-small';
      empty.textContent = '아직 메시지가 없습니다.';
      box.appendChild(empty);
    }
    for (var index = 0; index < messages.length; index += 1) {
      var item = messages[index];
      var mine = item.sender_id === state.user.id;
      var row = document.createElement('article');
      row.className = 'pa-message' + (mine ? ' is-mine' : '');
      var title = document.createElement('small');
      title.textContent = (mine ? '나' : (state.operator ? '이용자' : '운영자')) + ' · ' + when(item.created_at);
      var paragraph = document.createElement('p');
      paragraph.textContent = item.body;
      row.append(title, paragraph);
      if (item.attachment_path) {
        var signed = await sb.storage.from('support-attachments').createSignedUrl(item.attachment_path, 120);
        if (!signed.error && signed.data && signed.data.signedUrl) {
          var link = document.createElement('a');
          link.href = signed.data.signedUrl;
          link.textContent = '첨부 사진 보기 ↗';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          row.appendChild(link);
        }
      }
      box.appendChild(row);
    }
    box.scrollTop = box.scrollHeight;
    await markRead(state.selected.id);
  }
  async function submit(event) {
    event.preventDefault();
    if (!state.user || state.busy) return;
    var body = el('supportText').value.trim();
    if (!body || body.length > 4000) { status('내용을 1~4000자로 입력해 주세요.', true); return; }
    var file = el('supportFile').files[0];
    var extension = '';
    if (file) {
      var mapping = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      extension = mapping[file.type];
      if (!extension || file.size > 5 * 1024 * 1024) {
        status('첨부 파일은 5MB 이하의 JPG, PNG 또는 WebP 사진만 가능합니다.', true);
        return;
      }
    }
    setBusy(true);
    status('쪽지를 보내고 있습니다.');
    try {
      var thread = state.selected;
      if (!thread) {
        var created = await sb.from('support_threads')
          .insert({ user_id: state.user.id }).select('id,user_id,created_at').single();
        if (created.error) throw created.error;
        thread = created.data;
      }
      var attachment = null;
      if (file) {
        attachment = thread.id + '/' + state.user.id + '/' + window.crypto.randomUUID() + '.' + extension;
        var upload = await sb.storage.from('support-attachments').upload(attachment, file, {
          contentType: file.type, upsert: false
        });
        if (upload.error) throw upload.error;
      }
      var posted = await sb.from('support_messages').insert({
        thread_id: thread.id, sender_id: state.user.id, body: body, attachment_path: attachment
      });
      if (posted.error) {
        if (attachment) await sb.storage.from('support-attachments').remove([attachment]);
        throw posted.error;
      }
      el('supportText').value = '';
      el('supportFile').value = '';
      await loadThreads(thread.id);
      status('쪽지를 보냈습니다. 답변은 이 대화에서 확인할 수 있습니다.');
    } catch (error) {
      console.error('Support send:', error);
      status('쪽지 전송에 실패했습니다. 내용을 확인하고 다시 시도해 주세요.', true);
    } finally { setBusy(false); }
  }
  document.querySelectorAll('[data-support-login]').forEach(function (button) {
    button.addEventListener('click', function () { login(button.dataset.supportLogin); });
  });
  el('newSupportThread').addEventListener('click', function () {
    state.selected = null;
    renderThreads();
    loadMessages();
    el('supportText').focus();
    status('');
  });
  el('refreshSupportThread').addEventListener('click', function () {
    if (!state.user) return;
    loadThreads().then(function () { status('최신 쪽지를 확인했습니다.'); })
      .catch(function () { status('대화를 불러오지 못했습니다.', true); });
  });
  el('supportForm').addEventListener('submit', submit);
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') window.setTimeout(initialize, 0);
  });
  initialize();
})();