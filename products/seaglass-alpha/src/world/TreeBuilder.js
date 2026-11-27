import * as THREE from 'three';
import { makeRng, vnoise2 } from '../core/noise.js';

// ---------------------------------------------------------------------------
// Procedural bonsai (Japanese maple style, moyogi informal-upright).
// Curved tapered trunk + exposed nebari roots + recursive branching.
// Returns bark geometry pieces + leaf anchor transforms. Pure code.
// ---------------------------------------------------------------------------

const _tmp = new THREE.Vector3();

export function sweepTube(curve, tubularSegments, radialSegments, radiusFn, noiseAmp = 0, seed = 0) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const P = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    let r = radiusFn(t);
    const ringStart = positions.length / 3;
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      let rr = r;
      if (noiseAmp > 0) {
        rr += noiseAmp * (vnoise2(t * 12 + seed, a * 1.5 + seed) - 0.5) * 2 * r;
      }
      const nx = (N.x * ca + B.x * sa);
      const ny = (N.y * ca + B.y * sa);
      const nz = (N.z * ca + B.z * sa);
      const vx = P.x + nx * rr;
      const vy = P.y + ny * rr;
      const vz = P.z + nz * rr;
      positions.push(vx, vy, vz);
      normals.push(nx, ny, nz);
      uvs.push(t, j / radialSegments);
    }
  }
  const ring = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ring + j;
      const b = (i + 1) * ring + j;
      const c = (i + 1) * ring + j + 1;
      const d = i * ring + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function buildBranch(origin, dir, length, radius, depth, maxDepth, rng, out, leafAnchors, parentRadius) {
  // slight curvature for organic look
  const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const bend = (rng() - 0.5) * 0.5 * length;
  const mid = origin.clone().addScaledVector(dir, length * 0.5).addScaledVector(perp, bend * 0.4);
  mid.y += (rng() - 0.3) * 0.12 * length;
  const end = origin.clone().addScaledVector(dir, length).addScaledVector(perp, bend * 0.8);
  end.y += (rng() - 0.5) * 0.1 * length;

  const curve = new THREE.CatmullRomCurve3([origin.clone(), mid, end]);
  const geo = sweepTube(curve, 10, 7, (t) => radius * (1.0 - 0.55 * t), 0.04, rng() * 100);
  out.push(geo);

  const childCount = depth < maxDepth ? (depth < maxDepth - 1 ? 2 : 3) : 0;
  const nextRadius = radius * 0.62;

  // leaves along upper part of this branch + at tip
  const leafDensity = depth >= maxDepth - 1 ? 1.0 : 0.35;
  const nLeafClusters = Math.max(1, Math.round((depth >= maxDepth - 1 ? 3 : 1) * leafDensity));
  for (let c = 0; c < nLeafClusters; c++) {
    const t = 0.55 + rng() * 0.45;
    const anchor = curve.getPointAt(t);
    leafAnchors.push(anchor.clone());
  }

  if (depth < maxDepth) {
    for (let i = 0; i < childCount; i++) {
      const spread = 0.5 + rng() * 0.9;
      const azimuth = rng() * Math.PI * 2;
      // child direction: branch off current dir
      const childDir = dir.clone();
      childDir.applyAxisAngle(perp, spread * (0.6 + rng() * 0.5));
      const axis2 = new THREE.Vector3().crossVectors(childDir, perp).normalize();
      childDir.applyAxisAngle(axis2, (rng() - 0.5) * 0.8);
      // keep branches from pointing straight down
      if (childDir.y < -0.55) childDir.y = -0.55;
      childDir.normalize();
      buildBranch(end.clone(), childDir, length * (0.62 + rng() * 0.18), nextRadius, depth + 1, maxDepth, rng, out, leafAnchors, radius);
    }
  }
}

