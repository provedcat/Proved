// 화면에 렌더링된 '오늘의 급여 계획' 문서를 그대로 저장 이미지로 사용합니다.
function getFeedingPlanCaptureTarget() {
  const target = document.getElementById('feedingPlanDocument');
  if (!target) throw new Error('오늘의 급여 계획을 찾지 못했습니다.');
  return target;
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function waitForShareCardFonts() {
  if (!document.fonts?.ready) return;
  // iOS Safari can leave FontFaceSet.ready pending for a long time when a webfont
  // request stalls. Do not let optional font loading block the whole image flow.
  try {
    await withTimeout(document.fonts.ready, 1800, '폰트 로딩 시간이 초과되었습니다.');
  } catch (_) {
    // Continue with the available system fallback font.
  }
}

async function captureShareCardCanvas() {
  const captureTarget = getFeedingPlanCaptureTarget();
  await waitForShareCardFonts();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const rect = captureTarget.getBoundingClientRect();
  const captureWidth = Math.ceil(captureTarget.scrollWidth || rect.width);
  const captureHeight = Math.ceil(captureTarget.scrollHeight || rect.height);

  return await withTimeout(
    html2canvas(captureTarget, {
      backgroundColor: '#F8F6EF',
      scale: 2,
      useCORS: true,
      logging: false,
      width: captureWidth,
      height: captureHeight,
      windowWidth: Math.max(document.documentElement.clientWidth, captureWidth),
      windowHeight: Math.max(document.documentElement.clientHeight, captureHeight),
      scrollX: 0,
      scrollY: -window.scrollY
    }),
    12000,
    '이미지 생성 시간이 초과되었습니다.'
  );
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
    console.error('[저장용 이미지 생성 실패]', error);
    preview.innerHTML = '<p class="share-preview-loading">이미지를 만들지 못했습니다.<br>다시 시도해 주세요.</p>';
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
