import * as THREE from 'three';
import { fbm2D, clamp } from './noise';

export interface ProceduralTextureSet {
  barkAlbedo: THREE.DataTexture;
  barkNormal: THREE.DataTexture;
  barkRoughness: THREE.DataTexture;
  ceramicAlbedo: THREE.DataTexture;
  ceramicRoughness: THREE.DataTexture;
  ceramicNormal: THREE.DataTexture;
  woodAlbedo: THREE.DataTexture;
  woodRoughness: THREE.DataTexture;
  stoneAlbedo: THREE.DataTexture;
  stoneNormal: THREE.DataTexture;
  mossAlbedo: THREE.DataTexture;
  mossNormal: THREE.DataTexture;
  foliageAlpha: THREE.CanvasTexture;
  petalTexture: THREE.CanvasTexture;
  particleGlow: THREE.CanvasTexture;
}

function makeDataTex(
  data: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace = THREE.NoColorSpace,
  repeatX = 1,
  repeatY = 1
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function heightToNormal(height: Float32Array, size: number, strength: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const idx = (x: number, y: number) => ((y + size) % size) * size + ((x + size) % size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = height[idx(x - 1, y)];
      const hR = height[idx(x + 1, y)];
      const hD = height[idx(x, y - 1)];
      const hU = height[idx(x, y + 1)];

      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      const i = (y * size + x) * 4;
      out[i] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

function generateBarkTextures(size = 256) {
  const albedo = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // Elongated vertical bark ridges with organic twist
      const ridge = fbm2D(u * 14.0 + fbm2D(u * 4, v * 3, 2) * 1.6, v * 3.5, 4);
      const micro = fbm2D(u * 36.0, v * 16.0, 3);
      const h = clamp(ridge * 0.75 + micro * 0.25, 0, 1);
      height[y * size + x] = h;

      // Deep warm umber in crevices, weathered ash-brown on ridges
      const crevice = Math.pow(h, 1.35);
      const r = Math.round(38 + crevice * 68 + micro * 14);
      const g = Math.round(30 + crevice * 52 + micro * 12);
      const b = Math.round(24 + crevice * 40 + micro * 8);

      const i = (y * size + x) * 4;
      albedo[i] = clamp(r, 0, 255);
      albedo[i + 1] = clamp(g, 0, 255);
      albedo[i + 2] = clamp(b, 0, 255);
      albedo[i + 3] = 255;

      const roughVal = Math.round(clamp(235 - crevice * 45, 140, 250));
      rough[i] = roughVal;
      rough[i + 1] = roughVal;
      rough[i + 2] = roughVal;
      rough[i + 3] = 255;
    }
  }

  const normal = heightToNormal(height, size, 3.2);
  return {
    barkAlbedo: makeDataTex(albedo, size, THREE.SRGBColorSpace, 2, 4),
    barkNormal: makeDataTex(normal, size, THREE.NoColorSpace, 2, 4),
    barkRoughness: makeDataTex(rough, size, THREE.NoColorSpace, 2, 4),
  };
}

function generateCeramicTextures(size = 256) {
  const albedo = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      const glazeFlow = fbm2D(u * 6, v * 6, 4);
      const speckle = fbm2D(u * 42, v * 42, 2);
      // Subtle crackle lines
      const crackleWave = Math.abs(Math.sin((u * 14 + glazeFlow * 2.5) * Math.PI) * Math.cos((v * 14 - glazeFlow * 2.2) * Math.PI));
      const crackle = crackleWave < 0.045 ? 1.0 : 0.0;

      height[y * size + x] = 0.5 + glazeFlow * 0.2 - crackle * 0.15;

      // Deep indigo-celadon Tokoname glaze
      const baseR = 32 + glazeFlow * 24 + (speckle > 0.72 ? 22 : 0) - crackle * 14;
      const baseG = 48 + glazeFlow * 30 + (speckle > 0.72 ? 24 : 0) - crackle * 16;
      const baseB = 58 + glazeFlow * 34 + (speckle > 0.72 ? 20 : 0) - crackle * 12;

      const i = (y * size + x) * 4;
      albedo[i] = clamp(Math.round(baseR), 0, 255);
      albedo[i + 1] = clamp(Math.round(baseG), 0, 255);
      albedo[i + 2] = clamp(Math.round(baseB), 0, 255);
      albedo[i + 3] = 255;

      const roughVal = Math.round(clamp(55 + glazeFlow * 45 + crackle * 90, 35, 180));
      rough[i] = roughVal;
      rough[i + 1] = roughVal;
      rough[i + 2] = roughVal;
      rough[i + 3] = 255;
    }
  }

  return {
    ceramicAlbedo: makeDataTex(albedo, size, THREE.SRGBColorSpace, 2, 1),
    ceramicNormal: makeDataTex(heightToNormal(height, size, 1.4), size, THREE.NoColorSpace, 2, 1),
    ceramicRoughness: makeDataTex(rough, size, THREE.NoColorSpace, 2, 1),
  };
}

