(() => {
  const glossary = {
    dm: {
      title: 'DM · Dry Matter',
      body: '사료에서 수분을 제외한 뒤 영양성분의 비율을 다시 계산한 값입니다. 수분량이 다른 사료를 비교할 때 유용합니다.'
    },
    asfed: {
      title: 'As Fed · 급여 상태 기준',
      body: '수분을 포함한 실제 사료 상태에서 표시한 영양성분입니다. 사료 포장에서 흔히 보는 보증성분 수치가 여기에 해당합니다.'
    },
    kcal: {
      title: 'kcal · 킬로칼로리',
      body: '사료가 제공하는 에너지의 양을 나타내는 단위입니다. 급여량을 계산할 때 하루에 필요한 에너지와 사료의 열량을 맞춰 봅니다.'
    },
    me: {
      title: 'ME · Metabolizable Energy',
      body: '먹은 사료의 에너지 가운데 실제로 몸에서 이용할 수 있는 에너지를 뜻합니다. 한국어로는 대사에너지라고 합니다.'
    },
    energyDensity: {
      title: '열량 밀도',
      body: '같은 무게의 사료가 얼마나 많은 에너지를 내는지를 뜻합니다. 열량 밀도가 높으면 같은 kcal를 채우는 데 필요한 사료 무게가 더 적을 수 있습니다.'
    },
    nfe: {
      title: 'NFE · Nitrogen-Free Extract',
      body: '사료 전체 100%에서 단백질·지방·섬유·수분·회분을 빼 남은 값을 탄수화물의 참고값으로 추정한 것입니다. 직접 측정한 탄수화물 수치는 아닙니다.'
    },
    ash: {
      title: '회분',
      body: '사료를 태운 뒤 남는 무기질 성분을 묶어 나타낸 값입니다. 칼슘·인 같은 개별 미네랄 수치와는 다른 개념입니다.'
    },
    modifiedAtwater: {
      title: '수정 Atwater 계수',
      body: '사료의 단백질·지방·탄수화물이 어느 정도의 에너지를 내는지 추정할 때 사용하는 계산 계수입니다. 대표적으로 단백질 3.5, 지방 8.5, 탄수화물 3.5 kcal/g을 적용합니다.'
    },
    guaranteedAnalysis: {
      title: '보증성분',
      body: '사료 라벨에 표시되는 최소값 또는 최대값 중심의 영양성분입니다. 예를 들어 조단백 10% 이상은 실제 함량이 정확히 10%라는 뜻이 아닙니다.'
    }
  };

  function createPopover() {
    const popover = document.createElement('aside');
    popover.className = 'ed-term-popover';
    popover.id = 'ed-term-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-live', 'polite');
    popover.hidden = true;
    popover.innerHTML = `
      <button type="button" class="ed-term-popover__close" aria-label="용어 설명 닫기">×</button>
      <h2 class="ed-term-popover__title"></h2>
      <p class="ed-term-popover__body"></p>
    `;
    document.body.appendChild(popover);
    return popover;
  }

  function setupGlossary() {
    const popover = createPopover();
    const title = popover.querySelector('.ed-term-popover__title');
    const body = popover.querySelector('.ed-term-popover__body');
    const closeButton = popover.querySelector('.ed-term-popover__close');
    let activeTrigger = null;

    const close = (restoreFocus = false) => {
      if (popover.hidden) return;
      popover.hidden = true;
      if (activeTrigger) activeTrigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus && activeTrigger) activeTrigger.focus();
      activeTrigger = null;
    };

    const place = (trigger) => {
      const rect = trigger.getBoundingClientRect();
      const margin = 12;
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      let left = rect.left;
      let top = rect.bottom + 10;

      if (left + width > window.innerWidth - margin) {
        left = window.innerWidth - width - margin;
      }
      if (left < margin) left = margin;

      if (top + height > window.innerHeight - margin && rect.top - height - 10 > margin) {
        top = rect.top - height - 10;
      }

      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(Math.max(margin, top))}px`;
    };

    const open = (trigger) => {
      const key = trigger.dataset.edTerm;
      const item = glossary[key];
      if (!item) return;

      if (activeTrigger && activeTrigger !== trigger) {
        activeTrigger.setAttribute('aria-expanded', 'false');
      }

      activeTrigger = trigger;
      title.textContent = item.title;
      body.textContent = item.body;
      popover.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => place(trigger));
    };

    document.querySelectorAll('[data-ed-term]').forEach((trigger) => {
      trigger.setAttribute('aria-controls', popover.id);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (activeTrigger === trigger && !popover.hidden) {
          close();
        } else {
          open(trigger);
        }
      });
    });

    closeButton.addEventListener('click', () => close(true));

    document.addEventListener('click', (event) => {
      if (!popover.hidden && !popover.contains(event.target) && !event.target.closest('[data-ed-term]')) {
        close();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close(true);
    });

    window.addEventListener('resize', () => {
      if (activeTrigger && !popover.hidden) place(activeTrigger);
    });

    window.addEventListener('scroll', () => {
      if (activeTrigger && !popover.hidden) close();
    }, { passive: true });
  }

  function setupInfographicMotion() {
    const graphics = document.querySelectorAll('.ed-graphic[data-animate]');
    if (!graphics.length) return;

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      graphics.forEach((graphic) => graphic.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.24 });

    graphics.forEach((graphic) => observer.observe(graphic));
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupGlossary();
    setupInfographicMotion();
  });
})();
