(function () {
  'use strict';

  const SUPABASE_URL = 'https://qpklvtgnhrdmzxzlstpp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2x2dGduaHJkbXp4emxzdHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjE1MjIsImV4cCI6MjA5MTUzNzUyMn0.6nI4uEp9H9gVn3Sjm4Qhs5XXFvhUhfGBf6e0Nqce1EM';
  const MAX_TAGS = 8;
  const SVG_VIEWBOX = '0 0 620 760';
  const LABEL_FONT_SIZE = 29;
  const TAG_CATEGORY_ORDER = [
    'product_class',
    'food_form',
    'life_stage',
    'management_purpose',
    'processing_method',
    'ingredient_condition',
    'preparation_type',
    'protein_source'
  ];
  const CATEGORY_LIMITS = {
    product_class: 1,
    food_form: 1,
    life_stage: 1,
    management_purpose: 1,
    processing_method: 1,
    ingredient_condition: 1,
    preparation_type: 1,
    protein_source: 3
  };
  const CATEGORY_BASE_HUE = {
    product_class: 220,
    food_form: 188,
    life_stage: 47,
    management_purpose: 14,
    processing_method: 274,
    ingredient_condition: 137,
    preparation_type: 163,
    protein_source: 22,
    other: 330
  };
  const TAG_COLOR_OVERRIDES = {
    complete_food: '#88AFFF',
    complementary_food: '#9BB7F5',
    treat: '#A7B7E9',
    veterinary_diet: '#F08B73',
    dry_food: '#E6A364',
    wet_food: '#76C5D5',
    freeze_dried_food: '#95CBB5',
    chicken: '#E68968',
    salmon: '#E77888',
    duck: '#CF8B75',
    rabbit: '#C99B7C',
    grain_free: '#7DB38D',
    chicken_free: '#74AE92',
    meal_free: '#6FAF9A',
    oven_baked: '#9A7DDF',
    adult_cat: '#E5C84E',
    adult_dog: '#E5C84E'
  };
  const BLOB_LABEL_OVERRIDES = {
    '수의학적 영양관리식': '영양관리식',
    '단일 동물성 단백질': '단일단백질',
    '고양이 전연령': '전연령',
    '강아지 전연령': '전연령',
    '피부·알레르기': '피부·알레르기',
    '無육분': 'Meal-free\n無 육분'
  };

  const PRESETS = {
    3: [
      [
        { cx: 310, cy: 170, rx: 164, ry: 122, rot: -5, labelX: 310, labelY: 150 },
        { cx: 180, cy: 430, rx: 178, ry: 135, rot: 17, labelX: 138, labelY: 445 },
        { cx: 438, cy: 468, rx: 180, ry: 138, rot: -15, labelX: 478, labelY: 470 }
      ],
      [
        { cx: 245, cy: 205, rx: 170, ry: 126, rot: 12, labelX: 214, labelY: 180 },
        { cx: 458, cy: 286, rx: 176, ry: 132, rot: -10, labelX: 500, labelY: 274 },
        { cx: 300, cy: 535, rx: 190, ry: 142, rot: 2, labelX: 300, labelY: 565 }
      ],
      [
        { cx: 318, cy: 185, rx: 178, ry: 130, rot: -12, labelX: 338, labelY: 160 },
        { cx: 165, cy: 438, rx: 174, ry: 132, rot: 8, labelX: 120, labelY: 446 },
        { cx: 455, cy: 445, rx: 184, ry: 137, rot: 12, labelX: 500, labelY: 448 }
      ]
    ],
    4: [
      [
        { cx: 310, cy: 148, rx: 154, ry: 116, rot: -5, labelX: 310, labelY: 130 },
        { cx: 464, cy: 324, rx: 164, ry: 127, rot: 11, labelX: 500, labelY: 318 },
        { cx: 330, cy: 542, rx: 171, ry: 131, rot: -8, labelX: 330, labelY: 572 },
        { cx: 160, cy: 365, rx: 162, ry: 129, rot: 14, labelX: 115, labelY: 365 }
      ],
      [
        { cx: 260, cy: 155, rx: 160, ry: 118, rot: 8, labelX: 235, labelY: 132 },
        { cx: 470, cy: 278, rx: 166, ry: 126, rot: -8, labelX: 510, labelY: 268 },
        { cx: 385, cy: 530, rx: 176, ry: 132, rot: 10, labelX: 418, labelY: 558 },
        { cx: 145, cy: 420, rx: 164, ry: 128, rot: -11, labelX: 102, labelY: 426 }
      ],
      [
        { cx: 335, cy: 145, rx: 157, ry: 117, rot: -9, labelX: 350, labelY: 122 },
        { cx: 485, cy: 350, rx: 165, ry: 127, rot: 8, labelX: 520, labelY: 350 },
        { cx: 295, cy: 555, rx: 176, ry: 133, rot: -4, labelX: 292, labelY: 585 },
        { cx: 135, cy: 340, rx: 162, ry: 126, rot: 13, labelX: 92, labelY: 338 }
      ]
    ],
    5: [
      [
        { cx: 315, cy: 365, rx: 144, ry: 111, rot: 0, labelX: 315, labelY: 365, center: true },
        { cx: 284, cy: 178, rx: 149, ry: 112, rot: -7, labelX: 280, labelY: 153 },
        { cx: 470, cy: 273, rx: 153, ry: 115, rot: 10, labelX: 508, labelY: 262 },
        { cx: 430, cy: 515, rx: 160, ry: 120, rot: -8, labelX: 460, labelY: 540 },
        { cx: 165, cy: 496, rx: 157, ry: 118, rot: 11, labelX: 125, labelY: 515 }
      ],
      [
        { cx: 300, cy: 360, rx: 145, ry: 111, rot: 0, labelX: 300, labelY: 360, center: true },
        { cx: 365, cy: 172, rx: 150, ry: 112, rot: 7, labelX: 385, labelY: 148 },
        { cx: 492, cy: 362, rx: 155, ry: 116, rot: -6, labelX: 528, labelY: 362 },
        { cx: 340, cy: 555, rx: 164, ry: 122, rot: 5, labelX: 345, labelY: 583 },
        { cx: 135, cy: 430, rx: 158, ry: 119, rot: -10, labelX: 95, labelY: 440 }
      ],
      [
        { cx: 320, cy: 375, rx: 145, ry: 112, rot: 0, labelX: 320, labelY: 375, center: true },
        { cx: 220, cy: 192, rx: 150, ry: 113, rot: 11, labelX: 190, labelY: 170 },
        { cx: 462, cy: 218, rx: 153, ry: 115, rot: -9, labelX: 500, labelY: 205 },
        { cx: 478, cy: 475, rx: 160, ry: 120, rot: 8, labelX: 515, labelY: 490 },
        { cx: 205, cy: 560, rx: 163, ry: 122, rot: -6, labelX: 175, labelY: 585 }
      ]
    ],
    6: [
      [
        { cx: 315, cy: 365, rx: 141, ry: 109, rot: 0, labelX: 315, labelY: 365, center: true },
        { cx: 304, cy: 175, rx: 146, ry: 111, rot: -6, labelX: 304, labelY: 150 },
        { cx: 470, cy: 245, rx: 149, ry: 113, rot: 9, labelX: 508, labelY: 232 },
        { cx: 485, cy: 438, rx: 154, ry: 116, rot: -6, labelX: 520, labelY: 452 },
        { cx: 325, cy: 590, rx: 160, ry: 120, rot: 4, labelX: 325, labelY: 618 },
        { cx: 145, cy: 430, rx: 152, ry: 114, rot: 12, labelX: 107, labelY: 445 }
      ],
      [
        { cx: 300, cy: 370, rx: 142, ry: 110, rot: 0, labelX: 300, labelY: 370, center: true },
        { cx: 225, cy: 188, rx: 147, ry: 111, rot: 10, labelX: 198, labelY: 164 },
        { cx: 430, cy: 180, rx: 148, ry: 112, rot: -8, labelX: 462, labelY: 158 },
        { cx: 505, cy: 370, rx: 154, ry: 116, rot: 5, labelX: 540, labelY: 370 },
        { cx: 380, cy: 570, rx: 160, ry: 120, rot: -6, labelX: 400, labelY: 597 },
        { cx: 145, cy: 505, rx: 156, ry: 117, rot: 8, labelX: 105, labelY: 522 }
      ],
      [
        { cx: 320, cy: 360, rx: 142, ry: 110, rot: 0, labelX: 320, labelY: 360, center: true },
        { cx: 340, cy: 165, rx: 146, ry: 111, rot: -4, labelX: 342, labelY: 140 },
        { cx: 495, cy: 300, rx: 151, ry: 114, rot: 10, labelX: 530, labelY: 292 },
        { cx: 455, cy: 510, rx: 157, ry: 118, rot: -7, labelX: 485, labelY: 530 },
        { cx: 250, cy: 590, rx: 160, ry: 120, rot: 4, labelX: 230, labelY: 618 },
        { cx: 130, cy: 350, rx: 151, ry: 114, rot: -11, labelX: 92, labelY: 350 }
      ]
    ],
    7: [
      [
        { cx: 315, cy: 365, rx: 139, ry: 108, rot: 0, labelX: 315, labelY: 365, center: true },
        { cx: 300, cy: 168, rx: 143, ry: 108, rot: -6, labelX: 300, labelY: 143 },
        { cx: 448, cy: 225, rx: 145, ry: 110, rot: 8, labelX: 485, labelY: 212 },
        { cx: 505, cy: 375, rx: 148, ry: 112, rot: -4, labelX: 540, labelY: 375 },
        { cx: 425, cy: 555, rx: 153, ry: 115, rot: 7, labelX: 452, labelY: 580 },
        { cx: 225, cy: 585, rx: 153, ry: 115, rot: -8, labelX: 193, labelY: 610 },
        { cx: 125, cy: 350, rx: 146, ry: 110, rot: 11, labelX: 88, labelY: 350 }
      ],
      [
        { cx: 300, cy: 360, rx: 139, ry: 108, rot: 0, labelX: 300, labelY: 360, center: true },
        { cx: 215, cy: 180, rx: 143, ry: 108, rot: 11, labelX: 190, labelY: 155 },
        { cx: 410, cy: 165, rx: 144, ry: 109, rot: -8, labelX: 440, labelY: 142 },
        { cx: 500, cy: 325, rx: 148, ry: 112, rot: 7, labelX: 535, labelY: 322 },
        { cx: 455, cy: 515, rx: 153, ry: 115, rot: -7, labelX: 485, labelY: 537 },
        { cx: 285, cy: 600, rx: 155, ry: 116, rot: 3, labelX: 282, labelY: 628 },
        { cx: 120, cy: 425, rx: 148, ry: 111, rot: -10, labelX: 82, labelY: 430 }
      ],
      [
        { cx: 320, cy: 370, rx: 139, ry: 108, rot: 0, labelX: 320, labelY: 370, center: true },
        { cx: 330, cy: 170, rx: 143, ry: 108, rot: -4, labelX: 330, labelY: 145 },
        { cx: 480, cy: 245, rx: 145, ry: 110, rot: 10, labelX: 515, labelY: 235 },
        { cx: 485, cy: 430, rx: 149, ry: 112, rot: -7, labelX: 520, labelY: 442 },
        { cx: 350, cy: 590, rx: 155, ry: 116, rot: 4, labelX: 350, labelY: 618 },
        { cx: 160, cy: 540, rx: 151, ry: 114, rot: -9, labelX: 125, labelY: 558 },
        { cx: 125, cy: 335, rx: 147, ry: 111, rot: 10, labelX: 88, labelY: 335 }
      ]
    ],
    8: [
      [
        { cx: 315, cy: 365, rx: 137, ry: 106, rot: 0, labelX: 315, labelY: 365, center: true },
        { cx: 300, cy: 165, rx: 141, ry: 107, rot: -6, labelX: 300, labelY: 140 },
        { cx: 440, cy: 215, rx: 143, ry: 108, rot: 8, labelX: 476, labelY: 202 },
        { cx: 505, cy: 340, rx: 146, ry: 110, rot: -4, labelX: 540, labelY: 338 },
        { cx: 465, cy: 505, rx: 150, ry: 113, rot: 6, labelX: 498, labelY: 526 },
        { cx: 320, cy: 605, rx: 154, ry: 116, rot: -2, labelX: 320, labelY: 635 },
        { cx: 165, cy: 540, rx: 151, ry: 114, rot: 10, labelX: 128, labelY: 560 },
        { cx: 120, cy: 335, rx: 147, ry: 111, rot: -10, labelX: 82, labelY: 335 }
      ],
      [
        { cx: 300, cy: 365, rx: 137, ry: 106, rot: 0, labelX: 300, labelY: 365, center: true },
        { cx: 215, cy: 178, rx: 141, ry: 107, rot: 10, labelX: 188, labelY: 153 },
        { cx: 405, cy: 160, rx: 142, ry: 108, rot: -8, labelX: 438, labelY: 138 },
        { cx: 505, cy: 300, rx: 146, ry: 110, rot: 7, labelX: 540, labelY: 295 },
        { cx: 478, cy: 475, rx: 150, ry: 113, rot: -7, labelX: 510, labelY: 492 },
        { cx: 350, cy: 610, rx: 154, ry: 116, rot: 3, labelX: 350, labelY: 640 },
        { cx: 175, cy: 560, rx: 152, ry: 114, rot: -8, labelX: 138, labelY: 580 },
        { cx: 112, cy: 370, rx: 147, ry: 111, rot: 10, labelX: 75, labelY: 370 }
      ],
      [
        { cx: 320, cy: 365, rx: 137, ry: 106, rot: 0, labelX: 320, labelY: 365, center: true },
        { cx: 335, cy: 165, rx: 141, ry: 107, rot: -4, labelX: 335, labelY: 140 },
        { cx: 485, cy: 235, rx: 143, ry: 108, rot: 9, labelX: 520, labelY: 225 },
        { cx: 505, cy: 405, rx: 147, ry: 111, rot: -6, labelX: 540, labelY: 412 },
        { cx: 400, cy: 565, rx: 151, ry: 114, rot: 7, labelX: 428, labelY: 590 },
        { cx: 235, cy: 615, rx: 154, ry: 116, rot: -4, labelX: 210, labelY: 643 },
        { cx: 115, cy: 500, rx: 150, ry: 113, rot: 9, labelX: 78, labelY: 515 },
        { cx: 125, cy: 300, rx: 147, ry: 111, rot: -10, labelX: 88, labelY: 294 }
      ]
    ]
  };

  if (!window.supabase) return;
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let renderSerial = 0;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    const sat = Math.max(0, Math.min(100, s)) / 100;
    const light = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = light - c / 2;
    let rgb = [0, 0, 0];
    if (hue < 60) rgb = [c, x, 0];
    else if (hue < 120) rgb = [x, c, 0];
    else if (hue < 180) rgb = [0, c, x];
    else if (hue < 240) rgb = [0, x, c];
    else if (hue < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return `#${rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`;
  }

  function hexToHue(hex) {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return 0;
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (!d) return 0;
    let h = 0;
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * (((b - r) / d) + 2);
    else h = 60 * (((r - g) / d) + 4);
    return (h + 360) % 360;
  }

  function getVisualColor(tag) {
    if (TAG_COLOR_OVERRIDES[tag.slug]) return TAG_COLOR_OVERRIDES[tag.slug];
    const category = tag.category || 'other';
    const baseHue = CATEGORY_BASE_HUE[category] ?? CATEGORY_BASE_HUE.other;
    const hash = hashString(tag.slug || tag.label_ko || tag.id);
    const hueOffset = (hash % 43) - 21;
    const saturation = 54 + ((hash >>> 8) % 10);
    const lightness = 68 + ((hash >>> 16) % 7) - 3;
    return hslToHex(baseHue + hueOffset, saturation, lightness);
  }

  function getBlobLabel(tag) {
    const label = BLOB_LABEL_OVERRIDES[tag.label_ko] || tag.label_ko || tag.label_en || tag.slug || '태그';
    return String(label).trim();
  }

  function normalizeProteinLabel(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.split(/[,/·+]/)[0].trim().replace(/고기$/u, '');
  }

  function synthesizeRequiredTags(feed, realTags) {
    const tags = realTags.slice();
    const hasCategory = category => tags.some(tag => tag.category === category);

    if (!hasCategory('product_class') && feed.완전식여부) {
      const role = String(feed.완전식여부).trim();
      const roleSlug = role === '주식' ? 'complete_food' : role === '보조식' ? 'complementary_food' : `role_${role}`;
      tags.push({ id: `synthetic:${roleSlug}`, slug: roleSlug, label_ko: role, category: 'product_class', sort_order: 0, synthetic: true });
    }

    if (!hasCategory('food_form')) {
      const form = feed.type === 'wet'
        ? { slug: 'wet_food', label_ko: '습식사료' }
        : feed.type === 'dry'
          ? { slug: 'dry_food', label_ko: '건사료' }
          : { slug: 'food_form_unknown', label_ko: '사료' };
      tags.push({ id: `synthetic:${form.slug}`, ...form, category: 'food_form', sort_order: 0, synthetic: true });
    }

    if (!hasCategory('protein_source')) {
      const protein = normalizeProteinLabel(feed.메인단백질);
      if (protein) {
        tags.push({
          id: `synthetic:protein:${protein}`,
          slug: `protein_${protein}`,
          label_ko: protein,
          category: 'protein_source',
          sort_order: 999,
          synthetic: true
        });
      }
    }

    return tags;
  }

  function compareTags(a, b) {
    const aOrder = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 9999;
    const bOrder = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 9999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.slug || a.label_ko || a.id).localeCompare(String(b.slug || b.label_ko || b.id), 'ko');
  }

  function selectRepresentativeTags(tags) {
    const selected = [];
    const used = new Set();
    const grouped = new Map();

    tags.forEach(tag => {
      const key = tag.category || 'other';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(tag);
    });
    grouped.forEach(group => group.sort(compareTags));

    TAG_CATEGORY_ORDER.forEach(category => {
      const group = grouped.get(category) || [];
      const limit = CATEGORY_LIMITS[category] || 1;
      for (const tag of group) {
        if (selected.length >= MAX_TAGS || group.filter(item => used.has(item.id)).length >= limit) break;
        if (used.has(tag.id)) continue;
        selected.push(tag);
        used.add(tag.id);
      }
    });

    const remaining = tags.filter(tag => !used.has(tag.id)).sort((a, b) => {
      const ai = TAG_CATEGORY_ORDER.indexOf(a.category);
      const bi = TAG_CATEGORY_ORDER.indexOf(b.category);
      const ar = ai === -1 ? 999 : ai;
      const br = bi === -1 ? 999 : bi;
      return ar - br || compareTags(a, b);
    });

    for (const tag of remaining) {
      if (selected.length >= MAX_TAGS) break;
      const categoryCount = selected.filter(item => item.category === tag.category).length;
      const limit = CATEGORY_LIMITS[tag.category] || 1;
      if (categoryCount >= limit && tag.category !== 'other') continue;
      selected.push(tag);
      used.add(tag.id);
    }

    return selected.slice(0, MAX_TAGS);
  }

  function assignTagsToSlots(tags, slots) {
    if (tags.length < 5) {
      return tags
        .map(tag => ({ ...tag, visualColor: getVisualColor(tag) }))
        .sort((a, b) => hexToHue(a.visualColor) - hexToHue(b.visualColor))
        .map((tag, index) => ({ tag, slot: slots[index] }));
    }

    const centerTag = { ...tags[0], visualColor: getVisualColor(tags[0]) };
    const outerTags = tags.slice(1)
      .map(tag => ({ ...tag, visualColor: getVisualColor(tag) }))
      .sort((a, b) => hexToHue(a.visualColor) - hexToHue(b.visualColor));

    return [
      { tag: centerTag, slot: slots[0] },
      ...outerTags.map((tag, index) => ({ tag, slot: slots[index + 1] }))
    ];
  }

  function renderText(label, slot) {
    const explicitLines = String(label).split('\n');
    if (explicitLines.length > 1) {
      const line1 = escapeHtml(explicitLines[0]);
      const line2 = escapeHtml(explicitLines.slice(1).join(' '));
      return `<text x="${slot.labelX}" y="${slot.labelY}" font-size="${LABEL_FONT_SIZE}"><tspan x="${slot.labelX}" dy="-0.58em">${line1}</tspan><tspan x="${slot.labelX}" dy="1.16em">${line2}</tspan></text>`;
    }
    const safe = escapeHtml(label);
    const chars = Array.from(label);
    if (chars.length <= 8) {
      return `<text x="${slot.labelX}" y="${slot.labelY}" font-size="${LABEL_FONT_SIZE}">${safe}</text>`;
    }
    const cut = Math.ceil(chars.length / 2);
    const line1 = escapeHtml(chars.slice(0, cut).join(''));
    const line2 = escapeHtml(chars.slice(cut).join(''));
    return `<text x="${slot.labelX}" y="${slot.labelY}" font-size="${LABEL_FONT_SIZE}"><tspan x="${slot.labelX}" dy="-0.58em">${line1}</tspan><tspan x="${slot.labelX}" dy="1.16em">${line2}</tspan></text>`;
  }

  function renderBlobSvg(tags) {
    const count = Math.max(3, Math.min(MAX_TAGS, tags.length));
    const variants = PRESETS[count] || PRESETS[3];
    const stableKey = tags.map(tag => tag.slug || tag.id).sort().join('|');
    const variantIndex = hashString(stableKey) % variants.length;
    const slots = variants[variantIndex];
    const assigned = assignTagsToSlots(tags.slice(0, count), slots);
    const uid = `foodBlob${hashString(`${stableKey}:${variantIndex}`).toString(36)}`;

    const maskLobes = assigned.map(({ slot }) => `
      <ellipse cx="${slot.cx}" cy="${slot.cy}" rx="${slot.rx}" ry="${slot.ry}"
        transform="rotate(${slot.rot} ${slot.cx} ${slot.cy})" fill="#fff" />`).join('');

    const gradientDefs = assigned.map(({ tag, slot }, index) => {
      const color = tag.visualColor || getVisualColor(tag);
      const radius = Math.max(slot.rx, slot.ry) * 1.68;
      return `
        <radialGradient id="${uid}Gradient${index}" gradientUnits="userSpaceOnUse" cx="${slot.labelX}" cy="${slot.labelY}" r="${radius}">
          <stop offset="0%" stop-color="${color}" stop-opacity="1" />
          <stop offset="38%" stop-color="${color}" stop-opacity=".98" />
          <stop offset="67%" stop-color="${color}" stop-opacity=".82" />
          <stop offset="88%" stop-color="${color}" stop-opacity=".32" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0" />
        </radialGradient>`;
    }).join('');

    const paintLayers = assigned.map((entry, index) => `
      <rect x="0" y="0" width="620" height="760" fill="url(#${uid}Gradient${index})" opacity=".9" />`).join('');

    const labels = assigned.map(({ tag, slot }) => renderText(getBlobLabel(tag), slot)).join('');
    const baseColor = assigned[0]?.tag?.visualColor || getVisualColor(assigned[0]?.tag || tags[0]);

    return `
      <svg class="food-tag-blob__svg" viewBox="${SVG_VIEWBOX}" role="img" aria-label="이 제품의 대표 태그 ${count}개">
        <defs>
          <filter id="${uid}Goo" x="-28%" y="-28%" width="156%" height="156%" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="13" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -8.5" />
          </filter>
          <mask id="${uid}Mask">
            <rect width="620" height="760" fill="#000" />
            <g filter="url(#${uid}Goo)">${maskLobes}</g>
          </mask>
          ${gradientDefs}
        </defs>
        <g mask="url(#${uid}Mask)">
          <rect width="620" height="760" fill="${baseColor}" opacity=".42" />
          ${paintLayers}
        </g>
        <g class="food-tag-blob__labels">${labels}</g>
      </svg>`;
  }

  async function loadProductVisualData(feedId, species) {
    const feedTable = species === 'dog' ? 'dog_feeds' : 'feeds';
    const mappingTable = species === 'dog' ? 'dog_feed_food_tags' : 'feed_food_tags';
    const mappingIdColumn = species === 'dog' ? 'dog_feed_id' : 'feed_id';

    const [{ data: feed, error: feedError }, { data: mapping, error: mappingError }] = await Promise.all([
      sb.from(feedTable).select('id,type,완전식여부,메인단백질').eq('id', feedId).maybeSingle(),
      sb.from(mappingTable).select('tag_id').eq(mappingIdColumn, feedId)
    ]);

    if (feedError || !feed) throw feedError || new Error('제품 정보를 찾지 못했습니다.');

    let realTags = [];
    if (!mappingError && Array.isArray(mapping) && mapping.length) {
      const ids = [...new Set(mapping.map(row => row.tag_id).filter(Boolean))];
      if (ids.length) {
        const { data: tagRows, error: tagError } = await sb
          .from('food_tags')
          .select('id,slug,label_ko,label_en,category,sort_order,is_active')
          .in('id', ids)
          .eq('is_active', true);
        if (!tagError && Array.isArray(tagRows)) realTags = tagRows;
      }
    }

    const completeTags = synthesizeRequiredTags(feed, realTags);
    return { feed, tags: selectRepresentativeTags(completeTags) };
  }

  function createBlobPanel() {
    const panel = document.createElement('aside');
    panel.className = 'food-tag-blob';
    panel.setAttribute('aria-label', '제품 특성 태그');
    panel.innerHTML = '<div class="food-tag-blob__loading" aria-hidden="true"></div>';
    return panel;
  }

  function syncMobileCompare(toolbar, compareLink) {
    toolbar.querySelector('.food-compare-link--mobile')?.remove();
    const mobileCompare = compareLink.cloneNode(true);
    mobileCompare.classList.remove('food-compare-link--desktop');
    mobileCompare.classList.add('food-compare-link--mobile');
    toolbar.appendChild(mobileCompare);
  }

  async function enhanceDetail() {
    const content = document.getElementById('foodDetailContent');
    const toolbar = document.querySelector('.food-detail-toolbar');
    const article = content?.querySelector('.food-detail-article');
    if (!content || !toolbar || !article || article.dataset.tagBlobEnhanced === 'true') return;

    const params = new URLSearchParams(window.location.search);
    const feedId = params.get('id');
    const species = params.get('species') === 'dog' ? 'dog' : 'cat';
    if (!feedId) return;

    const hero = article.querySelector('.food-detail-hero');
    const basicSection = article.querySelector('.food-detail-section');
    const compareLink = hero?.querySelector('.food-compare-link');
    if (!hero || !basicSection || !compareLink) return;

    article.dataset.tagBlobEnhanced = 'true';
    const serial = ++renderSerial;

    compareLink.classList.add('food-compare-link--desktop');
    syncMobileCompare(toolbar, compareLink);

    const profileGrid = document.createElement('div');
    profileGrid.className = 'food-detail-profile-grid';

    const infoColumn = document.createElement('div');
    infoColumn.className = 'food-detail-profile-info';

    const desktopActions = document.createElement('div');
    desktopActions.className = 'food-detail-profile-actions';
    desktopActions.appendChild(compareLink);

    basicSection.classList.add('food-detail-section--basic');
    infoColumn.append(desktopActions, basicSection);

    const blobPanel = createBlobPanel();
    profileGrid.append(infoColumn, blobPanel);
    hero.insertAdjacentElement('afterend', profileGrid);

    try {
      const { tags } = await loadProductVisualData(feedId, species);
      if (serial !== renderSerial || !blobPanel.isConnected) return;
      if (tags.length < 3) {
        blobPanel.innerHTML = '<p class="food-tag-blob__empty">대표 태그를 준비 중입니다.</p>';
        return;
      }
      blobPanel.innerHTML = renderBlobSvg(tags);
    } catch (error) {
      if (serial !== renderSerial || !blobPanel.isConnected) return;
      blobPanel.innerHTML = '<p class="food-tag-blob__empty">대표 태그를 불러오지 못했습니다.</p>';
      console.warn('[Proved] product tag blob:', error);
    }
  }

  function init() {
    const content = document.getElementById('foodDetailContent');
    if (!content) return;
    const observer = new MutationObserver(() => window.requestAnimationFrame(enhanceDetail));
    observer.observe(content, { childList: true });
    enhanceDetail();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
