// 04 결과에 보이는 급여 계획서 자체를 저장·공유합니다.
function openShareModal() {
  if (!state.lastResult || state.isCalculationDirty) {
    alert('입력값이 변경되었습니다. 다시 계산한 후 저장하거나 공유해 주세요.');
    return;
  }
  document.getElementById('shareModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('open');
  document.body.style.overflow = '';
}

async function captureShareCardCanvas() {
  const captureTarget = document.getElementById('feedingPlanDocument');
  if (!captureTarget) throw new Error('급여 계획서를 찾을 수 없습니다.');
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(resolve));
  return html2canvas(captureTarget, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
    width: Math.ceil(captureTarget.offsetWidth),
    height: Math.ceil(captureTarget.offsetHeight),
    windowWidth: document.documentElement.clientWidth,
    windowHeight: document.documentElement.clientHeight
  });
}

async function shareCard_save() {
  if (!state.lastResult || state.isCalculationDirty) return;
  const button = document.querySelector('.share-btn-save');
  const original = button.textContent;
  button.textContent = '생성 중…';
  button.disabled = true;
  try {
    const canvas = await captureShareCardCanvas();
    const petName = document.getElementById('catName').value || (state.selectedPetSpecies === 'dog' ? 'dog' : 'cat');
    const link = document.createElement('a');
    link.download = `proved_${petName}_feeding-plan.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    alert('이미지 저장 실패: ' + error.message);
  } finally {
    button.textContent = original;
    updateResultActionState();
  }
}

async function shareCard_kakao() {
  if (!state.lastResult || state.isCalculationDirty) return;
  const button = document.querySelector('.share-btn-kakao');
  const original = button.textContent;
  button.textContent = '이미지 생성 중…';
  button.disabled = true;
  try {
    const canvas = await captureShareCardCanvas();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const petName = document.getElementById('catName').value || 'pet';
    const file = new File([blob], `proved_${petName}_feeding-plan.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `${petName}의 하루 급여 계획` });
    } else {
      const link = document.createElement('a');
      link.download = file.name;
      link.href = canvas.toDataURL('image/png');
      link.click();
      alert('이미지를 저장했습니다. 원하는 앱에서 공유해 주세요.');
    }
  } catch (error) {
    if (error.name !== 'AbortError') alert('이미지 공유 실패: ' + error.message);
  } finally {
    button.textContent = original;
    updateResultActionState();
  }
}
