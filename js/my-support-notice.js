(function () {
  'use strict';
  if (!window.supabase) return;
  var node = document.getElementById('mySupportNotice');
  if (!node) return;
  var sb = window.supabase.createClient(
    'https://qpklvtgnhrdmzxzlstpp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM'
  );
  async function refresh() {
    node.classList.remove('has-unread');
    node.textContent = '받은 답변 확인하기';
    var userResponse = await sb.auth.getUser();
    var user = userResponse.data && userResponse.data.user;
    if (!user) return;
    var op = await sb.from('support_operators').select('user_id').eq('user_id', user.id).maybeSingle();
    if (op.error) return;
    var operator = Boolean(op.data);
    var threadsQuery = sb.from('support_threads').select('id');
    if (!operator) threadsQuery = threadsQuery.eq('user_id', user.id);
    var response = await threadsQuery.limit(300);
    if (response.error || !response.data || !response.data.length) {
      node.textContent = operator ? '접수된 쪽지 없음' : '아직 쪽지가 없습니다';
      return;
    }
    var ids = response.data.map(function (thread) { return thread.id; });
    var data = await Promise.all([
      sb.from('support_reads').select('thread_id,last_read_at').eq('user_id', user.id).in('thread_id', ids),
      sb.from('support_messages').select('thread_id,created_at').in('thread_id', ids)
        .neq('sender_id', user.id).order('created_at', { ascending: false }).limit(1000)
    ]);
    if (data[0].error || data[1].error) return;
    var lastReads = new Map((data[0].data || []).map(function (row) {
      return [row.thread_id, row.last_read_at];
    }));
    var unread = new Set();
    (data[1].data || []).forEach(function (message) {
      var read = lastReads.get(message.thread_id);
      if (!read || new Date(message.created_at) > new Date(read)) unread.add(message.thread_id);
    });
    node.textContent = unread.size
      ? (operator ? '미확인 쪽지 ' : '새 답변이 있는 대화 ') + unread.size + '건'
      : '새 답변 없음';
    node.classList.toggle('has-unread', unread.size > 0);
  }
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') window.setTimeout(function () {
      refresh().catch(function () {});
    }, 0);
  });
  refresh().catch(function () {});
})();