export function buildBonsai(rng, opts = {}) {
  const height = opts.height ?? 3.1;
  const barkGeoms = [];
  const leafAnchors = [];

  // ---- trunk: moyogi S-curve ----
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.10, height * 0.18, 0.06),
    new THREE.Vector3(-0.16, height * 0.42, -0.04),
    new THREE.Vector3(0.14, height * 0.66, 0.10),
    new THREE.Vector3(-0.06, height * 0.86, -0.02),
    new THREE.Vector3(0.04, height, 0.02),
  ]);
  const trunkBase = opts.trunkBase ?? 0.46;
  const trunkGeo = sweepTube(trunkCurve, 48, 18, (t) => trunkBase * (1.0 - 0.62 * t) * (1.0 + 0.12 * Math.sin(t * 7.0)), 0.03, 1);
  barkGeoms.push(trunkGeo);

  // ---- nebari: exposed roots ----
  const rootCount = opts.rootCount ?? 8;
  for (let i = 0; i < rootCount; i++) {
    const a = (i / rootCount) * Math.PI * 2 + rng() * 0.4;
    const len = 0.55 + rng() * 0.5;
    const dir = new THREE.Vector3(Math.cos(a), -0.15, Math.sin(a)).normalize();
    const start = new THREE.Vector3(Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05);
    const mid = start.clone().addScaledVector(dir, len * 0.5); mid.y = 0.04;
    const end = start.clone().addScaledVector(dir, len); end.y = -0.02 + rng() * 0.05;
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const r0 = trunkBase * 0.42 * (0.7 + rng() * 0.5);
    barkGeoms.push(sweepTube(curve, 8, 6, (t) => r0 * (1 - t) * (1 - t * 0.5) + 0.01, 0.05, i));
  }

  // ---- branches from upper trunk ----
  const maxDepth = opts.maxDepth ?? 3;
  const trunkAnchors = 5;
  for (let i = 0; i < trunkAnchors; i++) {
    const t = 0.42 + (i / trunkAnchors) * 0.55;
    const origin = trunkCurve.getPointAt(t);
    const tangent = trunkCurve.getTangentAt(t);
    const a = rng() * Math.PI * 2;
    const horiz = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    // branch direction: mostly horizontal, slight up
    let dir = horiz.clone().multiplyScalar(0.85).add(new THREE.Vector3(0, 0.35, 0)).normalize();
    // avoid co-linearity with trunk tangent
    if (dir.dot(tangent) > 0.9) dir = horiz.clone();
    const branchRadius = trunkBase * (1 - 0.55 * t) * 0.5;
    const branchLen = height * (0.34 - 0.12 * t) * (0.8 + rng() * 0.5);
    buildBranch(origin.clone(), dir, branchLen, branchRadius, 1, maxDepth, rng, barkGeoms, leafAnchors, branchRadius);
  }
  // crown anchors at very top
  leafAnchors.push(trunkCurve.getPointAt(1.0).clone().add(new THREE.Vector3(0, 0.05, 0)));

  return { barkGeoms, leafAnchors, height, trunkCurve };
}

// Build instanced leaf transforms (position, quaternion, scale) from anchors.
export function buildLeafInstances(anchors, rng, opts = {}) {
  const perAnchor = opts.perAnchor ?? 9;
  const leafSize = opts.leafSize ?? 0.42;
  const spread = opts.spread ?? 0.34;
  const bareness = opts.bareness ?? 0;
  const out = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);

  for (const anchor of anchors) {
    const cluster = perAnchor;
    for (let i = 0; i < cluster; i++) {
      if (bareness > 0 && rng() < bareness) continue;
      // spherical-ish shell around anchor
      const r = spread * (0.4 + rng() * 0.9);
      const theta = rng() * Math.PI * 2;
      const phi = (rng() - 0.5) * Math.PI * 0.9;
      const pos = new THREE.Vector3(
        anchor.x + Math.cos(theta) * Math.cos(phi) * r,
        anchor.y + Math.sin(phi) * r * 0.8 + rng() * 0.08,
        anchor.z + Math.sin(theta) * Math.cos(phi) * r,
      );
      // random orientation, slightly facing outward/up
      e.set((rng() - 0.5) * 1.4 + 0.2, rng() * Math.PI * 2, (rng() - 0.5) * 1.4, 'XYZ');
      q.setFromEuler(e);
      const outward = pos.clone().sub(anchor).normalize().multiplyScalar(0.4).add(up.clone().multiplyScalar(0.6)).normalize();
      const targetQ = new THREE.Quaternion().setFromUnitVectors(up, outward);
      q.slerp(targetQ, 0.5);
      const s = leafSize * (0.72 + rng() * 0.55);
      out.push({ pos, quat: q.clone(), scale: s, jitter: rng() });
    }
  }
  return out;
}
