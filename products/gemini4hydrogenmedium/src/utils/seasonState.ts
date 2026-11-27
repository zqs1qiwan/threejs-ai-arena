import * as THREE from 'three';
import { clamp, lerp } from './noise';

export type LightingMood = 'day' | 'golden' | 'night';

export interface SeasonWeights {
  spring: number;
  summer: number;
  autumn: number;
  winter: number;
  snowAmount: number;
  foliageScale: number;
  blossomFactor: number;
  iceFactor: number;
  fireflyFactor: number;
}

export interface SeasonPalette {
  leafPrimary: THREE.Color;
  leafSecondary: THREE.Color;
  leafAccent: THREE.Color;
  mossColor: THREE.Color;
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fogColor: THREE.Color;
  sunColor: THREE.Color;
  ambientColor: THREE.Color;
  uiAccent: string;
  subtitle: string;
}

/**
 * Computes smooth cyclic weights for season in [0, 4).
 * 0 = Spring, 1 = Summer, 2 = Autumn, 3 = Winter.
 */
export function computeSeasonWeights(season: number): SeasonWeights {
  const s = ((season % 4) + 4) % 4;
  const dist = (center: number) => {
    let d = Math.abs(s - center);
    if (d > 2) d = 4 - d;
    return clamp(1 - d, 0, 1);
  };

  // Smooth cosine bell weights
  const rawSpring = dist(0);
  const rawSummer = dist(1);
  const rawAutumn = dist(2);
  const rawWinter = dist(3);

  const spring = rawSpring * rawSpring * (3 - 2 * rawSpring);
  const summer = rawSummer * rawSummer * (3 - 2 * rawSummer);
  const autumn = rawAutumn * rawAutumn * (3 - 2 * rawAutumn);
  const winter = rawWinter * rawWinter * (3 - 2 * rawWinter);

  const sum = spring + summer + autumn + winter || 1;
  const ns = spring / sum;
  const nsu = summer / sum;
  const na = autumn / sum;
  const nw = winter / sum;

  // Snow builds up in late autumn -> winter and melts in early spring
  const snowAmount = clamp(nw * 1.15 - 0.12, 0, 1);
  // Foliage is full in spring/summer/early autumn, sparse/bare in deep winter
  const foliageScale = clamp(1.0 - nw * 0.88, 0.12, 1.05);
  const blossomFactor = ns;
  const iceFactor = clamp(nw * 1.1 - 0.15, 0, 1);
  const fireflyFactor = nsu;

  return {
    spring: ns,
    summer: nsu,
    autumn: na,
    winter: nw,
    snowAmount,
    foliageScale,
    blossomFactor,
    iceFactor,
    fireflyFactor,
  };
}

const SPRING_LEAF_1 = new THREE.Color('#f7b8c9');
const SPRING_LEAF_2 = new THREE.Color('#fde2ea');
const SPRING_LEAF_3 = new THREE.Color('#e87fa0');

const SUMMER_LEAF_1 = new THREE.Color('#2d7a47');
const SUMMER_LEAF_2 = new THREE.Color('#4aa35a');
const SUMMER_LEAF_3 = new THREE.Color('#1f5633');

const AUTUMN_LEAF_1 = new THREE.Color('#d94b28');
const AUTUMN_LEAF_2 = new THREE.Color('#f0952b');
const AUTUMN_LEAF_3 = new THREE.Color('#8f1d14');

const WINTER_LEAF_1 = new THREE.Color('#cfdce6');
const WINTER_LEAF_2 = new THREE.Color('#e8f1f8');
const WINTER_LEAF_3 = new THREE.Color('#7a6558');

const MOSS_COLORS = [
  new THREE.Color('#4a7c44'),
  new THREE.Color('#2f6b37'),
  new THREE.Color('#7a6c34'),
  new THREE.Color('#5a6b68'),
];

const SKY_TOP_COLORS = [
  new THREE.Color('#6a8eb5'),
  new THREE.Color('#3c78b5'),
  new THREE.Color('#524c73'),
  new THREE.Color('#2c3a4f'),
];

