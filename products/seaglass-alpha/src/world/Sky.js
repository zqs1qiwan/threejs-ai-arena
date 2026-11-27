import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.glsl.js';

// Procedural sky dome: gradient + sun/moon + stars + clouds + horizon haze.
// No textures, no HDRI. Linear output (tonemapping handled in post).
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // push to far plane
}
`;

const SKY_FRAG = /* glsl */ `
${NOISE_GLSL}
varying vec3 vDir;
uniform vec3 uSkyTop; uniform vec3 uSkyMid; uniform vec3 uSkyHorizon; uniform vec3 uSkyGround;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunIntensity;
uniform vec3 uMoonDir; uniform vec3 uMoonColor;
uniform float uStars; uniform float uCloudCover; uniform float uTime;
uniform vec3 uFogColor;

void main(){
  vec3 dir = normalize(vDir);
  float h = dir.y;

  // ---- base gradient ----
  vec3 col;
  if (h >= 0.0) {
    col = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.35, h));
    col = mix(col, uSkyTop, smoothstep(0.25, 0.9, h));
  } else {
    col = mix(uSkyHorizon, uSkyGround, smoothstep(0.0, -0.35, h));
  }


  // horizon haze
  float haze = smoothstep(0.12, -0.02, h);
  col = mix(col, uFogColor, haze * 0.3);

  
  // ---- sun ----
  vec3 sd = normalize(uSunDir);
  float sunDot = max(dot(dir, sd), 0.0);
  float sunDisk = smoothstep(0.9985, 0.9993, sunDot);
  float sunGlow = pow(sunDot, 24.0) * 0.5 + pow(sunDot, 4.0) * 0.10;
  float halo = pow(sunDot, 2.0) * 0.14;
  col += uSunColor * (sunDisk * 6.0 * uSunIntensity * 0.5 + sunGlow + halo) * smoothstep(-0.05, 0.05, sd.y);
  col += uSunColor * pow(max(sunDot,0.0), 1.5) * 0.05 * smoothstep(-0.05, 0.2, h);

  // ---- moon ----
  vec3 md = normalize(uMoonDir);
  float moonDot = max(dot(dir, md), 0.0);
  float moonDisk = smoothstep(0.9990, 0.9996, moonDot);
  float moonGlow = pow(moonDot, 16.0) * 0.25;
  float nightAmt = smoothstep(0.05, -0.1, sd.y);
  col += uMoonColor * (moonDisk * 1.4 + moonGlow) * nightAmt;
  col += uMoonColor * pow(moonDot, 3.0) * 0.08 * nightAmt;

  // ---- stars ----
  if (uStars > 0.001 && h > 0.02) {
    vec2 sph = vec2(atan(dir.z, dir.x), asin(clamp(dir.y,-1.0,1.0)));
    vec2 cell = floor(sph * 240.0);
    float star = hash12(cell);
    float bright = smoothstep(0.997, 1.0, star);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + star * 100.0);
    vec2 f = fract(sph * 240.0) - 0.5;
    float d = length(f);
    float pt = smoothstep(0.18, 0.0, d);
    float sMask = smoothstep(0.05, 0.4, h);
    col += vec3(bright * pt * tw) * uStars * sMask * (0.7 + 0.3 * hash12(cell + 3.7));
    float band = smoothstep(0.25, 0.0, abs(dir.y - 0.25 - 0.1*sin(sph.x)));
    col += vec3(0.5,0.55,0.7) * fbm(sph * 3.0 + 10.0, 3) * band * uStars * 0.04;
  }

  // ---- clouds ----
  if (h > -0.02) {
    vec2 cuv = dir.xz / max(h + 0.15, 0.06);
    vec2 drift = vec2(uTime * 0.004, uTime * 0.0015);
    float cl = fbm(cuv * 0.55 + drift, 5);
    float cl2 = fbm(cuv * 1.4 + drift * 1.7 + 4.0, 4);
    float cover = cl * 0.7 + cl2 * 0.3;
    float cloudMask = smoothstep(1.0 - uCloudCover - 0.25, 1.05 - uCloudCover, cover);
    cloudMask *= smoothstep(-0.02, 0.12, h);
    vec3 cloudCol = mix(vec3(0.5,0.52,0.58), vec3(0.95,0.94,0.92), smoothstep(0.4,0.85,cl));
    cloudCol *= 0.85 + 0.3 * uSunIntensity * 0.4;
    cloudCol += uSunColor * pow(sunDot, 2.0) * 0.25;
    cloudCol = mix(cloudCol * 0.35, cloudCol, smoothstep(-0.1, 0.1, sd.y));
    col = mix(col, cloudCol, cloudMask * 0.85);
  }

  // gentle saturation boost for rich sky under tonemap
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 1.3);
  col *= 0.9;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(400, 32, 16);
    const u = {
      uSkyTop: { value: new THREE.Color(0.32, 0.54, 0.86) },
      uSkyMid: { value: new THREE.Color(0.52, 0.70, 0.88) },
      uSkyHorizon: { value: new THREE.Color(0.86, 0.82, 0.76) },
      uSkyGround: { value: new THREE.Color(0.5, 0.55, 0.5) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.5) },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
      uSunIntensity: { value: 1.2 },
      uMoonDir: { value: new THREE.Vector3(-0.4, 0.5, -0.5) },
      uMoonColor: { value: new THREE.Color(0.9, 0.92, 1.0) },
      uStars: { value: 0 },
      uCloudCover: { value: 0.3 },
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0.8, 0.85, 0.85) },
    };
    this.uniforms = u;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: u,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  setSeason(p, sunDir, moonDir) {
    const u = this.uniforms;
    u.uSkyTop.value.copy(p.skyTop);
    u.uSkyMid.value.copy(p.skyMid);
    u.uSkyHorizon.value.copy(p.skyHorizon);
    u.uSkyGround.value.copy(p.skyGround);
    u.uSunColor.value.copy(p.sunColor);
    u.uSunIntensity.value = Math.min(2, p.sunIntensity * 0.55);
    u.uSunDir.value.copy(sunDir);
    u.uMoonColor.value.copy(p.moonColor);
    u.uMoonDir.value.copy(moonDir);
    u.uStars.value = p.stars;
    u.uCloudCover.value = p.cloudCover;
    u.uFogColor.value.copy(p.fogColor);
  }

  update(dt) { this.uniforms.uTime.value += dt; this.mesh.rotation.y += dt * 0.002; }
}
