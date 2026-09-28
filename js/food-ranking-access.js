(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const ALLOWED_USER_ID = '70720f7f-51c9-415a-948f-c676ede9a35d';

  const root = document.getElementById('myFitRestrictedRoot');
  const loading = document.getElementById('myFitAccessLoading');
  const denied = document.getElementById('myFitAccessDenied');

  function showDenied() {
    if (loading) loading.hidden = true;
    if (root) root.hidden = true;
    if (denied) denied.hidden = false;
  }

  function showAllowed() {
    if (loading) loading.hidden = true;
    if (denied) denied.hidden = true;
    if (root) root.hidden = false;
  }

  async function verifyAccess() {
    if (!window.supabase?.createClient) {
      showDenied();
      return;
    }

    try {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await client.auth.getUser();
      const user = error ? null : data?.user || null;

      if (user?.id === ALLOWED_USER_ID) {
        showAllowed();
        return;
      }

      showDenied();
    } catch (error) {
      console.warn('MY FIT access check failed:', error);
      showDenied();
    }
  }

  verifyAccess();
})();
