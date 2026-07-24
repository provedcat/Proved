function getTrendElement(id) {
  return document.getElementById(id);
}

function setWeightTrendMessage(message, tone = 'gray') {
  const msg = getTrendElement('trendCatMsg');
  if (!msg) return;

  msg.textContent = message;
  msg.className = `text-xs font-bold ${tone === 'red' ? 'text-red-400' : tone === 'blue' ? 'text-blue-400' : 'text-gray-400'}`;
  msg.classList.toggle('hidden', !message);
}

function setTrendEmptyMessage(message) {
  const msg = getTrendElement('trendEmptyMsg');
  if (!msg) return;

  msg.textContent = message;
  msg.classList.toggle('hidden', !message);
}

function resetWeightTrendView(message = '고양이를 선택하면 체중 그래프가 표시됩니다.') {
  if (window.weightTrendChartInstance) {
    window.weightTrendChartInstance.destroy();
    window.weightTrendChartInstance = null;
  }

  renderWeightTrendSummary([]);
  setTrendEmptyMessage(message);
}

async function refreshWeightTrendPage() {
  const loginNotice = getTrendElement('weightTrendLoginNotice');
  const content = getTrendElement('weightTrendContent');
  if (!loginNotice || !content) return;

  let user;
  if (typeof getCurrentUser === 'function') {
    user = await getCurrentUser();
  } else {
    const { data } = await sb.auth.getUser();
    user = data?.user || null;
  }
  state.currentUser = user;

  if (!user) {
    loginNotice.classList.remove('hidden');
    content.classList.add('hidden');
    setWeightTrendMessage('', 'gray');
    resetWeightTrendView('로그인하면 내 고양이의 체중 추이를 확인할 수 있습니다.');
    return;
  }

  loginNotice.classList.add('hidden');
  content.classList.remove('hidden');
  await loadTrendCats();
}

