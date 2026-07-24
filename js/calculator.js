function getAgeMonths(birth, today = new Date()) {
  return (today.getFullYear() - birth.getFullYear()) * 12
       + (today.getMonth() - birth.getMonth());
}

function getCaloriePlan(weight, birthStr, neutered, diet, today = new Date()) {
  const birth  = new Date(birthStr);
  const months = getAgeMonths(birth, today);
  const RER    = 70 * Math.pow(weight, 0.75);
  let f_age, label;

  if      (months < 4)    { f_age = 2.75; label = '초기 성장기'; }
  else if (months < 9)    { f_age = 2.1;  label = '중기 성장기'; }
  else if (months < 12)   { f_age = 1.9;  label = '후기 성장기'; }
  else if (months >= 132) { f_age = 1.1;  label = '노령묘'; }
  else { f_age = neutered ? 1.2 : 1.4; label = neutered ? '중성화 성묘' : '비중성화 성묘'; }

  const isLateGrowth = months >= 9 && months < 12;
  const f_neuter = (months < 12 && neutered) ? 0.85 : 1.0;
  const f_diet   = diet ? 0.9 : 1.0;

  let DER;
  let detail;
  let dietNotice = '';

  if (diet) {
    let finalFactor;
    let finalLabel;

    if (isLateGrowth && neutered) {
      finalFactor = 1.25;
      finalLabel = '후기 성장기 · 중성화 · 체중관리';
      dietNotice = '후기 성장기 고양이는 성장에 필요한 에너지가 남아 있어, 다이어트 모드에서는 성장기 계수를 그대로 곱하지 않고 체중관리 기준으로 계산합니다.';
    } else {
      finalFactor = f_age * f_neuter * f_diet;
      finalLabel = `${label}${f_neuter < 1 ? ' · 중성화' : ''} · 다이어트`;
    }

    DER = Math.round(RER * finalFactor);
    detail = `RER ${Math.round(RER)} × ${finalFactor} (${finalLabel})`;
  } else {
    DER = Math.round(RER * f_age * f_neuter);
    detail = `RER ${Math.round(RER)} × ${f_age} (${label})`;
    if (f_neuter < 1) detail += ` × ${f_neuter} (중성화)`;
  }

  return { DER, RER, months, f_age, f_neuter, f_diet, label, detail, dietNotice };
}

if (typeof module !== 'undefined') {
  module.exports = { getAgeMonths, getCaloriePlan };
}

function updateCalorie() {
  const weight   = parseFloat(document.getElementById('catWeight').value);
  const birthStr = document.getElementById('catBirth').value;
  if (!weight || !birthStr) return;

  const neutered = document.getElementById('catNeutered').value === 'true';
  const diet     = document.getElementById('isDiet').checked;
  const plan     = getCaloriePlan(weight, birthStr, neutered, diet);

  document.getElementById('derVal').textContent = plan.DER;
  document.getElementById('derDetail').textContent = plan.detail;
  const noticeEl = document.getElementById('dietNotice');
  if (noticeEl) {
    noticeEl.textContent = plan.dietNotice;
    noticeEl.classList.toggle('hidden', !plan.dietNotice);
  }
  document.getElementById('calBox').classList.remove('hidden');
}

// -----------------------------------------------
// 비율 슬라이더
// -----------------------------------------------
function updateRatio(v) {
  document.getElementById('dryPct').textContent = v;
  document.getElementById('wetPct').textContent = 100 - v;
}

// -----------------------------------------------
// 건사료 교체 토글
// -----------------------------------------------
function toggleDrySwitching() {
  const on   = document.getElementById('drySwitching').checked;
  const area = document.getElementById('dryArea2');
  const wrap = document.getElementById('drySwPctWrap1');
  if (on) {
    area.classList.remove('hidden');
    wrap.classList.remove('hidden');
    wrap.classList.add('flex');
  } else {
    area.classList.add('hidden');
    wrap.classList.remove('flex');
    wrap.classList.add('hidden');
    state.dryFeeds[1] = null;
    document.getElementById('dryInput2').value = '';
    document.getElementById('drySelected2').classList.add('hidden');
  }
}

