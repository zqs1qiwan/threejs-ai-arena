import * as THREE from 'three';
import { createRng, fbm2D } from '../utils/noise';
import { ProceduralTextureSet } from '../utils/proceduralTextures';
import { applySeasonalSnowShader, SnowUniformRef } from '../shaders/snowMaterial';
import { createPondWaterMaterial, WaterUniforms } from '../shaders/waterShader';
import { SeasonPalette, SeasonWeights } from '../utils/seasonState';

export interface BonsaiLandscape {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  waterUniforms: WaterUniforms;
  lanternGroup: THREE.Group;
  lanternLight: THREE.PointLight;
  lanternCoreMat: THREE.MeshStandardMaterial;
  mossMat: THREE.MeshStandardMaterial;
  setLanternLit: (lit: boolean) => void;
  isLanternLit: () => boolean;
  update: (time: number, weights: SeasonWeights, palette: SeasonPalette, isNight: boolean) => void;
}

/**
 * Computes terrain height inside the oval bonsai basin.
 * Left-center has a raised mound for the hero bonsai; right-front dips into a reflection pond.
 */
export function sampleBasinHeight(x: number, z: number): number {
  const pondDx = (x - 0.42) / 0.56;
  const pondDz = (z - 0.14) / 0.42;
  const pondDist = Math.sqrt(pondDx * pondDx + pondDz * pondDz);

  const treeDx = (x + 0.28) / 0.68;
  const treeDz = (z + 0.05) / 0.52;
  const treeDist = Math.sqrt(treeDx * treeDx + treeDz * treeDz);

  let h = 0.39;
  // Mound under the tree
  h += Math.max(0, 1 - treeDist * treeDist) * 0.075;
  // Dip for the pond
  h -= Math.max(0, 1 - pondDist * pondDist) * 0.105;
  // Organic micro-undulation
  h += (fbm2D(x * 3.5 + 4, z * 3.5 + 4, 3) - 0.5) * 0.032;

  return h;
}