async function loadTrendCats() {
  const list = getTrendElement('trendCatList');
  if (!list) return;

  list.innerHTML = '';
  resetWeightTrendView();
  setWeightTrendMessage('저장된 고양이를 불러오는 중입니다...', 'blue');

  let cats;
  try {
    if (typeof fetchMyCats === 'function') {
      cats = await fetchMyCats(state.currentUser.id);
    } else {
      const { data, error } = await sb
        .from('cats')
        .select('id, name, birth_date, neutered')
        .eq('user_id', state.currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      cats = data || [];
    }
  } catch (error) {
    setWeightTrendMessage(`고양이 목록 불러오기 실패: ${error.message}`, 'red');
    return;
  }

  if (!cats.length) {
    setWeightTrendMessage('저장된 고양이가 없습니다. 급여 계산 결과를 저장하면 고양이별 체중 기록을 볼 수 있습니다.', 'gray');
    return;
  }

  list.innerHTML = cats.map(cat => `
    <div class="relative group">
      <button type="button" data-cat-id="${escapeHtml(cat.id)}"
        class="w-full p-4 pr-14 bg-gray-50 border border-gray-100 rounded-2xl text-left hover:border-[#2d7dd2] hover:bg-blue-50 transition-colors">
        <span class="block text-sm font-black text-gray-800">${escapeHtml(cat.name || '이름 없음')}</span>
        <span class="block text-xs font-bold text-gray-400 mt-1">
          ${escapeHtml(cat.birth_date || '생년월일 없음')} · ${cat.neutered ? '중성화 O' : '중성화 X'}
        </span>
      </button>
      <button type="button" data-cat-menu-button="${escapeHtml(cat.id)}" onclick="event.stopPropagation(); toggleTrendCatMenu(this.dataset.catMenuButton)"
        class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:text-[#2d7dd2] hover:border-[#2d7dd2] transition-all"
        aria-label="고양이 메뉴 열기">
        …
      </button>
      <div data-cat-menu="${escapeHtml(cat.id)}" class="hidden absolute right-3 top-12 z-20 min-w-[120px] rounded-xl border border-gray-100 bg-white p-1 shadow-lg">
        <button type="button" data-cat-delete="${escapeHtml(cat.id)}" onclick="event.stopPropagation(); deleteTrendCat(this.dataset.catDelete)"
          class="w-full rounded-lg px-3 py-2 text-left text-xs font-black text-red-500 hover:bg-red-50 transition-colors">
          삭제하기
        </button>
      </div>
    </div>
  `).join('');

  list._trendCats = cats;
  list.onclick = event => {
    const button = event.target.closest('[data-cat-id]');
    if (!button) return;

    closeTrendCatMenus();
    const cat = list._trendCats.find(item => String(item.id) === String(button.dataset.catId));
    if (cat) selectTrendCat(cat);
  };

  setWeightTrendMessage('체중 추이를 확인할 고양이를 선택해주세요.', 'gray');
}

function closeTrendCatMenus() {
  document.querySelectorAll('[data-cat-menu]').forEach(menu => {
    menu.classList.add('hidden');
  });
}

function toggleTrendCatMenu(catId) {
  const menu = Array.from(document.querySelectorAll('[data-cat-menu]'))
    .find(item => String(item.dataset.catMenu) === String(catId));
  if (!menu) return;

  const shouldOpen = menu.classList.contains('hidden');
  closeTrendCatMenus();
  menu.classList.toggle('hidden', !shouldOpen);
}

async function deleteTrendCat(catId) {
  if (!state.currentUser) {
    setWeightTrendMessage('로그인 후 삭제할 수 있습니다.', 'red');
    return;
  }

  const confirmed = confirm('이 고양이 프로필과 연결된 체중 기록, 급여 기록이 함께 삭제됩니다. 정말 삭제할까요?');
  if (!confirmed) return;

  closeTrendCatMenus();
  setWeightTrendMessage('고양이 기록을 삭제하는 중입니다...', 'blue');

  const userId = state.currentUser.id;

  try {
    const { error: feedingError } = await sb
      .from('feeding_records')
      .delete()
      .eq('cat_id', catId)
      .eq('user_id', userId);

    if (feedingError) throw new Error(`급여 기록 삭제 실패: ${feedingError.message}`);

    const { error: weightError } = await sb
      .from('weight_records')
      .delete()
      .eq('cat_id', catId)
      .eq('user_id', userId);

    if (weightError) throw new Error(`체중 기록 삭제 실패: ${weightError.message}`);

    const { error: catError } = await sb
      .from('cats')
      .delete()
      .eq('id', catId)
      .eq('user_id', userId);

    if (catError) throw new Error(`고양이 프로필 삭제 실패: ${catError.message}`);
  } catch (error) {
    setWeightTrendMessage(`삭제 실패: ${error.message} 일부 기록이 이미 삭제되었을 수 있으니 새로고침 후 확인해 주세요.`, 'red');
    return;
  }

  state.selectedTrendCatId = null;
  resetWeightTrendView('고양이를 선택하면 체중 그래프가 표시됩니다.');
  await loadTrendCats();
  setWeightTrendMessage('고양이 프로필과 연결 기록을 삭제했습니다.', 'blue');
}

async function selectTrendCat(cat) {
  const list = getTrendElement('trendCatList');
  if (list) {
    list.querySelectorAll('[data-cat-id]').forEach(button => {
      const isActive = String(button.dataset.catId) === String(cat.id);
      button.classList.toggle('bg-blue-50', isActive);
      button.classList.toggle('border-[#2d7dd2]', isActive);
      button.classList.toggle('bg-gray-50', !isActive);
      button.classList.toggle('border-gray-100', !isActive);
    });
  }

  state.selectedTrendCatId = cat.id;
  if (typeof provedSetLastActivePet === 'function') provedSetLastActivePet({ ...cat, species: 'cat' });
  setWeightTrendMessage(`${cat.name || '선택한 고양이'}의 체중 기록을 불러오는 중입니다...`, 'blue');
  setTrendEmptyMessage('');

  let records;
  try {
    records = await loadWeightRecordsForCat(cat.id);
  } catch (error) {
    setWeightTrendMessage(`체중 기록 불러오기 실패: ${error.message}`, 'red');
    resetWeightTrendView('체중 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }

  renderWeightTrendChart(records);
  renderWeightTrendSummary(records);

  if (!records.length) {
    setWeightTrendMessage('', 'gray');
    setTrendEmptyMessage('아직 저장된 체중 기록이 없습니다. 급여 계산 결과를 저장하면 체중 기록이 쌓입니다.');
    return;
  }

  setWeightTrendMessage(`${records.length}개의 체중 기록을 표시 중입니다.`, 'gray');
}

async function loadWeightRecordsForCat(catId) {
  const { data, error } = await sb
    .from('weight_records')
    .select('weight_kg, recorded_date')
    .eq('user_id', state.currentUser.id)
    .eq('cat_id', catId)
    .order('recorded_date', { ascending: true });

  if (error) throw error;

  return (data || [])
    .map(record => ({
      weight_kg: Number(record.weight_kg),
      recorded_date: record.recorded_date
    }))
    .filter(record => Number.isFinite(record.weight_kg) && record.recorded_date);
}

function renderWeightTrendChart(records) {
  const canvas = getTrendElement('weightTrendChart');
  if (!canvas) return;

  if (window.weightTrendChartInstance) {
    window.weightTrendChartInstance.destroy();
    window.weightTrendChartInstance = null;
  }

  if (!records.length) {
    return;
  }

  if (typeof Chart === 'undefined') {
    setTrendEmptyMessage('그래프 라이브러리를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.');
    return;
  }

  const weights = records.map(record => record.weight_kg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const padding = Math.max(0.2, (maxWeight - minWeight) * 0.15);

  window.weightTrendChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: records.map(record => record.recorded_date),
      datasets: [{
        label: '체중(kg)',
        data: weights,
        borderColor: '#2d7dd2',
        backgroundColor: 'rgba(45, 125, 210, 0.12)',
        borderWidth: 3,
        pointBackgroundColor: '#2d7dd2',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: records.length === 1 ? 6 : 4,
        pointHoverRadius: 7,
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#FFFFFF',
          titleColor: '#1A1A2E',
          bodyColor: '#2979FF',
          borderColor: '#E5E7EB',
          borderWidth: 1,
          cornerRadius: 10,
          displayColors: false,
          padding: 12,
          titleFont: { weight: '500' },
          bodyFont: { weight: 'bold' },
          callbacks: {
            label: context => `체중 : ${Number(context.parsed.y).toFixed(1)}kg`
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#9ca3af',
            font: {
              weight: 'bold'
            }
          }
        },
        y: {
          suggestedMin: Math.max(0, minWeight - padding),
          suggestedMax: maxWeight + padding,
          ticks: {
            color: '#9ca3af',
            callback: value => `${Number(value).toFixed(1)}kg`,
            font: {
              weight: 'bold'
            }
          },
          grid: {
            color: '#f3f4f6'
          }
        }
      }
    }
  });
}

function renderWeightTrendSummary(records) {
  const latestEl = getTrendElement('trendLatestWeight');
  const startEl = getTrendElement('trendStartWeight');
  const deltaEl = getTrendElement('trendWeightDelta');

  if (!latestEl || !startEl || !deltaEl) return;

  if (!records.length) {
    latestEl.textContent = '—';
    startEl.textContent = '—';
    deltaEl.textContent = '—';
    deltaEl.className = 'mt-1 text-lg font-black text-gray-800';
    return;
  }

  const startWeight = records[0].weight_kg;
  const latestWeight = records[records.length - 1].weight_kg;
  const delta = latestWeight - startWeight;
  const sign = delta > 0 ? '+' : '';

  latestEl.textContent = `${latestWeight.toFixed(1)}kg`;
  startEl.textContent = `${startWeight.toFixed(1)}kg`;
  deltaEl.textContent = `${sign}${delta.toFixed(1)}kg`;
  deltaEl.className = `mt-1 text-lg font-black ${delta > 0 ? 'text-blue-500' : delta < 0 ? 'text-orange-500' : 'text-gray-800'}`;
}

window.refreshWeightTrendPage = refreshWeightTrendPage;
window.loadTrendCats = loadTrendCats;
window.toggleTrendCatMenu = toggleTrendCatMenu;
window.closeTrendCatMenus = closeTrendCatMenus;
window.deleteTrendCat = deleteTrendCat;
window.selectTrendCat = selectTrendCat;
window.loadWeightRecordsForCat = loadWeightRecordsForCat;
window.renderWeightTrendChart = renderWeightTrendChart;
window.renderWeightTrendSummary = renderWeightTrendSummary;
window.setWeightTrendMessage = setWeightTrendMessage;
