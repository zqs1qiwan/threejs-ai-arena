import * as THREE from 'three';
import { createRng, fbm2D } from '../utils/noise';
import { ProceduralTextureSet } from '../utils/proceduralTextures';
import { applySeasonalSnowShader, SnowUniformRef } from '../shaders/snowMaterial';
import { SeasonPalette, SeasonWeights } from '../utils/seasonState';

export interface BonsaiTreeSystem {
  group: THREE.Group;
  trunkMesh: THREE.Mesh;
  foliageMesh: THREE.InstancedMesh;
  foliagePositions: THREE.Vector3[];
  update: (
    time: number,
    windStrength: number,
    gustBurst: number,
    weights: SeasonWeights,
    palette: SeasonPalette
  ) => void;
}

interface BranchSpec {
  points: THREE.Vector3[];
  radiusStart: number;
  radiusEnd: number;
  radialSegments: number;
  tubularSegments: number;
  isDeadwood?: boolean;
}

/**
 * Generates a custom tapered, fluted organic tube geometry along a CatmullRomCurve3.
 */
function buildTaperedBranchGeometry(spec: BranchSpec): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(spec.points);
  const { tubularSegments, radialSegments, radiusStart, radiusEnd } = spec;
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    // Smooth taper with slight root/knot swell
    const baseRadius = THREE.MathUtils.lerp(radiusStart, radiusEnd, Math.pow(t, 0.82));

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;

      // Subtle bark fluting along trunk
      const flute =
        radiusStart > 0.06
          ? 1.0 + 0.09 * Math.sin(theta * 5.0 + t * 6.0) * (1.0 - t * 0.7)
          : 1.0;
      const r = baseRadius * flute;

      const sin = Math.sin(theta);
      const cos = -Math.cos(theta);

      normal.x = cos * N.x + sin * B.x;
      normal.y = cos * N.y + sin * B.y;
      normal.z = cos * N.z + sin * B.z;
      normal.normalize();

      vertex.copy(p).addScaledVector(normal, r);

      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(v, t * (radiusStart > 0.08 ? 2.5 : 1.0));
    }
  }

  for (let j = 1; j <= tubularSegments; j++) {
    for (let i = 1; i <= radialSegments; i++) {
      const a = (radialSegments + 1) * (j - 1) + (i - 1);
      const b = (radialSegments + 1) * j + (i - 1);
      const c = (radialSegments + 1) * j + i;
      const d = (radialSegments + 1) * (j - 1) + i;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  return geom;
}

/**
 * Merges an array of BufferGeometries with identical attributes.
 */
function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geoms) {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : 0;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const g of geoms) {
    const pos = g.attributes.position.array as Float32Array;
    const norm = g.attributes.normal.array as Float32Array;
    const uv = g.attributes.uv.array as Float32Array;
    const idx = g.index!.array;

    positions.set(pos, vOffset * 3);
    normals.set(norm, vOffset * 3);
    uvs.set(uv, vOffset * 2);

    for (let i = 0; i < idx.length; i++) {
      indices[iOffset + i] = idx[i] + vOffset;
    }

    vOffset += g.attributes.position.count;
    iOffset += idx.length;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

export function createBonsaiTree(
  textures: ProceduralTextureSet,
  snowUniform: SnowUniformRef
): BonsaiTreeSystem {
  const rng = createRng(20261127);
  const group = new THREE.Group();
  // Anchored on left-center moss mound
  group.position.set(-0.28, 0.41, -0.05);

  const barkGeoms: THREE.BufferGeometry[] = [];
  const deadwoodGeoms: THREE.BufferGeometry[] = [];
  const twigTips: { pos: THREE.Vector3; dir: THREE.Vector3; padRadius: number }[] = [];

  // 1. Hero Moyogi Trunk (graceful S-curve leaning right toward the pond)
  const trunkPoints = [
    new THREE.Vector3(0.0, -0.05, 0.0),
    new THREE.Vector3(-0.06, 0.22, 0.04),
    new THREE.Vector3(0.08, 0.54, 0.08),
    new THREE.Vector3(0.28, 0.86, 0.02),
    new THREE.Vector3(0.16, 1.18, -0.04),
    new THREE.Vector3(0.26, 1.44, -0.02),
  ];
  barkGeoms.push(
    buildTaperedBranchGeometry({
      points: trunkPoints,
      radiusStart: 0.145,
      radiusEnd: 0.032,
      radialSegments: 14,
      tubularSegments: 36,
    })
  );

  // 2. Nebari (6 muscular surface roots gripping the moss)
  for (let r = 0; r < 6; r++) {
    const angle = (r / 6) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const len = 0.24 + rng() * 0.14;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    barkGeoms.push(
      buildTaperedBranchGeometry({
        points: [
          new THREE.Vector3(dx * 0.04, 0.1, dz * 0.04),
          new THREE.Vector3(dx * len * 0.52, 0.035, dz * len * 0.52),
          new THREE.Vector3(dx * len, -0.045, dz * len),
        ],
        radiusStart: 0.062,
        radiusEnd: 0.014,
        radialSegments: 8,
        tubularSegments: 10,
      })
    );
  }

  // 3. Bleached Jin Deadwood Spire (authentic bonsai accent)
  deadwoodGeoms.push(
    buildTaperedBranchGeometry({
      points: [
        new THREE.Vector3(-0.04, 0.46, 0.06),
        new THREE.Vector3(-0.22, 0.58, 0.12),
        new THREE.Vector3(-0.34, 0.72, 0.08),
      ],
      radiusStart: 0.036,
      radiusEnd: 0.004,
      radialSegments: 8,
      tubularSegments: 12,
      isDeadwood: true,
    })
  );

  // 4. Primary Boughs & Cloud Pads (multi-order branching)
  const boughs = [
    // Lower left sweeping bough
    {
      start: new THREE.Vector3(0.05, 0.52, 0.07),
      mid: new THREE.Vector3(-0.24, 0.62, 0.14),
      end: new THREE.Vector3(-0.56, 0.72, 0.16),
      r0: 0.056,
      padRadius: 0.24,
    },
    // Mid right dramatic bough over the pond
    {
      start: new THREE.Vector3(0.24, 0.78, 0.03),
      mid: new THREE.Vector3(0.54, 0.84, 0.10),
      end: new THREE.Vector3(0.84, 0.90, 0.06),
      r0: 0.052,
      padRadius: 0.27,
    },
    // Back depth bough
    {
      start: new THREE.Vector3(0.22, 0.94, -0.01),
      mid: new THREE.Vector3(0.12, 1.06, -0.26),
      end: new THREE.Vector3(0.02, 1.14, -0.46),
      r0: 0.044,
      padRadius: 0.23,
    },
    // Upper left counter-balance bough
    {
      start: new THREE.Vector3(0.18, 1.14, -0.03),
      mid: new THREE.Vector3(-0.08, 1.24, 0.05),
      end: new THREE.Vector3(-0.34, 1.30, 0.04),
      r0: 0.038,
      padRadius: 0.22,
    },
    // Upper right shoulder bough
    {
      start: new THREE.Vector3(0.22, 1.28, -0.02),
      mid: new THREE.Vector3(0.44, 1.34, -0.05),
      end: new THREE.Vector3(0.62, 1.38, -0.02),
      r0: 0.034,
      padRadius: 0.20,
    },
    // Apex crown
    {
      start: new THREE.Vector3(0.25, 1.42, -0.02),
      mid: new THREE.Vector3(0.26, 1.54, 0.01),
      end: new THREE.Vector3(0.22, 1.62, 0.02),
      r0: 0.028,
      padRadius: 0.25,
    },
  ];

  for (const b of boughs) {
    barkGeoms.push(
      buildTaperedBranchGeometry({
        points: [b.start, b.mid, b.end],
        radiusStart: b.r0,
        radiusEnd: b.r0 * 0.34,
        radialSegments: 9,
        tubularSegments: 14,
      })
    );

    // Secondary & tertiary sub-branches fanning out into flat cloud pads
    const subCount = 5;
    for (let s = 0; s < subCount; s++) {
      const tAlong = 0.48 + (s / (subCount - 1)) * 0.52;
      const origin = new THREE.Vector3().lerpVectors(b.mid, b.end, (tAlong - 0.45) / 0.55);
      const yaw = (s - (subCount - 1) / 2) * 0.65 + (rng() - 0.5) * 0.3;
      const spread = 0.14 + rng() * 0.12;
      const dir = new THREE.Vector3().subVectors(b.end, b.start).normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      const subMid = origin.clone().addScaledVector(dir, spread * 0.55);
      subMid.y += 0.035 + rng() * 0.03;
      const subEnd = origin.clone().addScaledVector(dir, spread);
      subEnd.y += 0.05 + rng() * 0.04;

      barkGeoms.push(
        buildTaperedBranchGeometry({
          points: [origin, subMid, subEnd],
          radiusStart: b.r0 * 0.36,
          radiusEnd: 0.006,
          radialSegments: 6,
          tubularSegments: 8,
        })
      );

      twigTips.push({ pos: subEnd, dir, padRadius: b.padRadius });
    }
    twigTips.push({
      pos: b.end.clone().add(new THREE.Vector3(0, 0.04, 0)),
      dir: new THREE.Vector3(0, 1, 0),
      padRadius: b.padRadius,
    });
  }

  // Bark material with seasonal snow
  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.barkAlbedo,
    normalMap: textures.barkNormal,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: textures.barkRoughness,
    roughness: 0.92,
    metalness: 0.02,
  });
  applySeasonalSnowShader(barkMat, snowUniform, { snowSlopeThreshold: 0.45, maxSnowCover: 0.9 });

  const trunkMesh = new THREE.Mesh(mergeGeometries(barkGeoms), barkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  // Deadwood material (sun-bleached silver-tan)
  const deadwoodMat = new THREE.MeshStandardMaterial({
    map: textures.barkAlbedo,
    normalMap: textures.barkNormal,
    color: new THREE.Color('#c8bfb2'),
    roughness: 0.85,
    metalness: 0.02,
  });
  applySeasonalSnowShader(deadwoodMat, snowUniform, { snowSlopeThreshold: 0.45, maxSnowCover: 0.88 });
  const deadwoodMesh = new THREE.Mesh(mergeGeometries(deadwoodGeoms), deadwoodMat);
  deadwoodMesh.castShadow = true;
  deadwoodMesh.receiveShadow = true;
  group.add(deadwoodMesh);

  // 5. Instanced Foliage Cloud Pads (Crossed / Angled Leaf Cards for volumetric fullness)
  const cardsPerTip = 46;
  const totalInstances = twigTips.length * cardsPerTip;
  const cardGeo = new THREE.PlaneGeometry(0.145, 0.145);

  const foliageUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.45 },
    uGust: { value: 0 },
    uFoliageScale: { value: 1.0 },
  };

  const foliageMat = new THREE.MeshStandardMaterial({
    map: textures.foliageAlpha,
    alphaTest: 0.38,
    side: THREE.DoubleSide,
    roughness: 0.68,
    metalness: 0.0,
  });

  foliageMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = foliageUniforms.uTime;
    shader.uniforms.uWind = foliageUniforms.uWind;
    shader.uniforms.uGust = foliageUniforms.uGust;
    shader.uniforms.uFoliageScale = foliageUniforms.uFoliageScale;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWind;
         uniform float uGust;
         uniform float uFoliageScale;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed *= uFoliageScale;
         vec4 instCenter = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         float phase = instCenter.x * 4.2 + instCenter.y * 2.7 + instCenter.z * 3.8;
         float swayAmp = (0.012 + uWind * 0.028 + uGust * 0.055) * (0.4 + uv.y * 0.6);
         transformed.x += sin(uTime * 2.2 + phase) * swayAmp;
         transformed.z += cos(uTime * 1.8 + phase * 1.1) * swayAmp * 0.7;
         transformed.y += sin(uTime * 3.1 + phase) * swayAmp * 0.25;`
      );
  };
  foliageMat.customProgramCacheKey = () => 'bonsai-foliage-sway';

  const foliageMesh = new THREE.InstancedMesh(cardGeo, foliageMat, totalInstances);
  foliageMesh.castShadow = true;
  foliageMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const foliagePositions: THREE.Vector3[] = [];
  const instanceSeeds: { colorRole: number; noiseVal: number }[] = [];

  let idx = 0;
  for (const tip of twigTips) {
    for (let c = 0; c < cardsPerTip; c++) {
      // Flattened oblate pad distribution
      const r = Math.pow(rng(), 0.55) * tip.padRadius * 0.58;
      const theta = rng() * Math.PI * 2;
      const yOff = (rng() - 0.35) * 0.11;

      const px = tip.pos.x + Math.cos(theta) * r;
      const py = tip.pos.y + yOff;
      const pz = tip.pos.z + Math.sin(theta) * r;

      dummy.position.set(px, py, pz);
      dummy.rotation.set(
        (rng() - 0.5) * 1.3,
        rng() * Math.PI * 2,
        (rng() - 0.5) * 1.1
      );
      const s = 0.75 + rng() * 0.65;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      foliageMesh.setMatrixAt(idx, dummy.matrix);

      // World-space position for falling particles spawning
      foliagePositions.push(
        new THREE.Vector3(px + group.position.x, py + group.position.y, pz + group.position.z)
      );

      const n = fbm2D(px * 4.5 + 10, pz * 4.5 + 10, 2);
      instanceSeeds.push({
        colorRole: rng(),
        noiseVal: n,
      });
      idx++;
    }
  }
  foliageMesh.instanceMatrix.needsUpdate = true;

  const tmpColor = new THREE.Color();
  const updateColors = (palette: SeasonPalette) => {
    for (let i = 0; i < totalInstances; i++) {
      const seed = instanceSeeds[i];
      if (seed.colorRole < 0.52) {
        tmpColor.copy(palette.leafPrimary);
      } else if (seed.colorRole < 0.84) {
        tmpColor.copy(palette.leafSecondary);
      } else {
        tmpColor.copy(palette.leafAccent);
      }
      // Subtle per-cluster brightness + height-based ambient occlusion
      const heightAO = THREE.MathUtils.clamp(0.76 + (foliagePositions[i].y - 0.85) * 0.28, 0.74, 1.12);
      const shade = (0.86 + seed.noiseVal * 0.24) * heightAO;
      tmpColor.multiplyScalar(shade);
      foliageMesh.setColorAt(i, tmpColor);
    }
    if (foliageMesh.instanceColor) {
      foliageMesh.instanceColor.needsUpdate = true;
    }
  };

  group.add(foliageMesh);

  let lastPaletteSig = '';

  const update = (
    time: number,
    windStrength: number,
    gustBurst: number,
    weights: SeasonWeights,
    palette: SeasonPalette
  ) => {
    foliageUniforms.uTime.value = time;
    foliageUniforms.uWind.value = windStrength;
    foliageUniforms.uGust.value = gustBurst;
    foliageUniforms.uFoliageScale.value = weights.foliageScale;

    // Gentle whole-crown micro-sway under strong gusts
    group.rotation.z = Math.sin(time * 1.3) * 0.004 * (windStrength + gustBurst * 1.6);

    const sig = `${palette.leafPrimary.getHex()}_${palette.leafSecondary.getHex()}`;
    if (sig !== lastPaletteSig) {
      lastPaletteSig = sig;
      updateColors(palette);
    }
  };

  return {
    group,
    trunkMesh,
    foliageMesh,
    foliagePositions,
    update,
  };
}