function generateWoodTextures(size = 256) {
  const albedo = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const grainNoise = fbm2D(u * 4, v * 28, 3);
      const ring = Math.sin((u * 18 + grainNoise * 3.5) * Math.PI) * 0.5 + 0.5;

      // Rich Shitan rosewood
      const r = Math.round(34 + ring * 26);
      const g = Math.round(18 + ring * 12);
      const b = Math.round(14 + ring * 9);

      const i = (y * size + x) * 4;
      albedo[i] = r;
      albedo[i + 1] = g;
      albedo[i + 2] = b;
      albedo[i + 3] = 255;

      const roughVal = Math.round(70 + (1 - ring) * 40);
      rough[i] = roughVal;
      rough[i + 1] = roughVal;
      rough[i + 2] = roughVal;
      rough[i + 3] = 255;
    }
  }

  return {
    woodAlbedo: makeDataTex(albedo, size, THREE.SRGBColorSpace, 1, 1),
    woodRoughness: makeDataTex(rough, size, THREE.NoColorSpace, 1, 1),
  };
}

function generateStoneTextures(size = 256) {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const strata = fbm2D(u * 5, v * 14, 4);
      const grit = fbm2D(u * 28, v * 28, 3);
      const h = strata * 0.65 + grit * 0.35;
      height[y * size + x] = h;

      const base = 74 + h * 76;
      const i = (y * size + x) * 4;
      albedo[i] = clamp(Math.round(base * 0.96), 0, 255);
      albedo[i + 1] = clamp(Math.round(base * 0.98), 0, 255);
      albedo[i + 2] = clamp(Math.round(base * 1.02), 0, 255);
      albedo[i + 3] = 255;
    }
  }

  return {
    stoneAlbedo: makeDataTex(albedo, size, THREE.SRGBColorSpace, 2, 2),
    stoneNormal: makeDataTex(heightToNormal(height, size, 2.4), size, THREE.NoColorSpace, 2, 2),
  };
}

function generateMossTextures(size = 256) {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const clump = fbm2D(u * 9, v * 9, 4);
      const tuft = fbm2D(u * 38, v * 38, 3);
      const h = clamp(clump * 0.6 + tuft * 0.4, 0, 1);
      height[y * size + x] = h;

      // Neutral-tinted lush moss value modulation (multiplied by seasonal mossColor)
      const shade = 148 + h * 105;
      const i = (y * size + x) * 4;
      albedo[i] = clamp(Math.round(shade * 0.94), 0, 255);
      albedo[i + 1] = clamp(Math.round(shade * 1.03), 0, 255);
      albedo[i + 2] = clamp(Math.round(shade * 0.88), 0, 255);
      albedo[i + 3] = 255;
    }
  }

  return {
    mossAlbedo: makeDataTex(albedo, size, THREE.SRGBColorSpace, 3, 3),
    mossNormal: makeDataTex(heightToNormal(height, size, 2.8), size, THREE.NoColorSpace, 3, 3),
  };
}

function generateFoliageClusterTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Draw a delicate cluster of 7 overlapping organic leaves/petals
  const cx = size / 2;
  const cy = size / 2;
  const leaves = [
    { x: 0, y: -0.22, rot: 0, s: 0.38 },
    { x: -0.22, y: -0.06, rot: -0.65, s: 0.35 },
    { x: 0.22, y: -0.06, rot: 0.65, s: 0.35 },
    { x: -0.18, y: 0.18, rot: -1.25, s: 0.32 },
    { x: 0.18, y: 0.18, rot: 1.25, s: 0.32 },
    { x: 0, y: 0.04, rot: 0.15, s: 0.34 },
    { x: -0.06, y: -0.12, rot: -0.3, s: 0.3 },
  ];

  for (const lf of leaves) {
    ctx.save();
    ctx.translate(cx + lf.x * size, cy + lf.y * size);
    ctx.rotate(lf.rot);
    const len = lf.s * size;
    const wid = len * 0.62;

    const grad = ctx.createRadialGradient(0, -len * 0.15, len * 0.05, 0, 0, len);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(235,235,235,0.98)');
    grad.addColorStop(1, 'rgba(195,195,195,0.92)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, len * 0.45);
    ctx.bezierCurveTo(wid, len * 0.15, wid * 0.85, -len * 0.45, 0, -len * 0.65);
    ctx.bezierCurveTo(-wid * 0.85, -len * 0.45, -wid, len * 0.15, 0, len * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function generatePetalTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.translate(size / 2, size / 2);
  const grad = ctx.createRadialGradient(0, -4, 2, 0, 0, size * 0.45);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(240,240,240,0.85)');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, size * 0.36);
  ctx.bezierCurveTo(size * 0.34, size * 0.1, size * 0.28, -size * 0.32, 0.06 * size, -size * 0.36);
  ctx.lineTo(0, -size * 0.25);
  ctx.lineTo(-0.06 * size, -size * 0.36);
  ctx.bezierCurveTo(-size * 0.28, -size * 0.32, -size * 0.34, size * 0.1, 0, size * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function generateParticleGlow(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(): ProceduralTextureSet {
  const bark = generateBarkTextures(256);
  const ceramic = generateCeramicTextures(256);
  const wood = generateWoodTextures(256);
  const stone = generateStoneTextures(256);
  const moss = generateMossTextures(256);

  return {
    ...bark,
    ...ceramic,
    ...wood,
    ...stone,
    ...moss,
    foliageAlpha: generateFoliageClusterTexture(256),
    petalTexture: generatePetalTexture(64),
    particleGlow: generateParticleGlow(64),
  };
}