const SKY_HORIZON_COLORS = [
  new THREE.Color('#f2d7dc'),
  new THREE.Color('#c8e4ec'),
  new THREE.Color('#e89c6c'),
  new THREE.Color('#9cb4c9'),
];

function blendFourColors(
  colors: THREE.Color[],
  w: SeasonWeights,
  out: THREE.Color
): THREE.Color {
  out.setRGB(
    colors[0].r * w.spring + colors[1].r * w.summer + colors[2].r * w.autumn + colors[3].r * w.winter,
    colors[0].g * w.spring + colors[1].g * w.summer + colors[2].g * w.autumn + colors[3].g * w.winter,
    colors[0].b * w.spring + colors[1].b * w.summer + colors[2].b * w.autumn + colors[3].b * w.winter
  );
  return out;
}

const _tmpColor = new THREE.Color();

export function sampleSeasonPalette(
  season: number,
  mood: LightingMood,
  out?: SeasonPalette
): SeasonPalette {
  const w = computeSeasonWeights(season);
  const p: SeasonPalette = out ?? {
    leafPrimary: new THREE.Color(),
    leafSecondary: new THREE.Color(),
    leafAccent: new THREE.Color(),
    mossColor: new THREE.Color(),
    skyTop: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    fogColor: new THREE.Color(),
    sunColor: new THREE.Color(),
    ambientColor: new THREE.Color(),
    uiAccent: '#e7a9b8',
    subtitle: '',
  };

  blendFourColors([SPRING_LEAF_1, SUMMER_LEAF_1, AUTUMN_LEAF_1, WINTER_LEAF_1], w, p.leafPrimary);
  blendFourColors([SPRING_LEAF_2, SUMMER_LEAF_2, AUTUMN_LEAF_2, WINTER_LEAF_2], w, p.leafSecondary);
  blendFourColors([SPRING_LEAF_3, SUMMER_LEAF_3, AUTUMN_LEAF_3, WINTER_LEAF_3], w, p.leafAccent);
  blendFourColors(MOSS_COLORS, w, p.mossColor);
  blendFourColors(SKY_TOP_COLORS, w, p.skyTop);
  blendFourColors(SKY_HORIZON_COLORS, w, p.skyHorizon);

  // Apply lighting mood tinting
  if (mood === 'golden') {
    p.skyTop.lerp(_tmpColor.set('#2c2440'), 0.42);
    p.skyHorizon.lerp(_tmpColor.set('#f29c50'), 0.55);
    p.sunColor.set('#ffba75');
    p.ambientColor.set('#7a5b68');
  } else if (mood === 'night') {
    p.skyTop.lerp(_tmpColor.set('#070b14'), 0.82);
    p.skyHorizon.lerp(_tmpColor.set('#18263d'), 0.78);
    p.sunColor.set('#8ab4f8');
    p.ambientColor.set('#24344d');
  } else {
    p.sunColor.set('#fff5e4').lerp(p.skyHorizon, 0.18);
    p.ambientColor.set('#9ab0c4').lerp(p.skyHorizon, 0.25);
  }

  p.fogColor.copy(p.skyHorizon).lerp(p.skyTop, 0.25);

  // Determine dominant season label
  const maxW = Math.max(w.spring, w.summer, w.autumn, w.winter);
  if (maxW === w.spring) {
    p.uiAccent = '#f2a7bb';
    p.subtitle = '春 · 桜吹雪 — Spring Blossom';
  } else if (maxW === w.summer) {
    p.uiAccent = '#4cd48b';
    p.subtitle = '夏 · 翠葉蛍火 — Summer Verdure';
  } else if (maxW === w.autumn) {
    p.uiAccent = '#e86b3a';
    p.subtitle = '秋 · 紅葉映水 — Autumn Maple';
  } else {
    p.uiAccent = '#a8d4f5';
    p.subtitle = '冬 · 雪見禅灯 — Winter Frost';
  }

  // Subtle interpolation for smoothness
  void lerp;
  return p;
}
