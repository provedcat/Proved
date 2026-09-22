(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  const PET_PALETTE = [
    { accent: '#C3C7F4', soft: '#EEF0FF' },
    { accent: '#C8A8E9', soft: '#F3EAFA' },
    { accent: '#E3AADD', soft: '#F8EAF6' },
    { accent: '#F6BCBA', soft: '#FCEAE8' },
    { accent: '#F2DDDC', soft: '#FAF1F0' },
    { accent: '#C7B8FF', soft: '#F2EEFF' }
  ];

  let chartInstance = null;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function hashText(value) {
    let hash = 0;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  function paletteForPet(pet) {
    return PET_PALETTE[hashText(pet.id || pet.name) % PET_PALETTE.length];
  }

  function speciesLabel(species) {
    return species === 'dog' ? '강아지' : '고양이';
  }

  function petIcon(species) {
    if (species === 'dog') {
      return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20 19c-5-8-12-6-12 2 0 6 4 11 9 13"/><path d="M44 19c5-8 12-6 12 2 0 6-4 11-9 13"/>' +
        '<path d="M18 28c0-10 6-17 14-17s14 7 14 17v9c0 10-6 17-14 17S18 47 18 37z"/>' +
        '<circle cx="26" cy="31" r="1.5" fill="currentColor" stroke="none"/><circle cx="38" cy="31" r="1.5" fill="currentColor" stroke="none"/>' +
        '<path d="M29 39c2-2 4-2 6 0-1 3-5 3-6 0z"/><path d="M32 42v3"/>' +
        '</svg>';
    }

    return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 24 15 9l13 9M46 24 49 9 36 18"/><path d="M17 28c0-10 6-17 15-17s15 7 15 17v10c0 10-6 17-15 17S17 48 17 38z"/>' +
      '<circle cx="26" cy="31" r="1.5" fill="currentColor" stroke="none"/><circle cx="38" cy="31" r="1.5" fill="currentColor" stroke="none"/>' +
      '<path d="M29 39c2-2 4-2 6 0-1 3-5 3-6 0z"/><path d="M32 42v3M22 41l-10 1M22 45l-9 4M42 41l10 1M42 45l9 4"/>' +
      '</svg>';
  }

  function calculateAgeLabel(birthDate) {
    if (!birthDate) return '나이 정보 없음';
    const birth = new Date(birthDate + 'T00:00:00');
    if (Number.isNaN(birth.getTime())) return '나이 정보 없음';

    const today = new Date();
    let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
    if (today.getDate() < birth.getDate()) months -= 1;
    if (months < 0) return '나이 정보 없음';

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return Math.max(1, remainingMonths) + '개월';
    if (remainingMonths === 0) return years + '살';
    return years + '살 ' + remainingMonths + '개월';
  }

  function formatWeight(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(1) + 'kg' : '—';
  }

  function formatDate(value) {
    if (!value) return '날짜 없음';
    const parts = String(value).split('-');
    if (parts.length !== 3) return value;
    return Number(parts[1]) + '.' + Number(parts[2]);
  }

  function showGate(message) {
    $('myPetContent').hidden = true;
    $('myPetGate').hidden = false;
    $('myPetGateMessage').textContent = message;
  }

  function showContent() {
    $('myPetGate').hidden = true;
    $('myPetContent').hidden = false;
  }

  async function loadPet(userId, petId) {
    const response = await sb
      .from('pets')
      .select('id,name,birth_date,neutered,species')
      .eq('user_id', userId)
      .eq('id', petId)
      .limit(1);

    if (response.error) throw response.error;
    return response.data && response.data[0] ? response.data[0] : null;
  }

  async function loadWeightRecords(userId, petId) {
    const response = await sb
      .from('weight_records')
      .select('weight_kg,recorded_date')
      .eq('user_id', userId)
      .eq('pet_id', petId)
      .order('recorded_date', { ascending: true });

    if (response.error) throw response.error;
    return (response.data || [])
      .map(function (row) {
        return {
          weight_kg: Number(row.weight_kg),
          recorded_date: row.recorded_date
        };
      })
      .filter(function (row) {
        return Number.isFinite(row.weight_kg) && row.recorded_date;
      });
  }

  async function loadFeedingRecords(userId, petId) {
    const response = await sb
      .from('feeding_records')
      .select('recorded_date,result_data')
      .eq('user_id', userId)
      .eq('pet_id', petId)
      .order('recorded_date', { ascending: false })
      .limit(12);

    if (response.error) throw response.error;
    return response.data || [];
  }

  function renderHeroAndProfile(pet, weights) {
    const palette = paletteForPet(pet);
    const latestWeight = weights.length ? weights[weights.length - 1].weight_kg : null;
    const hero = $('myPetHero');
    hero.style.setProperty('--pet-accent', palette.accent);
    hero.style.setProperty('--pet-soft', palette.soft);

    $('myPetHeroIcon').innerHTML = petIcon(pet.species);
    $('myPetName').textContent = pet.name || '이름 없음';
    $('myPetHeroMeta').textContent = [
      speciesLabel(pet.species),
      calculateAgeLabel(pet.birth_date),
      pet.neutered ? '중성화 완료' : '중성화 안 함'
    ].join(' · ');

    document.title = (pet.name || '반려동물') + ' | 프루브';

    $('myPetProfile').innerHTML = [
      ['최근 체중', formatWeight(latestWeight)],
      ['나이', calculateAgeLabel(pet.birth_date)],
      ['중성화', pet.neutered ? '완료' : '안 함'],
      ['반려동물', speciesLabel(pet.species)]
    ].map(function (item) {
      return '<div><dt>' + escapeHtml(item[0]) + '</dt><dd>' + escapeHtml(item[1]) + '</dd></div>';
    }).join('');
  }

  function renderWeightSummary(records) {
    const latest = records.length ? records[records.length - 1].weight_kg : null;
    const start = records.length ? records[0].weight_kg : null;
    const delta = Number.isFinite(latest) && Number.isFinite(start) ? latest - start : null;

    $('petLatestWeight').textContent = formatWeight(latest);
    $('petStartWeight').textContent = formatWeight(start);
    $('petWeightDelta').textContent = Number.isFinite(delta)
      ? (delta > 0 ? '+' : '') + delta.toFixed(1) + 'kg'
      : '—';
  }

  function renderWeightChart(records, pet) {
    const empty = $('petWeightEmpty');
    const canvas = $('petWeightChart');

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    renderWeightSummary(records);

    if (!records.length) {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = '아직 저장된 체중 기록이 없습니다. 급여 계산 결과를 저장하면 체중 기록이 이곳에 쌓입니다.';
      return;
    }

    canvas.hidden = false;
    empty.hidden = true;

    if (typeof Chart === 'undefined') {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = '체중 그래프를 불러오지 못했습니다.';
      return;
    }

    const palette = paletteForPet(pet);
    const weights = records.map(function (row) { return row.weight_kg; });
    const minWeight = Math.min.apply(null, weights);
    const maxWeight = Math.max.apply(null, weights);
    const padding = Math.max(0.2, (maxWeight - minWeight) * 0.18);

    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: records.map(function (row) { return formatDate(row.recorded_date); }),
        datasets: [{
          data: weights,
          borderColor: palette.accent,
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointBackgroundColor: palette.accent,
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: records.length === 1 ? 6 : 4,
          pointHoverRadius: 6,
          tension: 0.34,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: '#FFFFFF',
            titleColor: '#2E3147',
            bodyColor: '#3568FF',
            borderColor: '#E4E1EF',
            borderWidth: 1,
            callbacks: {
              label: function (context) {
                return Number(context.parsed.y).toFixed(1) + 'kg';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#8B90A0', font: { size: 11, weight: '600' } }
          },
          y: {
            suggestedMin: Math.max(0, minWeight - padding),
            suggestedMax: maxWeight + padding,
            grid: { color: 'rgba(112,102,156,.10)' },
            ticks: {
              color: '#8B90A0',
              font: { size: 11, weight: '600' },
              callback: function (value) { return Number(value).toFixed(1); }
            }
          }
        }
      }
    });
  }

  function getFoodsFromResult(resultData) {
    const result = resultData && typeof resultData === 'object' ? resultData : {};
    const dry = Array.isArray(result.건사료_결과) ? result.건사료_결과.map(function (item) {
      return { type: '건식', item: item };
    }) : [];
    const wet = Array.isArray(result.습식사료_결과) ? result.습식사료_결과.map(function (item) {
      return { type: '습식', item: item };
    }) : [];
    return dry.concat(wet);
  }

  function renderCurrentDiet(records) {
    const container = $('myPetDiet');
    const date = $('myPetDietDate');

    if (!records.length) {
      date.textContent = '';
      container.innerHTML = '<p class="my-pet-section-empty">저장된 급여 계산이 없어 현재 식단을 표시할 수 없습니다.</p>';
      return;
    }

    const latest = records[0];
    const foods = getFoodsFromResult(latest.result_data);

    date.textContent = latest.recorded_date ? '최근 저장 ' + latest.recorded_date : '';

    if (!foods.length) {
      container.innerHTML = '<p class="my-pet-section-empty">최근 계산 기록에 저장된 사료 정보가 없습니다.</p>';
      return;
    }

    container.innerHTML = foods.map(function (entry) {
      const grams = Number(entry.item.급여량_g);
      const kcal = Number(entry.item.담당칼로리);
      return '<article class="my-pet-diet-row">' +
        '<span>' + escapeHtml(entry.type) + '</span>' +
        '<div><strong>' + escapeHtml(entry.item.이름 || '제품명 없음') + '</strong>' +
        '<p>' + (Number.isFinite(kcal) ? escapeHtml(String(kcal)) + ' kcal' : '열량 정보 없음') + '</p></div>' +
        '<b>' + (Number.isFinite(grams) ? escapeHtml(String(grams)) + 'g' : '—') + '</b>' +
        '</article>';
    }).join('');
  }

  function renderRecentCalculations(records) {
    const container = $('myPetCalculations');
    if (!records.length) {
      container.innerHTML = '<p class="my-pet-section-empty">아직 저장된 급여 계산 기록이 없습니다.</p>';
      return;
    }

    container.innerHTML = records.slice(0, 3).map(function (record) {
      const result = record.result_data && typeof record.result_data === 'object' ? record.result_data : {};
      const foods = getFoodsFromResult(result);
      const dryGrams = foods
        .filter(function (entry) { return entry.type === '건식'; })
        .reduce(function (sum, entry) { return sum + (Number(entry.item.급여량_g) || 0); }, 0);
      const wetGrams = foods
        .filter(function (entry) { return entry.type === '습식'; })
        .reduce(function (sum, entry) { return sum + (Number(entry.item.급여량_g) || 0); }, 0);
      const totalKcal = Number(result.foodKcal);
      const gramParts = [];
      if (dryGrams > 0) gramParts.push('건식 ' + dryGrams + 'g');
      if (wetGrams > 0) gramParts.push('습식 ' + wetGrams + 'g');

      return '<article class="my-pet-record">' +
        '<time datetime="' + escapeHtml(record.recorded_date || '') + '">' + escapeHtml(formatDate(record.recorded_date)) + '</time>' +
        '<div><strong>' + escapeHtml(gramParts.join(' + ') || '급여량 기록') + '</strong>' +
        '<p>' + escapeHtml(foods.map(function (entry) { return entry.item.이름; }).filter(Boolean).join(' · ') || '사료 정보 없음') + '</p></div>' +
        '<span>' + (Number.isFinite(totalKcal) ? escapeHtml(String(Math.round(totalKcal))) + ' kcal' : '') + '</span>' +
        '</article>';
    }).join('');
  }

  async function init() {
    const petId = new URLSearchParams(window.location.search).get('id');
    if (!petId) {
      showGate('반려동물 정보가 지정되지 않았습니다.');
      return;
    }

    const userResponse = await sb.auth.getUser();
    const user = userResponse.data && userResponse.data.user;
    if (!user) {
      showGate('로그인하면 저장된 반려동물 기록을 확인할 수 있습니다.');
      if (typeof window.provedSetHeaderAuthState === 'function') {
        window.provedSetHeaderAuthState(false);
      }
      return;
    }

    if (typeof window.provedSetHeaderAuthState === 'function') {
      window.provedSetHeaderAuthState(true);
    }

    try {
      const pet = await loadPet(user.id, petId);
      if (!pet) {
        showGate('현재 계정에서 해당 반려동물을 찾을 수 없습니다.');
        return;
      }

      const results = await Promise.all([
        loadWeightRecords(user.id, pet.id),
        loadFeedingRecords(user.id, pet.id)
      ]);

      showContent();
      renderHeroAndProfile(pet, results[0]);
      renderWeightChart(results[0], pet);
      renderCurrentDiet(results[1]);
      renderRecentCalculations(results[1]);
    } catch (error) {
      console.error('Pet detail load failed:', error);
      showGate('반려동물 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
