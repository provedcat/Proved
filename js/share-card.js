// ===============================================
// 🖼️ 공유 카드 시스템
// ===============================================

// -----------------------------------------------
// 모달 열기 — 계산 결과를 카드에 채워 넣고 모달 표시
// -----------------------------------------------
function openShareModal() {
  if (!state.lastResult || state.isCalculationDirty) {
    alert('입력값이 변경되었습니다. 다시 계산한 후 저장하거나 공유해 주세요.');
    return;
  }
  if (!fillShareCard()) return;

  document.getElementById('shareModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fillShareCard() {
  const result = state.lastResult;
  if (!result) { alert('먼저 급여량을 계산해주세요.'); return false; }

  // 고양이 기본 정보
  const isDog = state.selectedPetSpecies === 'dog';
  const catName  = document.getElementById('catName').value || (isDog ? '내 강아지' : '내 고양이');
  const weight   = parseFloat(document.getElementById('catWeight').value) || 0;
  const birthStr = document.getElementById('catBirth').value;
  const neutered = document.getElementById('catNeutered').value === 'true';

  // 나이 텍스트 계산
  let ageTxt = '';
  if (birthStr) {
    const today  = new Date();
    const birth  = new Date(birthStr);
    const months = (today.getFullYear() - birth.getFullYear()) * 12
                 + (today.getMonth() - birth.getMonth());
    ageTxt = months >= 12 ? Math.floor(months / 12) + '살' : months + '개월';
  }
  const subTxt = [weight ? weight + ' kg' : '', neutered ? '중성화' : '비중성화', ageTxt]
    .filter(Boolean).join(' · ');

  document.getElementById('sc_catName').textContent = catName;
  document.getElementById('sc_catSub').textContent  = subTxt;
  const brand = document.querySelector('.sc-brand');
  if (brand) brand.textContent = 'PROVED';
  document.getElementById('sc_der').textContent     = result.DER;
  document.getElementById('sc_foodKcal').textContent = result.foodKcal ?? result.DER;
  const treatBlock = document.getElementById('sc_treatBlock');
  treatBlock.style.display = result.treatKcal > 0 ? '' : 'none';
  document.getElementById('sc_treatKcal').textContent = result.treatKcal || 0;
  document.getElementById('sc_treatPct').textContent = ` kcal · ${Math.round((result.treatReservePct || 0) * 100)}%`;

  // 비율 바
  const dryPct = Math.round((result.dryRatio || 0) * 100);
  const wetPct = 100 - dryPct;
  document.getElementById('sc_drySeg').style.width   = dryPct + '%';
  document.getElementById('sc_ratioTxt').textContent = `DRY ${dryPct}% · WET ${wetPct}%`;

  // 사료 목록
  const allFeeds = [
    ...(result.건사료_결과 || []).map(f => ({ ...f, 종류: 'DRY', 색상: '#FF9F43' })),
    ...(result.습식사료_결과 || []).map(f => ({ ...f, 종류: 'WET', 색상: '#3D8BFF' }))
  ];

  document.getElementById('sc_feedList').innerHTML = allFeeds.map(f => `
    <div class="sc-feed-row" style="margin-bottom:7px">
      <div class="sc-feed-dot" style="background:${f.색상}"></div>
      <div class="sc-feed-info">
        <div class="sc-feed-type">${f.종류}</div>
        <div class="sc-feed-name">${f.이름}</div>
      </div>
      <div class="sc-feed-right">
        <div class="sc-feed-g">${f.급여량_g}g</div>
        <div class="sc-feed-kcal">${f.담당칼로리} kcal</div>
      </div>
    </div>`).join('');

  // Ca:P 분석
  let 총칼슘 = 0, 총인 = 0;
  allFeeds.forEach(f => {
    if (f.에너지기준_칼슘 > 0 && f.에너지기준_인 > 0) {
      총칼슘 += f.에너지기준_칼슘 * f.담당칼로리;
      총인   += f.에너지기준_인   * f.담당칼로리;
    }
  });
  const ratio = 총인 > 0 ? (총칼슘 / 총인) : null;
  if (ratio !== null) {
    const capOk = ratio >= 1.0 && ratio <= 2.0;
    document.getElementById('sc_capRatio').textContent  = ratio.toFixed(2) + ' : 1';
    document.getElementById('sc_capRatio').className    = 'sc-an-val ' + (capOk ? 'color-ok' : 'color-warn');
    document.getElementById('sc_capStatus').textContent = capOk ? '✓ 정상' : '⚠ 확인필요';
    document.getElementById('sc_capStatus').className   = 'sc-an-sub ' + (capOk ? 'color-ok' : 'color-warn');
    document.getElementById('sc_ca').textContent = Math.round(총칼슘);
    document.getElementById('sc_p').textContent  = Math.round(총인);
  } else {
    document.getElementById('sc_capRatio').textContent  = '데이터 없음';
    document.getElementById('sc_capRatio').className    = 'sc-an-val';
    document.getElementById('sc_capStatus').textContent = '';
    document.getElementById('sc_ca').textContent = '—';
    document.getElementById('sc_p').textContent  = '—';
  }

  // 수분 분석
  let 총수분 = 0;
  allFeeds.forEach(f => {
    if (f.수분_pct != null && f.수분_pct > 0) {
      총수분 += (f.급여량_g * f.수분_pct) / 100;
    }
  });
  총수분 = Math.round(총수분 * 10) / 10;

  const 권장최소  = Math.round(weight * 44);
  const 권장최대  = Math.round(weight * 55);
  const 충족률    = 권장최소 > 0 ? Math.min(100, Math.round((총수분 / 권장최소) * 100)) : 0;
  const 수분OK    = 총수분 >= 권장최소;
  const 게이지색  = 충족률 >= 100 ? '#4ade80' : 충족률 >= 70 ? '#fbbf24' : '#f87171';

  document.getElementById('sc_waterMl').textContent             = 총수분 + ' ml';
  document.getElementById('sc_waterPct').textContent            = 충족률 + '% 충족';
  document.getElementById('sc_waterPct').className              = 'sc-an-sub ' + (수분OK ? 'color-ok' : 'color-warn');
  document.getElementById('sc_waterGauge').style.width          = 충족률 + '%';
  document.getElementById('sc_waterGauge').style.background     = 게이지색;
  document.getElementById('sc_waterRange').textContent          = `권장 ${권장최소}–${권장최대} ml`;
  document.getElementById('sc_waterStatus').textContent         = 수분OK
    ? '✓ 사료만으로 권장치 충족!'
    : `물그릇으로 ${Math.round(권장최소 - 총수분)}ml 이상 추가 필요`;
  document.getElementById('sc_waterStatus').className = 'sc-an-sub ' + (수분OK ? 'color-ok' : 'color-warn');

  // 날짜
  const today = new Date();
  document.getElementById('sc_date').textContent =
    today.getFullYear() + '. ' +
    String(today.getMonth() + 1).padStart(2, '0') + '. ' +
    String(today.getDate()).padStart(2, '0');

  return true;
}

// -----------------------------------------------
// 모달 닫기
// -----------------------------------------------
function closeShareModal() {
  document.getElementById('shareModal').classList.remove('open');
  document.body.style.overflow = '';
}

// -----------------------------------------------
// 이미지 캡처 공통 처리
// html2canvas가 화면 카드와 같은 폭/높이/폰트 상태로 렌더링하도록 고정
// -----------------------------------------------
async function captureShareCardCanvas() {
  const captureTarget = document.getElementById('shareCard');
  const prevStyle = captureTarget.getAttribute('style') || '';

  captureTarget.style.cssText = `
    width: 360px !important;
    max-width: 360px !important;
    box-sizing: border-box !important;
    transform: none !important;
    zoom: 1 !important;
    position: fixed !important;
    top: -9999px !important;
    left: -9999px !important;
  `;

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // 스타일/폰트 적용 후 실제 레이아웃 치수를 확정하기 위해 한 프레임 대기
    await new Promise(resolve => requestAnimationFrame(() => resolve()));

    const captureWidth = Math.ceil(captureTarget.offsetWidth);
    const captureHeight = Math.ceil(captureTarget.offsetHeight);

    return await html2canvas(captureTarget, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureTarget.scrollWidth,
      windowHeight: captureTarget.scrollHeight
    });
  } finally {
    captureTarget.setAttribute('style', prevStyle);
  }
}