// -----------------------------------------------
// 습식사료 슬롯 추가
// -----------------------------------------------
function addWetSlot() {
  if (state.wetSlotIds.length >= 3) return;

  const slotId  = state.wetSlotIdCounter++;
  const isFirst = state.wetSlotIds.length === 0;
  state.wetSlotIds.push(slotId);

  const slot = document.createElement('div');
  slot.id        = `wetSlot_${slotId}`;
  slot.className = 'relative';

  slot.innerHTML = `
    <div class="flex items-center bg-blue-50 rounded-2xl border border-blue-100 overflow-hidden">
      <input type="text" id="wetInput_${slotId}" placeholder="습식사료 검색..."
        class="flex-1 p-4 bg-transparent font-bold text-sm">
      ${!isFirst ? `
        <div class="flex items-center bg-blue-100 px-3 h-14">
          <input type="number" id="wetPct_${slotId}" value="50" min="0" max="100"
            class="w-10 bg-transparent text-center font-black text-blue-600 text-sm">
          <span class="text-xs font-black text-blue-400">%</span>
        </div>
        <button type="button" onclick="removeWetSlot(${slotId})"
          class="px-3 h-14 bg-blue-100 text-blue-300 font-black text-lg">✕</button>
      ` : ''}
    </div>
    <button type="button" onclick="openFeedPicker('wet', ${slotId})"
      class="mt-2 text-xs font-black text-blue-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
      제품 목록에서 찾기
    </button>
    <div id="wetList_${slotId}"
      class="absolute left-0 right-0 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl mt-1 max-h-48 overflow-y-auto hidden">
    </div>
    <p id="wetSelected_${slotId}" class="text-xs text-blue-400 font-bold mt-1 px-1 hidden"></p>
  `;

  document.getElementById('wetSlots').appendChild(slot);

  const input = document.getElementById(`wetInput_${slotId}`);
  input.addEventListener('input', () => searchFeed('wet', input.value, `wetList_${slotId}`, slotId));
  input.addEventListener('focus', () => searchFeed('wet', input.value, `wetList_${slotId}`, slotId));

  if (state.wetSlotIds.length >= 3) {
    document.getElementById('addWetBtn').classList.add('hidden');
  }
}

function removeWetSlot(slotId) {
  document.getElementById(`wetSlot_${slotId}`)?.remove();
  delete state.wetFeedMap[slotId];
  state.wetSlotIds = state.wetSlotIds.filter(id => id !== slotId);
  document.getElementById('addWetBtn').classList.remove('hidden');
}

