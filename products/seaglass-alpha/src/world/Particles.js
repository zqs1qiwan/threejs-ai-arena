import * as THREE from 'three';
import { makeRng } from '../core/noise.js';
import { Wind } from './wind.js';

// ---------------------------------------------------------------------------
// Procedural particle systems (no textures):
//  - FallingParticles: petals / leaves / snow (instanced quads, GPU animated)
//  - Fireflies: additive glowing points with wandering motion
//  - DustMotes: slow drifting additive motes
// ---------------------------------------------------------------------------

const FALLING_VERT = /* glsl */ `
attribute float aSeed;
attribute vec3 aTint;
uniform float uTime;
uniform vec2 uWind;
uniform float uWindStrength;
uniform float uFallSpeed;
uniform float uBoxSize;
uniform float uBoxTop;
uniform float uSway;
uniform float uSizeMin;
uniform float uSizeMax;
uniform float uTumble;
uniform float uCenterClear;
varying float vSeed;
varying vec3 vTint;
varying vec2 vUv;

vec3 rotX(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }
vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
vec3 rotZ(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z); }

void main(){
  vSeed = aSeed; vTint = aTint; vUv = uv;
  float seed = aSeed;
  float t = uTime + seed * 137.0;
  float h = uBoxSize;
  // fall cycle with wrap
  float fall = mod(t * uFallSpeed + seed * h, h);
  vec3 base = position; // instance base position via modelMatrix (we bake instance pos into geometry? no)
  // we use instanceMatrix for base placement; read translation
  vec3 instPos;
  #ifdef USE_INSTANCING
    instPos = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
  #else
    instPos = vec3(0.0);
  #endif
  vec3 center = instPos;
  center.y = uBoxTop - fall;
  // horizontal sway + wind drift
  center.x += sin(t * 0.9 + seed * 10.0) * uSway + uWind.x * uWindStrength * fall * 0.06;
  center.z += cos(t * 0.7 + seed * 8.0) * uSway + uWind.y * uWindStrength * fall * 0.06;
  // wrap horizontally
  center.x = mod(center.x + h*0.5, h) - h*0.5;
  center.z = mod(center.z + h*0.5, h) - h*0.5;
  // keep a clear bubble around the bonsai/pot center
  float r = length(center.xz);
  if (r < uCenterClear) {
    vec2 dir = r > 0.0001 ? center.xz / r : vec2(1.0, 0.0);
    float push = uCenterClear + (uCenterClear - r);
    center.x = dir.x * push; center.z = dir.y * push;
  }

  // local vertex (quad), size variation
  float size = mix(uSizeMin, uSizeMax, fract(seed * 3.3));
  // hide particles at/under ground level
  size *= smoothstep(0.0, 0.35, center.y);
  vec3 local = position * size;
  // tumble rotation
  float rx = t * uTumble + seed * 6.0;
  float ry = t * uTumble * 0.7 + seed * 4.0;
  float rz = sin(t * 0.8 + seed) * 0.6;
  local = rotZ(rotY(rotX(local, rx), ry), rz);

  vec3 worldPos = center + local;
  vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FALLING_FRAG = /* glsl */ `