// -----------------------------------------------
// 이미지 저장
// html2canvas로 카드를 PNG로 캡처해서 다운로드
// -----------------------------------------------
async function shareCard_save() {
  if (!state.lastResult || state.isCalculationDirty) {
    alert('입력값이 변경되었습니다. 다시 계산한 후 저장하거나 공유해 주세요.');
    return;
  }
  const btn = document.querySelector('.share-btn-save');
  const 원래텍스트 = btn.textContent;
  btn.textContent = '⏳ 생성 중...';
  btn.disabled = true;

  try {
    const canvas = await captureShareCardCanvas();

    const link = document.createElement('a');
    const catName = document.getElementById('catName').value || 'cat';
    link.download = `${state.selectedPetSpecies === 'dog' ? 'proveddog' : 'provedcat'}_${catName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

  } catch (err) {
    alert('이미지 저장 실패: ' + err.message);
  }

  btn.textContent = 원래텍스트;
  updateResultActionState();
}

// -----------------------------------------------
// 이미지 공유
// 앱 키 설정 전: 링크 복사로 대체
// 앱 키 설정 후: 카카오 피드 공유
// -----------------------------------------------
async function shareCard_kakao() {
  if (!state.lastResult || state.isCalculationDirty) {
    alert('입력값이 변경되었습니다. 다시 계산한 후 저장하거나 공유해 주세요.');
    return;
  }
  const btn = document.querySelector('.share-btn-kakao');
  const 원래텍스트 = btn.textContent;
  btn.textContent = '⏳ 이미지 생성 중...';
  btn.disabled = true;

  try {
    const canvas = await captureShareCardCanvas();

    // Blob으로 변환
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const catName = document.getElementById('catName').value || 'cat';
    const brandName = state.selectedPetSpecies === 'dog' ? '프루브' : '프루브';
    const file = new File([blob], `${brandName.toLowerCase()}_${catName}.png`, { type: 'image/png' });

    // Web Share API (모바일 기기 공유 시트 — 카카오톡 포함)
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${catName}의 급여 플랜`,
        text: `${brandName}으로 계산한 ${catName}의 하루 급여 플랜이에요`
      });
    } else {
      // Web Share API 미지원 환경(PC 등) → 이미지 다운로드로 대체
      const link = document.createElement('a');
      link.download = `${brandName.toLowerCase()}_${catName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      alert('PC에서는 이미지를 저장 후 카카오톡에 직접 올려주세요.');
    }

  } catch (err) {
    if (err.name !== 'AbortError') {
      alert('공유 실패: ' + err.message);
    }
  }

  btn.textContent = 원래텍스트;
  updateResultActionState();
}
