import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.glsl.js';
import { makeRng } from '../core/noise.js';
import { createMapleLeafGeometry } from './leaf.js';

// Procedural ground: moss/grass/gravel shader + scattered fallen leaves,
// pebbles and stones. Pure code, no textures.
export class Ground {
  constructor(scene, opts = {}) {
    this.group = new THREE.Group();
    this.group.name = 'ground';
    scene.add(this.group);

    const size = opts.size ?? 60;
    const seg = opts.segments ?? 120;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    // gentle terrain undulation away from pot center
    const pos = geo.attributes.position;
    const rng = makeRng(77);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.sqrt(x * x + z * z);
      const flat = Math.min(1, Math.max(0, (d - 3.5) / 8)); // keep area under pot flat
      const h = (Math.sin(x * 0.18) * 0.12 + Math.cos(z * 0.15) * 0.12 + (rng() - 0.5) * 0.05) * flat;
      pos.setY(i, h);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, metalness: 0.0 });
    const u = {
      uGroundGrass: { value: new THREE.Color(0.42, 0.58, 0.28) },
      uGroundDry: { value: new THREE.Color(0.55, 0.52, 0.34) },
      uGroundMoss: { value: new THREE.Color(0.28, 0.42, 0.22) },
      uGroundLeafTint: { value: new THREE.Color(0.75, 0.78, 0.7) },
      uGroundSnow: { value: new THREE.Color(0.94, 0.95, 0.98) },
      uSnowAmount: { value: 0 },
      uGravelTint: { value: new THREE.Color(0.72, 0.70, 0.66) },
      uPotRadius: { value: 2.6 },
    };
    mat.userData.uniforms = u;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nvarying vec3 vWP;\n
          uniform vec3 uGroundGrass; uniform vec3 uGroundDry; uniform vec3 uGroundMoss;
          uniform vec3 uGroundLeafTint; uniform vec3 uGroundSnow; uniform float uSnowAmount;
          uniform vec3 uGravelTint; uniform float uPotRadius;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 wp = vWP.xz;
          float dist = length(wp);
          // base grass + dry patches + moss
          float patchN = fbm(wp * 0.45, 4);
          float mossN = fbm(wp * 1.3 + 5.0, 4);
          vec3 grass = mix(uGroundGrass, uGroundDry, smoothstep(0.35, 0.75, patchN));
          grass = mix(grass, uGroundMoss, smoothstep(0.45, 0.8, mossN) * 0.55);
          // fine blade variation
          float blade = vnoise(wp * 8.0);
          grass *= 0.9 + 0.2 * blade;
          vec3 col = grass * uGroundLeafTint;
          // gravel ring around pot
          float ring = smoothstep(uPotRadius - 0.2, uPotRadius + 0.1, dist) * smoothstep(uPotRadius + 1.6, uPotRadius + 1.0, dist);
          float grit = worley(wp * 9.0);
          vec3 gravel = uGravelTint * (0.78 + 0.3 * grit);
          col = mix(col, gravel, ring * 0.18);
          // scattered fallen leaf specks (inner ground, non-winter handled by instances too)
          float leafSpeck = smoothstep(0.72, 0.78, vnoise(wp * 5.0 + 31.0)) * (1.0 - ring);
          col = mix(col, col * vec3(1.1, 0.85, 0.7), leafSpeck * 0.3 * (1.0 - uSnowAmount));
          // winter snow blanket
          float snowEdge = fbm(wp * 1.1 + 9.0, 4);
          float snow = uSnowAmount * smoothstep(0.2, 0.8, snowEdge + uSnowAmount * 0.6);
          snow = clamp(snow, 0.0, 1.0);
          col = mix(col, uGroundSnow, snow);
          diffuseColor.rgb = col;`);
    };

    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.group.add(ground);
    this.material = mat;
    this.u = u;

    // ---- scattered pebbles ----
    const pebGeo = new THREE.IcosahedronGeometry(0.12, 0);
    const pebMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.54, 0.5), roughness: 0.9 });
    const pebCount = 70;
    const pebbles = new THREE.InstancedMesh(pebGeo, pebMat, pebCount);
    const m = new THREE.Matrix4(); const s = new THREE.Vector3(); const q = new THREE.Quaternion();
    for (let i = 0; i < pebCount; i++) {
      const a = rng() * Math.PI * 2;
      const r = 2.4 + rng() * 12;
      const sc = 0.3 + rng() * 1.6;
      s.set(sc, sc * (0.5 + rng() * 0.5), sc);
      q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
      m.compose(new THREE.Vector3(Math.cos(a) * r, 0.02, Math.sin(a) * r), q, s);
      pebbles.setMatrixAt(i, m);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    pebbles.castShadow = true; pebbles.receiveShadow = true;
    this.group.add(pebbles);

    // ---- fallen leaves on ground (instanced, seasonal opacity) ----
    this.fallenGeo = createMapleLeafGeometry({ size: 0.42 });
    this.fallenMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.7, 0.4, 0.15), roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    this.fallenCount = 120;
    this.fallen = new THREE.InstancedMesh(this.fallenGeo, this.fallenMat, this.fallenCount);
    const fm = new THREE.Matrix4(); const fe = new THREE.Euler(); const fq = new THREE.Quaternion(); const fs = new THREE.Vector3();
    const fpos = [];
    for (let i = 0; i < this.fallenCount; i++) {
      const a = rng() * Math.PI * 2;
      const r = 1.8 + rng() * 14;
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      const p = new THREE.Vector3(px, 0.03 + rng() * 0.02, pz);
      fpos.push(p.clone());
      fe.set(-Math.PI / 2 + (rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
      fq.setFromEuler(fe);
      const sc = 0.6 + rng() * 0.9;
      fs.set(sc, sc, sc);
      fm.compose(p, fq, fs);
      this.fallen.setMatrixAt(i, fm);
      // per-leaf color variation
      const col = new THREE.Color().setHSL(0.06 + rng() * 0.07, 0.5 + rng() * 0.3, 0.4 + rng() * 0.2);
      this.fallen.setColorAt(i, col);
    }
    this.fallen.instanceMatrix.needsUpdate = true;
    if (this.fallen.instanceColor) this.fallen.instanceColor.needsUpdate = true;
    this.fallen.receiveShadow = true;
    this.fallen.visible = false;
    this.group.add(this.fallen);
  }

  setSeason(p) {
    const u = this.u;
    u.uGroundGrass.value.copy(p.groundGrass);
    u.uGroundDry.value.copy(p.groundDry);
    u.uGroundMoss.value.copy(p.groundMoss);
    u.uGroundLeafTint.value.copy(p.groundLeafTint);
    u.uGroundSnow.value.copy(p.groundSnow);
    u.uSnowAmount.value = p.snowAmount;
    u.uGravelTint.value.copy(p.gravelTint);
    // fallen leaves visible in autumn (and fewer snow-covered in winter)
    const autumnAmt = p.fallingLeaves;
    this.fallen.visible = p.fallingLeaves > 0.3;
    this.fallenMat.opacity = Math.max(0.15, 1.0 - p.snowAmount * 0.7);
  }
}
