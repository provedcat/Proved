// 저장해서 다시 보는 9:16 급여 계획 이미지만 생성합니다.
const FEEDING_SAVE_CARD_WIDTH = 540;
const FEEDING_SAVE_CARD_HEIGHT = 960;

function saveCardEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSaveCardModel() {
  if (!state.lastResult) throw new Error('계산 결과가 없습니다.');

  const result = state.lastResult;
  const feeds = [
    ...(result.건사료_결과 || []).map(feed => ({ ...feed, type: '건사료' })),
    ...(result.습식사료_결과 || []).map(feed => ({ ...feed, type: '습식사료' }))
  ];
  const weight = Number(document.getElementById('catWeight')?.value) || 0;
  let water = 0;
  let waterKnown = 0;

  feeds.forEach(feed => {
    const moisture = Number(feed.수분_pct);
    if (moisture > 0) {
      water += Number(feed.급여량_g || 0) * moisture / 100;
      waterKnown += 1;
    }
  });

  const waterIntake = Math.round(water * 10) / 10;
  const waterMin = weight > 0 ? Math.round(weight * 44) : null;
  const waterMax = weight > 0 ? Math.round(weight * 55) : null;
  const additionalWater = waterKnown && waterMin != null
    ? Math.max(0, Math.round(waterMin - waterIntake))
    : null;
  const missingWater = waterKnown < feeds.length;

  const now = new Date();
  const fallbackDate = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const species = result.species || state.selectedPetSpecies || 'cat';

  return {
    petName: document.getElementById('catName')?.value?.trim() || (species === 'dog' ? '내 강아지' : '내 고양이'),
    petProfile: document.getElementById('planPetProfile')?.textContent?.trim()
      || [weight ? `${weight} kg` : '', species === 'dog' ? 'DOG' : 'CAT'].filter(Boolean).join(' · '),
    date: document.getElementById('planDate')?.textContent?.trim() || fallbackDate,
    feeds,
    dailyKcal: Math.round(Number(result.DER) || 0),
    mealKcal: Math.round(Number(result.foodKcal) || 0),
    treatKcal: Math.round(Number(result.treatKcal) || 0),
    capRatio: document.getElementById('planCapRatio')?.textContent?.trim() || '데이터 없음',
    capStatus: document.getElementById('planCapStatus')?.textContent?.trim() || '',
    waterIntake: waterKnown ? `${waterIntake} ml` : '확인 불가',
    waterRange: waterMin != null ? `${waterMin}–${waterMax} ml` : '확인 불가',
    additionalWater: additionalWater == null ? '확인 불가' : `${additionalWater} ml`,
    waterNote: missingWater ? '확인된 수분 정보만 반영' : '사료 수분 기준',
    additionalWaterNote: additionalWater == null
      ? '수분 정보 확인 필요'
      : additionalWater === 0 ? '최소 참고량 충족' : '최소 참고량까지'
  };
}

function buildFeedingSaveCard() {
  document.getElementById('feedingPlanSaveCard')?.remove();
  const data = getSaveCardModel();
  const card = document.createElement('article');
  card.id = 'feedingPlanSaveCard';
  card.className = 'feeding-save-card';
  card.setAttribute('aria-hidden', 'true');

  const feedRows = data.feeds.map(feed => `
    <div class="feeding-save-card__feed">
      <div>
        <span>${feed.type}</span>
        <strong>${saveCardEscape(feed.이름)}</strong>
        <small>${Math.round(Number(feed.담당칼로리) || 0)} kcal</small>
      </div>
      <b>${Math.round(Number(feed.급여량_g) || 0)}<i>g</i></b>
    </div>`).join('');

  const kcalSub = data.treatKcal > 0
    ? `식사 ${data.mealKcal} · 간식 ${data.treatKcal} kcal`
    : `식사 ${data.mealKcal} kcal`;

  card.innerHTML = `
    <header class="feeding-save-card__header">
      <div><span>PROVED</span><h1>하루 급여 계획</h1></div>
      <time>${saveCardEscape(data.date)}</time>
    </header>

    <section class="feeding-save-card__pet">
      <h2>${saveCardEscape(data.petName)}</h2>
      <p>${saveCardEscape(data.petProfile)}</p>
    </section>

    <section class="feeding-save-card__feeds" aria-label="사료별 급여량">
      ${feedRows || '<p class="feeding-save-card__empty">급여 사료 정보가 없습니다.</p>'}
    </section>

    <section class="feeding-save-card__metrics" aria-label="하루 요약">
      <div><span>하루 에너지</span><strong>${data.dailyKcal}<i>kcal</i></strong><small>${kcalSub}</small></div>
      <div><span>Ca : P</span><strong>${saveCardEscape(data.capRatio)}</strong><small>${saveCardEscape(data.capStatus || '비율 확인')}</small></div>
      <div><span>사료로 섭취한 물</span><strong>${saveCardEscape(data.waterIntake)}</strong><small>참고 범위 ${saveCardEscape(data.waterRange)}</small></div>
      <div><span>추가로 마실 물</span><strong>${saveCardEscape(data.additionalWater)}</strong><small>${saveCardEscape(data.additionalWaterNote)}</small></div>
    </section>

    <footer><strong>proved.kr</strong></footer>`;

  document.body.appendChild(card);
  return card;
}

async function captureShareCardCanvas() {
  const captureTarget = buildFeedingSaveCard();
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return await html2canvas(captureTarget, {
      backgroundColor: '#F8F6EF',
      scale: 2,
      useCORS: true,
      logging: false,
      width: FEEDING_SAVE_CARD_WIDTH,
      height: FEEDING_SAVE_CARD_HEIGHT,
      windowWidth: FEEDING_SAVE_CARD_WIDTH,
      windowHeight: FEEDING_SAVE_CARD_HEIGHT
    });
  } finally {
    captureTarget.remove();
  }
}

async function openShareModal() {
  if (!state.lastResult || state.isCalculationDirty) {
    alert('입력값이 변경되었습니다. 다시 계산한 후 이미지를 저장해 주세요.');
    return;
  }

  const preview = document.getElementById('shareCard');
  preview.innerHTML = '<p class="share-preview-loading">저장용 이미지를 만드는 중…</p>';
  document.getElementById('shareModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const canvas = await captureShareCardCanvas();
    const image = new Image();
    image.id = 'sharePreviewImage';
    image.alt = '저장될 하루 급여 계획 이미지 미리보기';
    image.src = canvas.toDataURL('image/png');
    preview.replaceChildren(image);
  } catch (error) {
    preview.innerHTML = '<p class="share-preview-loading">미리보기를 만들지 못했습니다. 다시 시도해 주세요.</p>';
  }
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('open');
  document.body.style.overflow = '';
}

async function shareCard_save() {
  if (!state.lastResult || state.isCalculationDirty) return;
  const button = document.querySelector('.share-btn-save');
  const original = button.textContent;
  button.textContent = '생성 중…';
  button.disabled = true;

  try {
    const canvas = await captureShareCardCanvas();
    const petName = document.getElementById('catName')?.value?.trim() || (state.selectedPetSpecies === 'dog' ? 'dog' : 'cat');
    const link = document.createElement('a');
    link.download = `proved_${petName}_feeding-plan.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    alert('이미지 저장 실패: ' + error.message);
  } finally {
    button.textContent = original;
    button.disabled = false;
    if (typeof updateResultActionState === 'function') updateResultActionState();
  }
}
