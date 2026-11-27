import * as THREE from 'three';
import { createRng } from '../utils/noise';
import { ProceduralTextureSet } from '../utils/proceduralTextures';
import { SeasonWeights } from '../utils/seasonState';

export interface SeasonalParticles {
  group: THREE.Group;
  triggerGust: (weights: SeasonWeights) => void;
  update: (
    dt: number,
    time: number,
    windStrength: number,
    gustBurst: number,
    weights: SeasonWeights,
    isNight: boolean
  ) => void;
}

interface PetalParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  seed: number;
}

export function createSeasonalParticles(
  textures: ProceduralTextureSet,
  spawnPoints: THREE.Vector3[]
): SeasonalParticles {
  const rng = createRng(77123);
  const group = new THREE.Group();

  // 1. Falling Petals (Spring) & Maple Leaves (Autumn)
  const petalCount = 160;
  const petalGeo = new THREE.PlaneGeometry(0.042, 0.042);
  const petalMat = new THREE.MeshBasicMaterial({
    map: textures.petalTexture,
    transparent: true,
    alphaTest: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
  petalMesh.frustumCulled = false;

  const petals: PetalParticle[] = [];
  const dummy = new THREE.Object3D();

  const respawnPetal = (p: PetalParticle, randomLife = false) => {
    const src = spawnPoints[Math.floor(rng() * spawnPoints.length)] ?? new THREE.Vector3(0, 1.3, 0);
    p.pos.set(
      src.x + (rng() - 0.5) * 0.25,
      src.y + (rng() - 0.5) * 0.15,
      src.z + (rng() - 0.5) * 0.25
    );
    p.vel.set((rng() - 0.5) * 0.12, -0.18 - rng() * 0.14, (rng() - 0.5) * 0.12);
    p.rot.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    p.rotSpeed.set((rng() - 0.5) * 3.2, (rng() - 0.5) * 3.2, (rng() - 0.5) * 3.2);
    p.maxLife = 3.5 + rng() * 2.5;
    p.life = randomLife ? rng() * p.maxLife : 0;
    p.scale = 0.65 + rng() * 0.7;
    p.seed = rng() * 100;
  };

  for (let i = 0; i < petalCount; i++) {
    const p: PetalParticle = {
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(),
      rotSpeed: new THREE.Vector3(),
      life: 0,
      maxLife: 4,
      scale: 1,
      seed: 0,
    };
    respawnPetal(p, true);
    petals.push(p);
  }
  group.add(petalMesh);

  // 2. Summer Fireflies (Hotaru)
  const fireflyCount = 42;
  const ffPositions = new Float32Array(fireflyCount * 3);
  const ffSeeds: { base: THREE.Vector3; speed: number; phase: number }[] = [];
  for (let i = 0; i < fireflyCount; i++) {
    const base = new THREE.Vector3(
      (rng() - 0.45) * 1.9,
      0.45 + rng() * 1.45,
      (rng() - 0.5) * 1.4
    );
    ffSeeds.push({ base, speed: 0.6 + rng() * 0.9, phase: rng() * Math.PI * 2 });
    ffPositions[i * 3] = base.x;
    ffPositions[i * 3 + 1] = base.y;
    ffPositions[i * 3 + 2] = base.z;
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPositions, 3));
  const ffMat = new THREE.PointsMaterial({
    map: textures.particleGlow,
    color: new THREE.Color('#c8ff75'),
    size: 0.085,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fireflyPoints = new THREE.Points(ffGeo, ffMat);
  group.add(fireflyPoints);

  // 3. Winter Snowflakes
  const snowCount = 260;
  const snowPositions = new Float32Array(snowCount * 3);
  const snowVel: { vx: number; vy: number; vz: number; phase: number }[] = [];
  for (let i = 0; i < snowCount; i++) {
    snowPositions[i * 3] = (rng() - 0.5) * 3.8;
    snowPositions[i * 3 + 1] = rng() * 2.8;
    snowPositions[i * 3 + 2] = (rng() - 0.5) * 3.2;
    snowVel.push({
      vx: (rng() - 0.5) * 0.12,
      vy: -0.32 - rng() * 0.25,
      vz: (rng() - 0.5) * 0.12,
      phase: rng() * Math.PI * 2,
    });
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snowMat = new THREE.PointsMaterial({
    map: textures.particleGlow,
    color: new THREE.Color('#eef6ff'),
    size: 0.048,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const snowPoints = new THREE.Points(snowGeo, snowMat);
  group.add(snowPoints);

  const springCol = new THREE.Color('#f9c5d5');
  const autumnCol = new THREE.Color('#e35c2b');
  const tmpCol = new THREE.Color();

  const triggerGust = (weights: SeasonWeights) => {
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      if (rng() < 0.65) {
        respawnPetal(p, false);
        p.vel.x += 0.35 + rng() * 0.45;
        p.vel.y += 0.12 + rng() * 0.2;
        p.vel.z += (rng() - 0.5) * 0.35;
      }
    }
    void weights;
  };

  const update = (
    dt: number,
    time: number,
    windStrength: number,
    gustBurst: number,
    weights: SeasonWeights,
    isNight: boolean
  ) => {
    // Petals/leaves active in Spring and Autumn
    const petalActivity = Math.max(weights.spring, weights.autumn);
    const activeCount = Math.floor(petalCount * Math.min(1, petalActivity * 1.15));

    if (weights.spring >= weights.autumn) {
      tmpCol.copy(springCol);
    } else {
      tmpCol.copy(autumnCol);
    }
    petalMat.color.copy(tmpCol);
    petalMesh.visible = activeCount > 0;

    for (let i = 0; i < petalCount; i++) {
      const p = petals[i];
      if (i >= activeCount) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        petalMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife || p.pos.y < 0.02) {
        respawnPetal(p, false);
      }

      const windX = (0.18 + windStrength * 0.65 + gustBurst * 1.2) * (0.7 + 0.3 * Math.sin(time + p.seed));
      const flutter = Math.sin(time * 3.4 + p.seed) * 0.14;

      p.pos.x += (p.vel.x + windX) * dt;
      p.pos.y += (p.vel.y + Math.abs(flutter) * 0.25) * dt;
      p.pos.z += (p.vel.z + flutter * 0.6) * dt;

      p.rot.x += p.rotSpeed.x * dt;
      p.rot.y += p.rotSpeed.y * dt;
      p.rot.z += p.rotSpeed.z * dt;

      const fade = Math.min(1, p.life * 3) * Math.min(1, (p.maxLife - p.life) * 2) * petalActivity;
      const s = p.scale * fade;

      dummy.position.copy(p.pos);
      dummy.rotation.copy(p.rot);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      petalMesh.setMatrixAt(i, dummy.matrix);
    }
    petalMesh.instanceMatrix.needsUpdate = true;

    // Fireflies in Summer
    const ffIntensity = weights.fireflyFactor * (isNight ? 0.95 : 0.45);
    ffMat.opacity = ffIntensity;
    fireflyPoints.visible = ffIntensity > 0.03;
    if (fireflyPoints.visible) {
      const posAttr = ffGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < fireflyCount; i++) {
        const s = ffSeeds[i];
        const t = time * s.speed + s.phase;
        posAttr.setXYZ(
          i,
          s.base.x + Math.sin(t) * 0.18,
          s.base.y + Math.sin(t * 1.4) * 0.12,
          s.base.z + Math.cos(t * 0.9) * 0.18
        );
      }
      posAttr.needsUpdate = true;
    }

    // Snowflakes in Winter
    const snowIntensity = weights.snowAmount * 0.85;
    snowMat.opacity = snowIntensity;
    snowPoints.visible = snowIntensity > 0.03;
    if (snowPoints.visible) {
      const posAttr = snowGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < snowCount; i++) {
        const sv = snowVel[i];
        let x = posAttr.getX(i) + (sv.vx + windStrength * 0.45 + Math.sin(time * 1.5 + sv.phase) * 0.08) * dt;
        let y = posAttr.getY(i) + sv.vy * dt;
        let z = posAttr.getZ(i) + (sv.vz + Math.cos(time * 1.2 + sv.phase) * 0.06) * dt;

        if (y < 0.02) {
          y = 2.75;
          x = (rng() - 0.5) * 3.8;
          z = (rng() - 0.5) * 3.2;
        }
        if (x > 2.2) x = -2.2;
        if (x < -2.2) x = 2.2;
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }
  };

  return {
    group,
    triggerGust,
    update,
  };
}