varying float vSeed;
varying vec3 vTint;
varying vec2 vUv;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uOpacity;
void main(){
  vec3 col = mix(uColor, uColor2, fract(vSeed * 5.1));
  col *= vTint;
  // soft edge
  float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  gl_FragColor = vec4(col, uOpacity * (0.85 + 0.15 * edge));
  
}
`;

export class FallingParticles {
  constructor(scene, opts = {}) {
    this.count = opts.count ?? 600;
    const rng = makeRng(opts.seed ?? 99);
    const box = opts.boxSize ?? 16;
    this.box = box;

    // shape geometry (petal / leaf / snow), placed at base + animated in shader
    const quad = opts.geometry || new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.attributes.position = quad.attributes.position;
    this.geometry.attributes.uv = quad.attributes.uv;
    this.geometry.attributes.normal = quad.attributes.normal;

    const seeds = new Float32Array(this.count);
    const tints = new Float32Array(this.count * 3);
    const mat = new THREE.Matrix4();
    // use InstancedMesh-style: create instanced attributes manually + a plain mesh w/ instanceMatrix
    // simpler: build InstancedMesh and reuse its instanceMatrix; but we need custom geometry...
    // We'll create InstancedMesh with quad + attach attributes.
    const mesh = new THREE.InstancedMesh(quad, null, this.count);
    for (let i = 0; i < this.count; i++) {
      const x = (rng() - 0.5) * box;
      const y = rng() * 4;
      const z = (rng() - 0.5) * box;
      mat.makeTranslation(x, y, z);
      mesh.setMatrixAt(i, mat);
      seeds[i] = rng();
      tints[i * 3] = 0.85 + rng() * 0.3;
      tints[i * 3 + 1] = 0.85 + rng() * 0.3;
      tints[i * 3 + 2] = 0.85 + rng() * 0.3;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;

    this.u = {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(0.8, 0.6) },
      uWindStrength: Wind.uniforms.uWindStrength,
      uFallSpeed: { value: opts.fallSpeed ?? 0.6 },
      uBoxSize: { value: box },
      uBoxTop: { value: opts.boxTop ?? 6 },
      uSway: { value: opts.sway ?? 0.4 },
      uSizeMin: { value: opts.sizeMin ?? 0.12 },
      uSizeMax: { value: opts.sizeMax ?? 0.24 },
      uTumble: { value: opts.tumble ?? 1.2 },
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
      uColor2: { value: new THREE.Color(opts.color2 ?? 0xffffff) },
      uOpacity: { value: opts.opacity ?? 0.95 },
      uCenterClear: { value: opts.centerClear ?? 1.5 },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: FALLING_VERT, fragmentShader: FALLING_FRAG, uniforms: this.u,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    mesh.material = this.material;
    mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    mesh.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
    this.mesh = mesh;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update(dt) { this.u.uTime.value += dt; this.u.uWind.value.copy(Wind.direction); }
  setVisible(v) { this.mesh.visible = v; }
  setColor(a, b) { this.u.uColor.value.copy(a); if (b) this.u.uColor2.value.copy(b); }
  setOpacity(o) { this.u.uOpacity.value = o; }
  setCountFraction(f) { this.mesh.count = Math.floor(this.count * Math.max(0, Math.min(1, f))); }
}

// ---- fireflies ----
const FIREFLY_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vSeed;
void main(){
  vSeed = aSeed;
  float t = uTime + aSeed * 50.0;
  vec3 p = position;
  p.x += sin(t * 0.6 + aSeed * 10.0) * 0.6 + sin(t * 1.3) * 0.2;
  p.y += sin(t * 0.8 + aSeed * 7.0) * 0.4 + 0.3;
  p.z += cos(t * 0.5 + aSeed * 8.0) * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float pulse = 0.5 + 0.5 * sin(t * 2.0 + aSeed * 20.0);
  gl_PointSize = (3.0 + 4.0 * pulse);
}
`;
const FIREFLY_FRAG = /* glsl */ `
varying float vSeed;
uniform float uOpacity;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  vec3 col = mix(vec3(0.8, 1.0, 0.5), vec3(1.0, 0.95, 0.6), fract(vSeed));
  gl_FragColor = vec4(col, a * uOpacity);
}
`;

export class Fireflies {
  constructor(scene, count = 120, box = 8) {
    const rng = makeRng(4242);
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * box;
      pos[i * 3 + 1] = 0.4 + rng() * 2.5;
      pos[i * 3 + 2] = (rng() - 0.5) * box;
      seeds[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.u = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    this.material = new THREE.ShaderMaterial({
      vertexShader: FIREFLY_VERT, fragmentShader: FIREFLY_FRAG, uniforms: this.u,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Points(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    scene.add(this.mesh);
  }
  update(dt) { this.u.uTime.value += dt; }
  setOpacity(o) { this.u.uOpacity.value = o; this.mesh.visible = o > 0.01; }
}