// -----------------------------------------------
// 급여량 계산
// -----------------------------------------------
function calculate() {
  const weight   = parseFloat(document.getElementById('catWeight').value);
  const birthStr = document.getElementById('catBirth').value;

  if (!weight || !birthStr) {
    alert('체중과 생년월일을 입력해주세요.');
    return;
  }

  const neutered = document.getElementById('catNeutered').value === 'true';
  const diet     = document.getElementById('isDiet').checked;
  const { DER }  = getCaloriePlan(weight, birthStr, neutered, diet);

  const dryRatio  = parseInt(document.getElementById('dryPct').textContent) / 100;
  const wetRatio  = parseInt(document.getElementById('wetPct').textContent) / 100;
  const switching = document.getElementById('drySwitching').checked;

  let html = '';
  const resultData = { 건사료_결과: [], 습식사료_결과: [] };

  // 건사료 계산
  const dryFeeds = switching
    ? state.dryFeeds.filter(Boolean)
    : [state.dryFeeds[0]].filter(Boolean);

  const totalDrySubPct = switching
    ? dryFeeds.reduce((sum, _, i) => {
        const el = document.getElementById(`drySwPct${i + 1}`);
        return sum + (el ? parseInt(el.value) || 0 : 0);
      }, 0)
    : 100;

  dryFeeds.forEach((f, i) => {
    const subPct = switching
      ? (parseInt(document.getElementById(`drySwPct${i + 1}`)?.value) || 0) / (totalDrySubPct || 100)
      : 1;
    const kcal  = DER * dryRatio * subPct;
    const grams = Math.round(kcal / (f.kcal / 1000));
    html += `
      <div class="flex justify-between items-center p-4 bg-orange-50 rounded-2xl border border-orange-100">
        <div>
          <span class="text-[10px] font-black text-orange-400 uppercase">DRY</span>
          <p class="font-bold text-sm text-gray-800 mt-0.5">${f.name}</p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-black text-gray-900">${grams}g</p>
          <p class="text-xs text-gray-400">${Math.round(kcal)} kcal</p>
        </div>
      </div>`;
    resultData.건사료_결과.push({
      이름: f.name, 급여량_g: grams, 담당칼로리: Math.round(kcal),
      에너지기준_칼슘: f.ebCa, 에너지기준_인: f.ebP, 수분_pct: f.moisture
    });
  });

  // 습식사료 계산
  const wetEntries = state.wetSlotIds
    .map(sid => ({ sid, feed: state.wetFeedMap[sid] }))
    .filter(e => e.feed);
  const wetCount = wetEntries.length;

  wetEntries.forEach(({ sid, feed: f }) => {
    const isFirstWet = (sid === state.wetSlotIds[0]);
    const pctEl = document.getElementById(`wetPct_${sid}`);

    let subPct;
    if (wetCount === 1) {
      subPct = 1;
    } else if (!isFirstWet && pctEl) {
      subPct = (parseInt(pctEl.value) || 0) / 100;
    } else {
      const otherSum = wetEntries.reduce((sum, e) => {
        if (e.sid === sid) return sum;
        const el = document.getElementById(`wetPct_${e.sid}`);
        return sum + (el ? parseInt(el.value) || 0 : 0);
      }, 0);
      subPct = Math.max(0, 100 - otherSum) / 100;
    }

    const kcal  = DER * wetRatio * subPct;
    const grams = Math.round(kcal / (f.kcal / 1000));
    html += `
      <div class="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
        <div>
          <span class="text-[10px] font-black text-blue-400 uppercase">WET</span>
          <p class="font-bold text-sm text-gray-800 mt-0.5">${f.name}</p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-black text-gray-900">${grams}g</p>
          <p class="text-xs text-gray-400">${Math.round(kcal)} kcal</p>
        </div>
      </div>`;
    resultData.습식사료_결과.push({
      이름: f.name, 급여량_g: grams, 담당칼로리: Math.round(kcal),
      에너지기준_칼슘: f.ebCa, 에너지기준_인: f.ebP, 수분_pct: f.moisture
    });
  });

  if (!html) {
    html = '<p class="text-center text-gray-400 text-sm py-4">사료를 선택해주세요</p>';
  }

  document.getElementById('resDER').textContent = DER;
  document.getElementById('resItems').innerHTML  = html;
  document.getElementById('resultArea').classList.remove('hidden');
  document.getElementById('capBtn').classList.remove('hidden');
  document.getElementById('waterBtn').classList.remove('hidden');
  document.getElementById('openShareModalBtn').classList.remove('hidden');
  document.getElementById('capResult').classList.add('hidden');
  document.getElementById('waterResult').classList.add('hidden');

  state.lastResult = { DER, dryRatio, wetRatio, ...resultData };
  state.lastSavedResultKey = null;
  updateSaveFeedingButtonVisibility();
  document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth' });
}