function createSuisekiRock(
  radius: number,
  seed: number,
  mat: THREE.Material
): THREE.Mesh {
  // Use indexed SphereGeometry so computeVertexNormals produces smooth normals (no facets)
  const geo = new THREE.SphereGeometry(radius, 28, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    const n = fbm2D(vx * 4.2 + seed, vz * 4.2 + seed * 1.7, 3);
    const strata = Math.sin(vy * 14.0 + n * 3.5) * 0.065;
    const scale = 0.78 + n * 0.44 + strata;
    pos.setXYZ(i, vx * scale, vy * scale * 0.68, vz * scale);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createBonsaiLandscape(
  textures: ProceduralTextureSet,
  snowUniform: SnowUniformRef
): BonsaiLandscape {
  const rng = createRng(90421);
  const group = new THREE.Group();

  // 1. Exhibition Plinth / Gallery Table (grounds the entire scene seamlessly)
  const plinthMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#191c22'),
    roughness: 0.78,
    metalness: 0.06,
  });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10.0, 0.28, 72), plinthMat);
  plinth.position.set(0, -0.14, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  // Subtle recessed brass inlay ring on the plinth
  const ringMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8c734b'),
    roughness: 0.35,
    metalness: 0.78,
  });
  const inlayRing = new THREE.Mesh(new THREE.RingGeometry(1.78, 1.805, 64), ringMat);
  inlayRing.rotation.x = -Math.PI / 2;
  inlayRing.position.y = 0.001;
  group.add(inlayRing);

  // 2. Rosewood Display Stand (Jita) resting at y = 0.0 -> 0.085
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodAlbedo,
    roughnessMap: textures.woodRoughness,
    roughness: 0.42,
    metalness: 0.06,
  });

  const standGroup = new THREE.Group();
  const standTop = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.045, 1.95), woodMat);
  standTop.position.y = 0.0625;
  standTop.castShadow = true;
  standTop.receiveShadow = true;
  standGroup.add(standTop);

  // 4 carved stand feet
  const footOffsets = [
    [-1.12, -0.78],
    [1.12, -0.78],
    [-1.12, 0.78],
    [1.12, 0.78],
  ];
  for (const [fx, fz] of footOffsets) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.16), woodMat);
    foot.position.set(fx, 0.02, fz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    standGroup.add(foot);
  }
  group.add(standGroup);

  // 3. Handcrafted Glazed Ceramic Bonsai Pot (resting on stand at y = 0.085)
  const ceramicMat = new THREE.MeshStandardMaterial({
    map: textures.ceramicAlbedo,
    normalMap: textures.ceramicNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: textures.ceramicRoughness,
    roughness: 0.36,
    metalness: 0.12,
  });
  applySeasonalSnowShader(ceramicMat, snowUniform, { snowSlopeThreshold: 0.65, maxSnowCover: 0.85 });

  // Build oval pot using scaled LatheGeometry profile
  const potProfile = [
    new THREE.Vector2(0.0, 0.04),
    new THREE.Vector2(0.86, 0.04),
    new THREE.Vector2(0.92, 0.06),
    new THREE.Vector2(0.98, 0.28),
    new THREE.Vector2(1.04, 0.32),
    new THREE.Vector2(1.04, 0.365),
    new THREE.Vector2(0.95, 0.365),
    new THREE.Vector2(0.92, 0.28),
    new THREE.Vector2(0.0, 0.26),
  ];
  const potGeo = new THREE.LatheGeometry(potProfile, 48);
  potGeo.scale(1.18, 1.0, 0.86);
  const potMesh = new THREE.Mesh(potGeo, ceramicMat);
  potMesh.position.y = 0.085;
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  group.add(potMesh);

  // 4 pot drainage feet
  for (const [fx, fz] of [
    [-0.78, -0.48],
    [0.78, -0.48],
    [-0.78, 0.48],
    [0.78, 0.48],
  ]) {
    const pFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.045, 12), ceramicMat);
    pFoot.position.set(fx, 0.1075, fz);
    pFoot.castShadow = true;
    pFoot.receiveShadow = true;
    group.add(pFoot);
  }

  // 4. Sculpted Moss & Soil Terrain inside the pot
  const terrainGeo = new THREE.PlaneGeometry(2.14, 1.56, 64, 48);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    // Clamp to oval pot interior
    const ovalR = Math.sqrt((x / 1.05) ** 2 + (z / 0.76) ** 2);
    if (ovalR > 1.0) {
      tPos.setX(i, x / ovalR);
      tPos.setZ(i, z / ovalR);
    }
    const nx = tPos.getX(i);
    const nz = tPos.getZ(i);
    tPos.setY(i, sampleBasinHeight(nx, nz));
  }
  terrainGeo.computeVertexNormals();

  const mossMat = new THREE.MeshStandardMaterial({
    map: textures.mossAlbedo,
    normalMap: textures.mossNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    color: new THREE.Color('#4a7c44'),
    roughness: 0.94,
    metalness: 0.0,
  });
  applySeasonalSnowShader(mossMat, snowUniform, { snowSlopeThreshold: 0.35, maxSnowCover: 0.94 });

  const terrainMesh = new THREE.Mesh(terrainGeo, mossMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Instanced 3D soft cushion moss mounds (Koke) around roots & rocks
  const tuftGeo = new THREE.SphereGeometry(0.026, 8, 6);
  tuftGeo.scale(1.25, 0.42, 1.25);
  const tuftCount = 240;
  const tuftMesh = new THREE.InstancedMesh(tuftGeo, mossMat, tuftCount);
  const tuftDummy = new THREE.Object3D();
  let placedTufts = 0;
  let attempts = 0;
  while (placedTufts < tuftCount && attempts < 1400) {
    attempts++;
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 0.92;
    const tx = Math.cos(ang) * rad * 1.02;
    const tz = Math.sin(ang) * rad * 0.72;
    const ty = sampleBasinHeight(tx, tz);
    // Skip pond area
    if (ty < 0.358) continue;
    tuftDummy.position.set(tx, ty - 0.004, tz);
    tuftDummy.rotation.set((rng() - 0.5) * 0.15, rng() * Math.PI * 2, (rng() - 0.5) * 0.15);
    const sc = 0.65 + rng() * 1.05;
    tuftDummy.scale.set(sc, sc * (0.75 + rng() * 0.45), sc);
    tuftDummy.updateMatrix();
    tuftMesh.setMatrixAt(placedTufts, tuftDummy.matrix);
    placedTufts++;
  }
  tuftMesh.count = placedTufts;
  tuftMesh.instanceMatrix.needsUpdate = true;
  tuftMesh.receiveShadow = true;
  group.add(tuftMesh);

  // 5. Miniature Reflection Pond
  const { material: waterMat, uniforms: waterUniforms } = createPondWaterMaterial();
  const waterGeo = new THREE.CircleGeometry(0.56, 48, 0, Math.PI * 2);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.scale(1.0, 1.0, 0.75);
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0.42, 0.345, 0.14);
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  // 6. Stone Material for Suiseki, Pebbles & Tōrō Lantern
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneAlbedo,
    normalMap: textures.stoneNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.88,
    metalness: 0.04,
  });
  applySeasonalSnowShader(stoneMat, snowUniform, { snowSlopeThreshold: 0.42, maxSnowCover: 0.9 });

  // Suiseki viewing stones framing the tree & pond
  const rockPlacements = [
    { x: -0.66, z: -0.26, r: 0.16, s: 1.1 },
    { x: -0.52, z: -0.38, r: 0.11, s: 2.3 },
    { x: 0.02, z: -0.28, r: 0.14, s: 3.7 },
    { x: 0.84, z: -0.18, r: 0.12, s: 4.9 },
    { x: -0.05, z: 0.36, r: 0.09, s: 6.1 },
  ];
  for (const rp of rockPlacements) {
    const rock = createSuisekiRock(rp.r, rp.s, stoneMat);
    const y = sampleBasinHeight(rp.x, rp.z);
    rock.position.set(rp.x, y + rp.r * 0.25, rp.z);
    rock.rotation.y = rng() * Math.PI * 2;
    group.add(rock);
  }

  // Pond shoreline pebbles
  const pebbleGeo = new THREE.DodecahedronGeometry(0.032, 1);
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2 + rng() * 0.2;
    const rx = 0.42 + Math.cos(ang) * (0.46 + rng() * 0.08);
    const rz = 0.14 + Math.sin(ang) * (0.34 + rng() * 0.06);
    const py = sampleBasinHeight(rx, rz);
    const pebble = new THREE.Mesh(pebbleGeo, stoneMat);
    pebble.position.set(rx, Math.max(py, 0.34), rz);
    pebble.scale.set(0.8 + rng() * 0.8, 0.45 + rng() * 0.3, 0.8 + rng() * 0.7);
    pebble.rotation.y = rng() * Math.PI;
    pebble.castShadow = true;
    pebble.receiveShadow = true;
    group.add(pebble);
  }

  // 7. Miniature Wooden Zen Bridge across the narrow pond edge
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(0.14, 0.365, 0.14);
  bridgeGroup.rotation.y = -0.35;
  const plankCount = 7;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1) - 0.5;
    const archY = Math.cos(t * Math.PI) * 0.045;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.012, 0.165), woodMat);
    plank.position.set(t * 0.34, archY, 0);
    plank.rotation.z = -Math.sin(t * Math.PI) * 0.24;
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);
  }
  // Curved side stringers supporting the bridge planks
  for (const zSide of [-0.072, 0.072]) {
    const archPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8 - 0.5;
      archPts.push(new THREE.Vector3(t * 0.38, Math.cos(t * Math.PI) * 0.045 - 0.008, zSide));
    }
    const archCurve = new THREE.CatmullRomCurve3(archPts);
    const beam = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 12, 0.009, 6, false), woodMat);
    beam.castShadow = true;
    bridgeGroup.add(beam);
  }
  group.add(bridgeGroup);

  // 8. Carved Stone Yukimi-dōrō (Snow-Viewing Lantern)
  const lanternGroup = new THREE.Group();
  const lx = 0.62;
  const lz = -0.32;
  const ly = sampleBasinHeight(lx, lz) - 0.01;
  lanternGroup.position.set(lx, ly, lz);

  // Base pedestal
  const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.05, 6), stoneMat);
  lBase.position.y = 0.025;
  lBase.castShadow = true;
  lanternGroup.add(lBase);

  // Post
  const lPost = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.11, 6), stoneMat);
  lPost.position.y = 0.105;
  lPost.castShadow = true;
  lanternGroup.add(lPost);

  // Firebox platform
  const lPlat = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.05, 0.024, 6), stoneMat);
  lPlat.position.y = 0.17;
  lPlat.castShadow = true;
  lanternGroup.add(lPlat);

  // Glowing paper core (Hibukuro)
  const lanternCoreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffdf9e'),
    emissive: new THREE.Color('#ff9d3b'),
    emissiveIntensity: 1.6,
    roughness: 0.5,
  });
  const lCore = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.068, 6), lanternCoreMat);
  lCore.position.y = 0.215;
  lanternGroup.add(lCore);

  // 4 corner pillars around core
  for (let p = 0; p < 4; p++) {
    const a = (p / 4) * Math.PI * 2 + Math.PI / 4;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.072, 0.011), stoneMat);
    pillar.position.set(Math.cos(a) * 0.042, 0.215, Math.sin(a) * 0.042);
    lanternGroup.add(pillar);
  }

  // Broad snow-catching pagoda roof (Kasa)
  const lRoof = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.068, 6), stoneMat);
  lRoof.position.y = 0.282;
  lRoof.castShadow = true;
  lanternGroup.add(lRoof);

  // Finial (Hōju)
  const lFinial = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), stoneMat);
  lFinial.position.y = 0.322;
  lanternGroup.add(lFinial);

  // Warm point light inside lantern (calibrated to avoid washing out winter snow)
  const lanternLight = new THREE.PointLight('#ff9f45', 0.45, 1.8, 1.5);
  lanternLight.position.set(0, 0.22, 0);
  lanternGroup.add(lanternLight);

  group.add(lanternGroup);

  let lanternLit = true;
  const setLanternLit = (lit: boolean) => {
    lanternLit = lit;
  };
  const isLanternLit = () => lanternLit;

  const update = (
    time: number,
    weights: SeasonWeights,
    palette: SeasonPalette,
    isNight: boolean
  ) => {
    mossMat.color.copy(palette.mossColor);

    waterUniforms.uTime.value = time;
    waterUniforms.uIceFactor.value = weights.iceFactor;
    waterUniforms.uSkyColor.value.copy(palette.skyHorizon).lerp(palette.skyTop, 0.25);

    // Lantern warm flicker
    if (lanternLit) {
      const flicker = 0.93 + Math.sin(time * 7.3) * 0.04 + Math.sin(time * 13.7) * 0.03;
      const baseIntensity = isNight ? 0.85 : 0.32 + weights.winter * 0.14 + weights.autumn * 0.12;
      lanternLight.intensity = baseIntensity * flicker;
      lanternCoreMat.emissiveIntensity = (isNight ? 2.1 : 1.3) * flicker;
    } else {
      lanternLight.intensity = 0;
      lanternCoreMat.emissiveIntensity = 0.05;
    }
  };

  return {
    group,
    waterMesh,
    waterUniforms,
    lanternGroup,
    lanternLight,
    lanternCoreMat,
    mossMat,
    setLanternLit,
    isLanternLit,
    update,
  };
}
