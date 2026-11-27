import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Four-season palette system. Colors are THREE.Color; numbers are scalars.
// mixPalette() produces a smoothly interpolated live palette.
// ---------------------------------------------------------------------------

const C = (r, g, b) => new THREE.Color(r, g, b).convertSRGBToLinear();

export const SEASON_NAMES = ['春', '夏', '秋', '冬'];
export const SEASON_NAMES_EN = ['Spring', 'Summer', 'Autumn', 'Winter'];

export const SEASONS = [
  {
    // ---- Spring 春 ----
    name: '春', nameEn: 'Spring',
    skyTop: C(0.32, 0.54, 0.86), skyMid: C(0.52, 0.70, 0.88), skyHorizon: C(0.86, 0.82, 0.76), skyGround: C(0.55, 0.62, 0.55),
    sunColor: C(1.0, 0.95, 0.85), sunIntensity: 2.1, sunElevation: 38, sunAzimuth: 125,
    moonColor: C(0.85, 0.88, 0.95),
    ambientSky: C(0.75, 0.82, 0.95), ambientGround: C(0.45, 0.5, 0.42), ambientIntensity: 0.55,
    fogColor: C(0.80, 0.85, 0.86), fogDensity: 0.012,
    cloudCover: 0.35, stars: 0.0, nightFactor: 0.0,
    // foliage
    leafColor: C(0.42, 0.62, 0.24), leafColor2: C(0.55, 0.72, 0.30), leafColor3: C(0.62, 0.55, 0.22),
    leafTip: C(0.72, 0.78, 0.45), leafShade: C(0.30, 0.44, 0.22), leafTranslucent: C(0.75, 0.85, 0.45),
    newLeafColor: C(0.66, 0.45, 0.42), leafDensity: 1.0, bareness: 0.05,
    barkTint: C(0.52, 0.44, 0.36),
    // blossoms
    bloom: 1.0, petalColor: C(1.0, 0.78, 0.85), petalColor2: C(0.98, 0.9, 0.92), flowerCenter: C(0.98, 0.85, 0.4),
    // ground
    groundGrass: C(0.42, 0.58, 0.28), groundDry: C(0.55, 0.52, 0.34), groundMoss: C(0.28, 0.42, 0.22),
    groundLeafTint: C(0.75, 0.78, 0.7), groundSnow: C(0.92, 0.94, 0.97), snowAmount: 0.0, snowfall: 0.0,
    potSnow: 0.0, snowColor: C(0.96, 0.97, 1.0),
    // accents
    windBase: 0.5, rain: 0.0, fireflies: 0.0, dustMotes: 0.55, fallingLeaves: 0.25, petalsFalling: 1.0,
    gravelTint: C(0.72, 0.70, 0.66), waterTint: C(0.45, 0.62, 0.62),
    uiAccent: '#e8a7b8',
  },
  {
    // ---- Summer 夏 ----
    name: '夏', nameEn: 'Summer',
    skyTop: C(0.22, 0.50, 0.90), skyMid: C(0.45, 0.72, 0.92), skyHorizon: C(0.80, 0.88, 0.92), skyGround: C(0.28, 0.45, 0.32),
    sunColor: C(1.0, 0.98, 0.92), sunIntensity: 2.7, sunElevation: 62, sunAzimuth: 105,
    moonColor: C(0.9, 0.92, 1.0),
    ambientSky: C(0.70, 0.82, 1.0), ambientGround: C(0.30, 0.42, 0.28), ambientIntensity: 0.5,
    fogColor: C(0.62, 0.76, 0.72), fogDensity: 0.009,
    cloudCover: 0.18, stars: 0.0, nightFactor: 0.0,
    leafColor: C(0.20, 0.44, 0.15), leafColor2: C(0.26, 0.52, 0.18), leafColor3: C(0.32, 0.5, 0.18),
    leafTip: C(0.45, 0.6, 0.25), leafShade: C(0.10, 0.26, 0.09), leafTranslucent: C(0.55, 0.75, 0.32),
    newLeafColor: C(0.5, 0.66, 0.28), leafDensity: 1.0, bareness: 0.0,
    barkTint: C(0.5, 0.42, 0.34),
    bloom: 0.0, petalColor: C(1.0, 0.9, 0.92), petalColor2: C(1.0, 1.0, 1.0), flowerCenter: C(0.95, 0.8, 0.3),
    groundGrass: C(0.30, 0.50, 0.20), groundDry: C(0.45, 0.5, 0.28), groundMoss: C(0.18, 0.34, 0.15),
    groundLeafTint: C(0.85, 0.9, 0.8), groundSnow: C(0.92, 0.94, 0.97), snowAmount: 0.0, snowfall: 0.0,
    potSnow: 0.0, snowColor: C(0.96, 0.97, 1.0),
    windBase: 0.4, rain: 0.0, fireflies: 1.0, dustMotes: 0.7, fallingLeaves: 0.1, petalsFalling: 0.0,
    gravelTint: C(0.7, 0.7, 0.66), waterTint: C(0.35, 0.62, 0.60),
    uiAccent: '#8fd18f',
  },
  {
    // ---- Autumn 秋 ----
    name: '秋', nameEn: 'Autumn',
    skyTop: C(0.32, 0.46, 0.68), skyMid: C(0.60, 0.62, 0.62), skyHorizon: C(0.92, 0.76, 0.50), skyGround: C(0.5, 0.44, 0.36),
    sunColor: C(1.0, 0.82, 0.55), sunIntensity: 2.2, sunElevation: 30, sunAzimuth: 145,
    moonColor: C(0.85, 0.82, 0.78),
    ambientSky: C(0.78, 0.78, 0.85), ambientGround: C(0.42, 0.36, 0.28), ambientIntensity: 0.5,
    fogColor: C(0.82, 0.76, 0.62), fogDensity: 0.014,
    cloudCover: 0.3, stars: 0.0, nightFactor: 0.0,
    leafColor: C(0.78, 0.36, 0.12), leafColor2: C(0.85, 0.55, 0.15), leafColor3: C(0.68, 0.22, 0.10),
    leafTip: C(0.92, 0.7, 0.3), leafShade: C(0.42, 0.18, 0.08), leafTranslucent: C(0.95, 0.62, 0.28),
    newLeafColor: C(0.8, 0.5, 0.2), leafDensity: 0.95, bareness: 0.12,
    barkTint: C(0.48, 0.4, 0.32),
    bloom: 0.0, petalColor: C(0.95, 0.85, 0.75), petalColor2: C(1.0, 0.95, 0.85), flowerCenter: C(0.85, 0.6, 0.25),
    groundGrass: C(0.5, 0.44, 0.24), groundDry: C(0.62, 0.52, 0.32), groundMoss: C(0.36, 0.32, 0.18),
    groundLeafTint: C(0.72, 0.55, 0.42), groundSnow: C(0.92, 0.94, 0.97), snowAmount: 0.0, snowfall: 0.0,
    potSnow: 0.0, snowColor: C(0.96, 0.97, 1.0),
    windBase: 0.3, rain: 0.0, fireflies: 0.15, dustMotes: 0.4, fallingLeaves: 1.0, petalsFalling: 0.0,
    gravelTint: C(0.68, 0.64, 0.58), waterTint: C(0.5, 0.58, 0.5),
    uiAccent: '#e0935a',
  },
  {
    // ---- Winter 冬 ----
    name: '冬', nameEn: 'Winter',
    skyTop: C(0.24, 0.34, 0.55), skyMid: C(0.48, 0.54, 0.66), skyHorizon: C(0.78, 0.82, 0.88), skyGround: C(0.62, 0.66, 0.72),
    sunColor: C(0.92, 0.94, 1.0), sunIntensity: 1.5, sunElevation: 22, sunAzimuth: 160,
    moonColor: C(0.92, 0.94, 1.0),
    ambientSky: C(0.72, 0.78, 0.92), ambientGround: C(0.5, 0.52, 0.58), ambientIntensity: 0.62,
    fogColor: C(0.78, 0.82, 0.88), fogDensity: 0.017,
    cloudCover: 0.45, stars: 0.35, nightFactor: 0.05,
    leafColor: C(0.75, 0.78, 0.82), leafColor2: C(0.8, 0.82, 0.86), leafColor3: C(0.7, 0.72, 0.76),
    leafTip: C(0.9, 0.92, 0.95), leafShade: C(0.55, 0.58, 0.62), leafTranslucent: C(0.85, 0.88, 0.92),
    newLeafColor: C(0.78, 0.8, 0.84), leafDensity: 0.5, bareness: 0.75,
    barkTint: C(0.55, 0.55, 0.58),
    bloom: 0.0, petalColor: C(0.95, 0.95, 0.98), petalColor2: C(1.0, 1.0, 1.0), flowerCenter: C(0.8, 0.8, 0.85),
    groundGrass: C(0.75, 0.78, 0.82), groundDry: C(0.8, 0.82, 0.85), groundMoss: C(0.7, 0.72, 0.75),
    groundLeafTint: C(0.85, 0.87, 0.9), groundSnow: C(0.94, 0.95, 0.98), snowAmount: 1.0, snowfall: 1.0,
    potSnow: 1.0, snowColor: C(0.96, 0.97, 1.0),
    windBase: 0.25, rain: 0.0, fireflies: 0.0, dustMotes: 0.2, fallingLeaves: 0.0, petalsFalling: 0.0,
    gravelTint: C(0.85, 0.87, 0.9), waterTint: C(0.7, 0.78, 0.82),
    uiAccent: '#a9c4e8',
  },
];

function isColor(v) { return v && v.isColor; }

// Deep-clone a palette into plain structure (colors cloned).
export function clonePalette(p) {
  const out = {};
  for (const k in p) {
    const v = p[k];
    out[k] = isColor(v) ? v.clone() : v;
  }
  return out;
}

// Lerp scalar + color fields of a into b by t, writing into `out`.
export function mixPaletteInto(out, a, b, t) {
  for (const k in a) {
    const av = a[k], bv = b[k];
    if (isColor(av)) {
      if (!isColor(out[k])) out[k] = new THREE.Color();
      out[k].copy(av).lerp(bv, t);
    } else if (typeof av === 'number') {
      out[k] = av + (bv - av) * t;
    } else {
      out[k] = bv; // strings etc.
    }
  }
  return out;
}
