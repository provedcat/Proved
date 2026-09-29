(function () {
  'use strict';
  const base = '/images/pet-avatar/assets/';
  const asset = (folder, file) => base + folder + '/' + file + '.png';
  const make = (entries) => Object.fromEntries(entries);
  const shapes = make(Array.from({ length: 8 }, (_, i) => {
    const id = '02_' + String(i + 1).padStart(2, '0');
    return [id, {
      name: ['단모', '장모', '장모 · 이어터프트', '작은 귀', '뾰족한 귀', '처진 둥근 귀', '작고 둥근 귀', '길게 처진 귀'][i],
      mask: asset('02_shape', id + '_shape'),
      shadow: asset('02_shape', id + '_shadow-colorburn'),
      light: asset('02_shape', id + '_light-softlight')
    }];
  }));
  const colors = make(['black', 'blue', 'cool_white', 'lemon', 'orange', 'pink', 'purple', 'warm_white'].map(key =>
    [key, { name: { black: '블랙', blue: '블루', cool_white: '쿨 화이트', lemon: '레몬', orange: '오렌지', pink: '핑크', purple: '퍼플', warm_white: '웜 화이트' }[key], src: asset('01_color', '01_color_' + key) }]));
  const patternFiles = {
    muzzle: '0000_muzzle', black_tan: '0001_black-tan', lynx: '0002_lynx',
    long_ear: '0003_long_ear', short_ear: '0004_short__ear',
    half_face: '0005_half-face', bicolor: '0006_bycolor', raccoon: '0007_raccoon'
  };
  const patterns = make(Object.entries(patternFiles).map(([key, file]) => [key, { name: {
    muzzle: '입 주변', black_tan: '블랙탄', lynx: '링스', long_ear: '긴 귀', short_ear: '짧은 귀',
    half_face: '반쪽 얼굴', bicolor: '바이컬러', raccoon: '라쿤'
  }[key], src: asset('03_face_pattern', '03_face_pattern__' + file) }]));
  const parts = (folder, prefix, names) => make(names.map((key, i) => [key, {
    name: { marigold: '메리골드', rainbow: '레인보우', green: '그린', emerald: '에메랄드', blue: '블루', bronze: '브론즈', odd: '오드아이', split: '스플릿', half: '하프', star: '스타', flare: '플레어', round_eye: '둥근 눈', cat_eye: '고양이 눈', white: '화이트', yellow: '옐로', coral: '코랄', pink: '핑크', black: '블랙', brown: '브라운', brown_line: '브라운 라인', gold: '골드' }[key],
    file: prefix + String(i).padStart(4, '0') + '_' + key.replace(/_/g, folder === '05_eye_pattern' ? '-' : '_'),
    src: asset(folder, prefix + String(i).padStart(4, '0') + '_' + key.replace(/_/g, folder === '05_eye_pattern' ? '-' : '_'))
  }]));
  const catalog = {
    shape: shapes, color: colors, patternCentral: patterns, patternEar: patterns, patternOuter: patterns,
    eyeColor: parts('04_eye_color', '04_eye_color_', ['marigold','rainbow','green','emerald','blue','bronze','odd','split']),
    eyePattern: parts('05_eye_pattern', '05_eye_pattern_', ['half','star','flare','round_eye','cat_eye']),
    blush: parts('06_blush', '06_blush_', ['white','yellow','coral','pink']),
    nose: parts('07_nose', '07_nose_', ['black','blue','brown','brown_line','gold','pink'])
  };
  // The source PSD exports use round-eye, cat-eye, and brown_line spellings.
  catalog.nose.brown_line.src = asset('07_nose', '07_nose_0003_brown_line');
  const groups = { patternCentral: ['muzzle','black_tan','lynx'], patternEar: ['long_ear','short_ear'], patternOuter: ['half_face','bicolor','raccoon'] };
  const opacity = { black: .6, blue: .6, cool_white: 1, lemon: 1, orange: .8, pink: 1, purple: .8, warm_white: 1 };
  const defaults = species => ({ shape: species === 'dog' ? '02_05' : '02_01', color: 'warm_white', patternCentral: null, patternEar: null, patternOuter: null, eyeColor: 'marigold', eyePattern: 'cat_eye', blush: null, nose: 'black' });
  function normalize(value, species) {
    const result = { ...defaults(species) };
    for (const key of Object.keys(result)) {
      const candidate = value && value[key];
      if (candidate === null && (key in groups || key === 'blush' || key === 'eyePattern')) result[key] = null;
      else if (catalog[key][candidate] && (!groups[key] || groups[key].includes(candidate))) result[key] = candidate;
    }
    return result;
  }
  const cache = new Map();
  function load(src) {
    if (!cache.has(src)) cache.set(src, new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('아바타 에셋을 불러오지 못했습니다: ' + src)); img.src = src;
    }));
    return cache.get(src);
  }
  async function render(canvas, settings, species) {
    const s = normalize(settings, species), shape = shapes[s.shape];
    const layers = [colors[s.color].src, shape.shadow, shape.light,
      ...Object.keys(groups).map(key => s[key] && patterns[s[key]].src),
      asset('04_eye_blend_base','04_eye_color_base_layer_colorburn'),
      catalog.eyeColor[s.eyeColor].src, s.eyePattern && catalog.eyePattern[s.eyePattern].src,
      s.blush && catalog.blush[s.blush].src, catalog.nose[s.nose].src];
    const [mask, ...images] = await Promise.all([load(shape.mask), ...layers.map(src => src ? load(src) : Promise.resolve(null))]);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const clipped = document.createElement('canvas'); clipped.width = w; clipped.height = h;
    const c = clipped.getContext('2d');
    function draw(img, mode, alpha, clip) {
      if (!img) return;
      c.clearRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.drawImage(img, 0, 0, w, h);
      if (clip) { c.globalCompositeOperation = 'destination-in'; c.drawImage(mask, 0, 0, w, h); }
      ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha;
      ctx.drawImage(clipped, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    images.forEach((img, i) => draw(img,
      [ 'source-over','color-burn','soft-light','color-burn','color-burn','color-burn','color-burn','source-over','source-over','source-over','source-over' ][i],
      i >= 3 && i <= 5 ? opacity[s.color] : 1, i === 0 || (i >= 3 && i <= 5)));
  }
  window.ProvedAvatar = { catalog, groups, defaults, normalize, render };
})();