// -----------------------------------------------
// 칼슘/인 분석
// -----------------------------------------------
function analyzeCaP() {
  if (!state.lastResult) return;

  const NRC = { 칼슘_권장: 280, 인_권장: 250, 비율_최소: 1.0, 비율_상한: 2.0 };
  const 모든사료 = [
    ...state.lastResult.건사료_결과.map(s => ({ ...s, 종류: '건사료' })),
    ...state.lastResult.습식사료_결과.map(s => ({ ...s, 종류: '습식사료' }))
  ];

  let 총칼슘 = 0, 총인 = 0;
  const 결과목록 = [], 제외목록 = [];

  모든사료.forEach(s => {
    if (s.에너지기준_칼슘 && s.에너지기준_인 && s.에너지기준_칼슘 > 0) {
      const ca = s.에너지기준_칼슘 * s.담당칼로리;
      const p  = s.에너지기준_인   * s.담당칼로리;
      총칼슘 += ca; 총인 += p;
      결과목록.push({ ...s, ca_mg: Math.round(ca), p_mg: Math.round(p) });
    } else {
      제외목록.push(s.이름);
    }
  });

  const ratio = 총인 > 0 ? (총칼슘 / 총인).toFixed(2) : null;
  const caOk  = 총칼슘 >= NRC.칼슘_권장 * (state.lastResult.DER / 1000);
  const pOk   = 총인   >= NRC.인_권장   * (state.lastResult.DER / 1000);
  const rOk   = ratio  && parseFloat(ratio) >= NRC.비율_최소 && parseFloat(ratio) <= NRC.비율_상한;

  const sc = ok => ok ? 'text-green-500' : 'text-red-400';
  const st = ok => ok ? '✅ 정상' : '⚠️ 확인필요';

  const html = `
    <div class="p-6 bg-gray-50 rounded-3xl space-y-4">
      <h3 class="font-black text-gray-800">📊 칼슘 · 인 분석</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-white p-4 rounded-2xl text-center">
          <p class="text-xs text-gray-400 mb-1">칼슘 섭취량</p>
          <p class="text-2xl font-black">${Math.round(총칼슘)}</p>
          <p class="text-xs text-gray-400">mg / day</p>
          <p class="text-xs font-bold mt-1 ${sc(caOk)}">${st(caOk)}</p>
        </div>
        <div class="bg-white p-4 rounded-2xl text-center">
          <p class="text-xs text-gray-400 mb-1">인 섭취량</p>
          <p class="text-2xl font-black">${Math.round(총인)}</p>
          <p class="text-xs text-gray-400">mg / day</p>
          <p class="text-xs font-bold mt-1 ${sc(pOk)}">${st(pOk)}</p>
        </div>
      </div>
      <div class="bg-white p-4 rounded-2xl text-center">
        <p class="text-xs text-gray-400 mb-1">칼슘 : 인 비율</p>
        <p class="text-3xl font-black ${rOk ? 'text-green-500' : 'text-red-400'}">${ratio ? ratio + ' : 1' : '계산불가'}</p>
        <p class="text-xs text-gray-400 mt-1">정상 범위 ${NRC.비율_최소} ~ ${NRC.비율_상한} : 1</p>
      </div>
      ${결과목록.map(s => `
        <div class="flex justify-between text-sm py-2 border-b border-gray-100">
          <span class="font-bold text-gray-600">${s.이름}</span>
          <span class="text-gray-400">Ca ${s.ca_mg}mg · P ${s.p_mg}mg</span>
        </div>`).join('')}
      ${제외목록.length ? `<p class="text-xs text-gray-300">※ 데이터 없어 제외: ${제외목록.join(', ')}</p>` : ''}
      <p class="text-xs text-gray-300 leading-relaxed">※ NRC 성묘 기준 참고값입니다.</p>
    </div>`;

  document.getElementById('capResult').innerHTML = html;
  document.getElementById('capResult').classList.remove('hidden');
  document.getElementById('capResult').scrollIntoView({ behavior: 'smooth' });
}

