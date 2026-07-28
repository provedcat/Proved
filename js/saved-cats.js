function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function setSavedCatLoadMessage(message, tone = 'gray') {
  const msg = document.getElementById('savedCatLoadMsg');
  if (!msg) return;

  msg.textContent = message;
  msg.className = `text-xs font-bold ${tone === 'red' ? 'text-red-400' : tone === 'blue' ? 'text-blue-400' : 'text-gray-400'}`;
  msg.classList.toggle('hidden', !message);
}

function setSaveFeedingRecordMessage(message, tone = 'blue') {
  const msg = document.getElementById('saveFeedingRecordMsg');
  if (!msg) return;

  msg.textContent = message;
  msg.className = `text-xs font-bold ${tone === 'red' ? 'text-red-400' : tone === 'blue' ? 'text-blue-400' : 'text-gray-400'} text-center`;
  msg.classList.toggle('hidden', !message);
}

function getTodayDateString() {
  const today = new Date();
  const timezoneOffsetMs = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function getCurrentCatInput() {
  const name = document.getElementById('catName')?.value.trim() || '';
  const birthDate = document.getElementById('catBirth')?.value || '';
  const neuteredValue = document.getElementById('catNeutered')?.value;
  const weightKg = parseFloat(document.getElementById('catWeight')?.value);

  return {
    name,
    birthDate,
    neutered: neuteredValue === 'true' ? true : neuteredValue === 'false' ? false : null,
    weightKg
  };
}

function isValidCatInput(catInput) {
  const birthDate = catInput.birthDate ? new Date(`${catInput.birthDate}T00:00:00`) : null;
  const today = new Date(`${getTodayDateString()}T00:00:00`);

  return !!(
    catInput.name &&
    birthDate &&
    !Number.isNaN(birthDate.getTime()) &&
    birthDate <= today &&
    typeof catInput.neutered === 'boolean' &&
    Number.isFinite(catInput.weightKg) &&
    catInput.weightKg >= 0.5 &&
    catInput.weightKg <= 20
  );
}

function getFeedingRecordSaveKey(catId, currentResult) {
  if (!catId || !currentResult) return null;
  return JSON.stringify({ catId, result: currentResult });
}

async function fetchMyCats(userId) {
  const { data, error } = await sb
    .from('cats')
    .select('id, name, birth_date, neutered')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function loadMyCats() {
  const list = document.getElementById('myCatList');
  if (!list) return;

  const { data: { user } } = await sb.auth.getUser();
  state.currentUser = user || null;

  if (!user) {
    setSavedCatLoadMessage('로그인하면 저장된 고양이 프로필을 불러올 수 있습니다.', 'gray');
    openAuthSheet?.();
    updateSaveFeedingButtonVisibility();
    return;
  }

  list.innerHTML = '';
  list.classList.add('hidden');
  setSavedCatLoadMessage('저장된 고양이를 불러오는 중입니다...', 'blue');

  let cats;
  try {
    cats = await fetchMyCats(user.id);
  } catch (error) {
    setSavedCatLoadMessage(`불러오기 실패: ${error.message}`, 'red');
    return;
  }

  if (!cats || cats.length === 0) {
    setSavedCatLoadMessage('저장된 고양이가 없습니다. 현재 입력값으로 계산 결과를 저장할 수 있습니다.', 'gray');
    return;
  }

  list.innerHTML = cats.map(cat => `
    <button type="button" data-cat-id="${escapeHtml(cat.id)}"
      class="w-full p-3 bg-white border border-blue-100 rounded-xl text-left hover:border-[#2F6FED] transition-colors">
      <span class="block text-sm font-black text-gray-800">${escapeHtml(cat.name || '이름 없음')}</span>
      <span class="block text-xs font-bold text-gray-400 mt-0.5">
        ${escapeHtml(cat.birth_date || '생년월일 없음')} · ${cat.neutered ? '중성화 O' : '중성화 X'}
      </span>
    </button>
  `).join('');
  list._cats = cats;
  list.onclick = e => {
    const button = e.target.closest('[data-cat-id]');
    if (!button) return;
    const cat = list._cats.find(item => item.id === button.dataset.catId);
    if (cat) {
      if (typeof setActivePet === 'function' && !state.isApplyingActivePet) {
        setActivePet({ ...cat, species: 'cat' }, { route: 'calculator' });
      } else {
        selectSavedCat(cat);
      }
    }
  };
  list.classList.remove('hidden');
  setSavedCatLoadMessage('불러올 고양이를 선택해주세요.', 'gray');
}

async function selectSavedCat(cat) {
  resetRecentFeedButtons();
  state.selectedSavedCatId = cat.id;
  const recentFeedsPromise = loadRecentFeedsForCat(cat.id);
  const shouldSyncSharedPet = !state.isApplyingActivePet;
  if (typeof provedApplyCurrentPetState === 'function' && shouldSyncSharedPet) {
    provedApplyCurrentPetState({ ...cat, species: 'cat' });
  } else if (typeof provedSetLastActivePet === 'function') {
    provedSetLastActivePet({ ...cat, species: 'cat' });
  }
  state.isApplyingSavedCat = true;

  try {
    document.getElementById('catName').value = cat.name || '';
    document.getElementById('catBirth').value = cat.birth_date || '';
    document.getElementById('catNeutered').value = cat.neutered ? 'true' : 'false';
    document.getElementById('catNeutered').dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    state.isApplyingSavedCat = false;
  }

  const weightInput = document.getElementById('catWeight');
  weightInput.value = '';
  document.getElementById('provedCurrentPetWeightDate')?.classList.add('hidden');
  setSavedCatLoadMessage(`${cat.name || '선택한 고양이'}의 최신 체중을 불러오는 중입니다...`, 'blue');

  const { data, error } = await sb
    .from('weight_records')
    .select('weight_kg, recorded_date')
    .eq('cat_id', cat.id)
    .eq('user_id', state.currentUser.id)
    .order('recorded_date', { ascending: false })
    .limit(1);

  if (error) {
    setSavedCatLoadMessage(`체중 불러오기 실패: ${error.message}`, 'red');
    updateCalorie();
    updateSaveFeedingButtonVisibility();
    await recentFeedsPromise;
    return;
  }

  const latestWeight = data?.[0];
  const headerWeightDate = document.getElementById('provedCurrentPetWeightDate');
  if (latestWeight) {
    weightInput.value = latestWeight.weight_kg;
    if (headerWeightDate) {
      headerWeightDate.textContent = `최근 체중 ${latestWeight.recorded_date.replaceAll('-', '.')} 기준`;
      headerWeightDate.classList.remove('hidden');
    }
    setSavedCatLoadMessage(`${cat.name || '선택한 고양이'} 정보를 불러왔습니다. 최신 체중 기준일: ${latestWeight.recorded_date}`, 'blue');
  } else {
    headerWeightDate?.classList.add('hidden');
    setSavedCatLoadMessage(`${cat.name || '선택한 고양이'} 정보를 불러왔습니다. 저장된 체중 기록은 없습니다.`, 'gray');
  }

  updateCalorie();
  updateSaveFeedingButtonVisibility();
  await recentFeedsPromise;

  if (
    shouldSyncSharedPet &&
    !state.isSyncingDirectPetSelection &&
    state.currentUser &&
    typeof selectTrendCat === 'function'
  ) {
    state.isSyncingDirectPetSelection = true;
    try {
      await selectTrendCat({ ...cat, species: 'cat' });
    } finally {
      state.isSyncingDirectPetSelection = false;
    }
  }
}

function updateSaveFeedingButtonVisibility() {
  const button = document.getElementById('saveFeedingRecordBtn');
  if (!button) return;

  const hasResult = !!state.lastResult;
  const isSaving = !!state.isSavingFeedingRecord;
  const currentSaveKey = getFeedingRecordSaveKey(state.selectedSavedCatId, state.lastResult);
  const isAlreadySaved = !!(hasResult && currentSaveKey && currentSaveKey === state.lastSavedResultKey);
  const canClick = hasResult && !state.isCalculationDirty && !isSaving && !isAlreadySaved;

  button.classList.toggle('hidden', !hasResult);
  button.disabled = !canClick;
  button.classList.toggle('bg-[#2F6FED]', canClick);
  button.classList.toggle('text-white', canClick);
  button.classList.toggle('bg-gray-200', !canClick);
  button.classList.toggle('text-gray-400', !canClick);
  button.classList.toggle('cursor-not-allowed', !canClick);
  button.classList.toggle('opacity-70', !canClick);

  if (isSaving) {
    button.textContent = '저장 중입니다...';
    setSaveFeedingRecordMessage('계산 결과를 저장하는 중입니다...', 'blue');
    return;
  }

  if (isAlreadySaved) {
    button.textContent = '저장 완료';
    setSaveFeedingRecordMessage('', 'gray');
    return;
  }

  button.textContent = '💾 이 계산 결과 저장하기';

  if (!hasResult) {
    setSaveFeedingRecordMessage('먼저 급여량을 계산해 주세요.', 'gray');
  } else if (!state.currentUser) {
    setSaveFeedingRecordMessage('로그인하면 현재 계산 결과를 저장할 수 있습니다.', 'gray');
  } else if (state.selectedSavedCatId) {
    setSaveFeedingRecordMessage('', 'gray');
  } else {
    setSaveFeedingRecordMessage('현재 입력값으로 새 고양이 프로필을 만들고 계산 결과를 저장할 수 있습니다.', 'gray');
  }
}

const DUPLICATE_CAT_NAME_BIRTH_DATE_MESSAGE = '같은 이름의 고양이가 이미 있습니다. 생년월일이 다르면 이름을 다르게 입력해 주세요.';

async function findExistingCatByName(userId, catInput) {
  const { data, error } = await sb
    .from('cats')
    .select('id, neutered, birth_date')
    .eq('user_id', userId)
    .eq('name', catInput.name)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function updateCatMutableFields(catId, userId, catInput) {
  const { data: cats, error: selectError } = await sb
    .from('cats')
    .select('id, neutered, birth_date')
    .eq('id', catId)
    .eq('user_id', userId)
    .limit(1);

  if (selectError) throw selectError;

  const cat = cats?.[0];
  if (!cat?.id) {
    throw new Error('고양이 프로필을 찾을 수 없습니다.');
  }

  const updates = {};
  if (cat.neutered !== catInput.neutered) {
    updates.neutered = catInput.neutered;
  }

  if (!cat.birth_date && catInput.birthDate) {
    updates.birth_date = catInput.birthDate;
  }

  if (Object.keys(updates).length === 0) return cat;

  const { data: updatedCats, error: updateError } = await sb
    .from('cats')
    .update(updates)
    .eq('id', catId)
    .eq('user_id', userId)
    .select('id, neutered, birth_date')
    .limit(1);

  if (updateError) throw updateError;
  return updatedCats?.[0] || { ...cat, ...updates };
}

async function createCatFromCurrentInput(userId, catInput) {
  const existingCat = await findExistingCatByName(userId, catInput);

  if (existingCat?.id) {
    if (existingCat.birth_date && catInput.birthDate && existingCat.birth_date !== catInput.birthDate) {
      throw new Error(DUPLICATE_CAT_NAME_BIRTH_DATE_MESSAGE);
    }

    await updateCatMutableFields(existingCat.id, userId, catInput);
    return { id: existingCat.id, reusedExisting: true };
  }

  const { count, error: countError } = await sb
    .from('cats')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw countError;
  if ((count || 0) >= 20) {
    throw new Error('현재 계정에는 고양이를 최대 20마리까지 저장할 수 있습니다.');
  }

  const { data, error } = await sb
    .from('cats')
    .insert({
      user_id: userId,
      name: catInput.name,
      birth_date: catInput.birthDate,
      neutered: catInput.neutered
    })
    .select('id')
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('고양이 프로필 생성 결과를 확인할 수 없습니다.');

  await upsertWeightRecord(data.id, userId, catInput.weightKg);
  return { id: data.id, reusedExisting: false };
}

async function upsertWeightRecord(catId, userId, weightKg) {
  const recordedDate = getTodayDateString();
  const payload = {
    cat_id: catId,
    user_id: userId,
    weight_kg: weightKg,
    recorded_date: recordedDate
  };

  const { error: upsertError } = await sb
    .from('weight_records')
    .upsert(payload, { onConflict: 'cat_id,recorded_date' });

  if (!upsertError) return;

  const { data: existingRows, error: selectError } = await sb
    .from('weight_records')
    .select('cat_id')
    .eq('cat_id', catId)
    .eq('user_id', userId)
    .eq('recorded_date', recordedDate)
    .limit(1);

  if (selectError) throw upsertError;

  if (existingRows && existingRows.length > 0) {
    const { error: updateError } = await sb
      .from('weight_records')
      .update({ weight_kg: weightKg })
      .eq('cat_id', catId)
      .eq('user_id', userId)
      .eq('recorded_date', recordedDate);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await sb
    .from('weight_records')
    .insert(payload);

  if (insertError) throw insertError;
}

async function saveFeedingRecord(catId, currentResult) {
  const userId = state.currentUser.id;
  const catInput = getCurrentCatInput();
  const recordedDate = getTodayDateString();

  try {
    await upsertWeightRecord(catId, userId, catInput.weightKg);
  } catch (error) {
    throw new Error(`체중 기록 저장 실패: ${error.message || error}`);
  }

  const { error } = await sb
    .from('feeding_records')
    .insert({
      user_id: userId,
      cat_id: catId,
      recorded_date: recordedDate,
      result_data: currentResult
    });

  if (error) {
    throw new Error(`계산 결과 저장 실패: ${error.message || error}`);
  }
}

async function handleSaveFeedingRecord() {
  if (state.isSavingFeedingRecord) return;

  state.isSavingFeedingRecord = true;
  updateSaveFeedingButtonVisibility();
  let finalMessage = null;
  let finalTone = 'blue';
  let shouldCloseShareModal = false;

  try {
    if (state.isCalculationDirty) {
      finalMessage = '입력값이 변경되었습니다. 다시 계산한 후 저장해 주세요.';
      finalTone = 'red';
      return;
    }

    const { data: { user } } = await sb.auth.getUser();
    state.currentUser = user || null;

    if (!user) {
      finalMessage = '로그인하면 현재 계산 결과를 저장할 수 있습니다.';
      finalTone = 'gray';
      openAuthSheet?.();
      return;
    }

    if (!state.lastResult) {
      finalMessage = '먼저 계산을 완료해 주세요.';
      finalTone = 'gray';
      return;
    }

    const catInput = getCurrentCatInput();
    if (!isValidCatInput(catInput)) {
      finalMessage = '고양이 이름, 생년월일, 중성화 여부, 체중을 확인해 주세요.';
      finalTone = 'red';
      return;
    }

    let catId = state.selectedSavedCatId;

    if (!catId) {
      const catSaveResult = await createCatFromCurrentInput(user.id, catInput);
      catId = catSaveResult.id;
      state.selectedSavedCatId = catId;
      await saveFeedingRecord(catId, state.lastResult);
      state.lastSavedResultKey = getFeedingRecordSaveKey(catId, state.lastResult);
      finalMessage = catSaveResult.reusedExisting
        ? '기존 고양이 프로필을 찾아 계산 결과를 저장했습니다.'
        : '현재 입력값으로 고양이 프로필을 만들고 계산 결과를 저장했습니다.';
    } else {
      await updateCatMutableFields(catId, user.id, catInput);
      await saveFeedingRecord(catId, state.lastResult);
      state.lastSavedResultKey = getFeedingRecordSaveKey(catId, state.lastResult);
      finalMessage = '계산 결과가 저장되었습니다.';
    }

    finalTone = 'blue';
    shouldCloseShareModal = true;
  } catch (error) {
    finalMessage = error.message === DUPLICATE_CAT_NAME_BIRTH_DATE_MESSAGE
      ? error.message
      : `저장에 실패했습니다. 데이터베이스 테이블 구조 또는 권한 정책을 확인해 주세요: ${error.message || error}`;
    finalTone = 'red';
  } finally {
    state.isSavingFeedingRecord = false;
    updateSaveFeedingButtonVisibility();
    if (finalMessage) setSaveFeedingRecordMessage(finalMessage, finalTone);
  }

  if (shouldCloseShareModal) {
    await new Promise(resolve => setTimeout(resolve, 850));
    if (typeof closeShareModal === 'function') closeShareModal();
  }
}
