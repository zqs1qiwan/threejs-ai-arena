// CPU-side noise + RNG for procedural geometry. Pure code.

export function makeRng(seed) {
  let s = (seed >>> 0) || 987654321;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function hash12(x, y) {
  let px = (x * 0.1031) % 1; if (px < 0) px += 1;
  let py = (y * 0.1031) % 1; if (py < 0) py += 1;
  let pz = (x * 0.1031) % 1; if (pz < 0) pz += 1;
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px = (px + d) % 1; py = (py + d) % 1; pz = (pz + d) % 1;
  let r = ((px + py) * pz) % 1; if (r < 0) r += 1; return r;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function vnoise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = smooth(fx), uy = smooth(fy);
  const a = hash12(ix, iy), b = hash12(ix + 1, iy);
  const c = hash12(ix, iy + 1), d = hash12(ix + 1, iy + 1);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

export function fbm2(x, y, octaves = 4) {
  let v = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * vnoise2(x * freq, y * freq);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return v / (norm || 1);
}