// -----------------------------------------------
// 수분 섭취량 분석
// -----------------------------------------------
function analyzeWater() {
  if (!state.lastResult) return;

  const weight    = parseFloat(document.getElementById('catWeight').value) || 0;
  const 권장_최소 = Math.round(weight * 44);
  const 권장_최대 = Math.round(weight * 55);
  const 모든사료 = [
    ...state.lastResult.건사료_결과.map(s => ({ ...s, 종류: '건사료' })),
    ...state.lastResult.습식사료_결과.map(s => ({ ...s, 종류: '습식사료' }))
  ];

  let 총수분_ml = 0;
  const 결과목록 = [], 제외목록 = [];

  모든사료.forEach(s => {
    if (s.수분_pct != null && s.수분_pct > 0) {
      const water_ml = parseFloat(((s.급여량_g * s.수분_pct) / 100).toFixed(1));
      총수분_ml += water_ml;
      결과목록.push({ ...s, water_ml });
    } else {
      제외목록.push(s.이름);
    }
  });

  총수분_ml = parseFloat(총수분_ml.toFixed(1));
  const ok         = 총수분_ml >= 권장_최소;
  const 부족분     = ok ? 0 : Math.round(권장_최소 - 총수분_ml);
  const 충족률     = 권장_최소 > 0 ? Math.round((총수분_ml / 권장_최소) * 100) : 0;
  const gaugeColor = 충족률 >= 100 ? '#22c55e' : 충족률 >= 70 ? '#f59e0b' : '#ef4444';
  const gaugeWidth = Math.min(충족률, 100);

  let statusMsg;
  if (총수분_ml === 0 && 결과목록.length === 0) {
    statusMsg = `<p class="text-sm text-gray-400 text-center py-2">수분 데이터가 있는 사료가 없습니다.</p>`;
  } else if (ok) {
    statusMsg = `<p class="text-sm font-bold text-green-500">✅ 사료만으로도 권장 수분 최소치 충족!</p>`;
  } else {
    statusMsg = `<p class="text-sm font-bold text-amber-500">💧 물그릇으로 약 <span class="text-lg font-black">${부족분}ml</span> 이상 추가 섭취 권장</p>`;
  }

  const html = `
    <div class="p-6 bg-gray-50 rounded-3xl space-y-4">
      <h3 class="font-black text-gray-800">💧 수분 섭취량 분석</h3>
      <div class="bg-white p-5 rounded-2xl space-y-3">
        <div class="flex justify-between items-end">
          <div>
            <p class="text-xs text-gray-400 mb-1">사료 통한 수분 섭취</p>
            <p class="text-4xl font-black text-[#38a8c5]">${총수분_ml}<span class="text-base font-bold text-gray-400 ml-1">ml</span></p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-400">권장 범위</p>
            <p class="text-sm font-black text-gray-600">${권장_최소}–${권장_최대} ml</p>
            <p class="text-xs text-gray-300">체중 ${weight}kg 기준</p>
          </div>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div class="h-3 rounded-full transition-all duration-500" style="width:${gaugeWidth}%; background:${gaugeColor};"></div>
        </div>
        <div class="flex justify-between text-[10px] text-gray-300 font-bold">
          <span>0ml</span>
          <span style="color:${gaugeColor}">${충족률}% 충족</span>
          <span>${권장_최소}ml</span>
        </div>
      </div>
      <div class="bg-white p-4 rounded-2xl">${statusMsg}</div>
      ${결과목록.length > 0 ? `<div class="space-y-2">
        ${결과목록.map(s => {
          const barW     = 총수분_ml > 0 ? Math.round((s.water_ml / 총수분_ml) * 100) : 0;
          const barColor = s.종류 === '습식사료' ? '#4a9af4' : '#f4a44a';
          return `
          <div class="bg-white p-4 rounded-2xl">
            <div class="flex justify-between items-center mb-2">
              <div>
                <span class="text-[10px] font-black uppercase" style="color:${barColor}">${s.종류 === '습식사료' ? 'WET' : 'DRY'}</span>
                <p class="font-bold text-sm text-gray-800">${s.이름}</p>
              </div>
              <div class="text-right">
                <p class="font-black text-gray-900">${s.water_ml}ml</p>
                <p class="text-xs text-gray-400">${s.수분_pct}% × ${s.급여량_g}g</p>
              </div>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div class="h-1.5 rounded-full" style="width:${barW}%; background:${barColor};"></div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}
      ${제외목록.length ? `<p class="text-xs text-gray-300">※ 수분 데이터 없어 제외: ${제외목록.join(', ')}</p>` : ''}
      <p class="text-xs text-gray-300 leading-relaxed">
        ※ WSAVA 기준 성묘 권장 수분 44~55ml/kg/day 참고값입니다.<br>
        ※ 물그릇 음수량은 포함되지 않습니다.
      </p>
    </div>`;

  document.getElementById('waterResult').innerHTML = html;
  document.getElementById('waterResult').classList.remove('hidden');
  document.getElementById('waterResult').scrollIntoView({ behavior: 'smooth' });
}
