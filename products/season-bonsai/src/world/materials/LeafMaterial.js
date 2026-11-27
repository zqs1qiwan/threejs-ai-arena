import * as THREE from 'three';
import { NOISE_GLSL } from '../../shaders/noise.glsl.js';
import { Wind } from '../wind.js';

// Seasonal foliage PBR material for instanced palmate leaves.
// Procedural veins, edge shading, translucency, wind sway, winter shrink/snow.
export function createLeafMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),
    roughness: 0.6,
    metalness: 0.0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.7,
    sheen: 0.7,                       // soft foliage sheen
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0.85, 0.92, 0.78),
    clearcoat: 0.18,                  // waxy leaf edge
    clearcoatRoughness: 0.5,
    ior: 1.4,
  });
  material.defines = { USE_UV: '' };

  const u = {
    uLeafColor: { value: new THREE.Color(0.42, 0.62, 0.24) },
    uLeafColor2: { value: new THREE.Color(0.55, 0.72, 0.30) },
    uLeafColor3: { value: new THREE.Color(0.62, 0.55, 0.22) },
    uLeafShade: { value: new THREE.Color(0.22, 0.36, 0.14) },
    uLeafTip: { value: new THREE.Color(0.72, 0.78, 0.45) },
    uNewLeaf: { value: new THREE.Color(0.66, 0.45, 0.42) },
    uLeafTranslucent: { value: new THREE.Color(0.75, 0.85, 0.45) },
    uBareness: { value: 0 },
    uSnowAmount: { value: 0 },
    uSnowColor: { value: new THREE.Color(0.96, 0.97, 1.0) },
    uWindTime: Wind.uniforms.uWindTime,
    uWindStrength: Wind.uniforms.uWindStrength,
    uWindDir: Wind.uniforms.uWindDir,
  };
  material.userData.uniforms = u;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aJitter;
        varying float vJit;
        varying vec3 vWorldNormalL;
        uniform float uWindTime;
        uniform float uWindStrength;
        uniform vec2 uWindDir;
        uniform float uBareness;`)
      .replace('#include <project_vertex>', `
        // ---- custom instanced leaf vertex ----
        vJit = aJitter;

        // winter bareness: shrink a deterministic subset of leaves away
        float hide = step(1.0 - uBareness, fract(aJitter * 7.13 + 0.5));
        float shrink = 1.0 - uBareness * hide;
        vec3 localPos = transformed * shrink;

        #ifdef USE_INSTANCING
          vec3 instPos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 instPos = vec3(0.0);
        #endif

        float phase = instPos.x * 1.7 + instPos.z * 1.3 + instPos.y * 0.9 + aJitter * 6.28;
        float sway = sin(uWindTime * 2.1 + phase) * 0.6 + sin(uWindTime * 3.7 + phase * 1.4) * 0.3;
        float flutter = sin(uWindTime * 6.0 + phase * 2.0) * 0.12;
        float wamt = uWindStrength;

        vec4 mvPosition = vec4(localPos, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        vec3 windPush = vec3(uWindDir.x, 0.0, uWindDir.y) * sway * wamt * 0.10
                      + vec3(flutter * wamt * 0.05, abs(sway) * wamt * 0.02, 0.0);
        mvPosition.xyz += windPush;
        gl_Position = projectionMatrix * mvPosition;
        // world normal (approx, handles instancing)
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWorldNormalL = normalize(mat3(modelMatrix) * wn);
        // ---- end custom ----`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        ${NOISE_GLSL}
        varying float vJit;
        varying vec3 vWorldNormalL;
        uniform vec3 uLeafColor;
        uniform vec3 uLeafColor2;
        uniform vec3 uLeafColor3;
        uniform vec3 uLeafShade;
        uniform vec3 uLeafTip;
        uniform vec3 uNewLeaf;
        uniform vec3 uLeafTranslucent;
        uniform float uSnowAmount;
        uniform vec3 uSnowColor;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 uv = vUv;
          float jit = vJit;
          vec3 base = mix(uLeafColor, uLeafColor2, jit);
          base = mix(base, uLeafColor3, smoothstep(0.82, 1.0, jit) * 0.6);
          base = mix(base, uNewLeaf, smoothstep(0.9, 1.0, fract(jit * 3.1)) * 0.5);
          base = mix(base, uLeafTip, smoothstep(0.7, 1.0, uv.y) * 0.35);
          base = mix(uLeafShade, base, smoothstep(0.0, 0.25, uv.y) * 0.5 + 0.5);
          float midrib = smoothstep(0.025, 0.0, abs(uv.x - 0.5));
          float lateral = 0.5 + 0.5 * sin((uv.y * 14.0) + (uv.x - 0.5) * 6.0);
          float secondary = smoothstep(0.92, 1.0, lateral) * smoothstep(0.1, 0.9, uv.y);
          float vein = clamp(midrib * 0.8 + secondary * 0.45, 0.0, 1.0);
          base = mix(base, uLeafShade * 0.8, vein * 0.22);
          base *= 0.92 + 0.16 * jit;
          float edge = smoothstep(0.5, 0.0, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
          base *= 1.0 - 0.10 * edge;
          diffuseColor.rgb *= base;
          float snowMask = clamp(vWorldNormalL.y * 0.5 + 0.5, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, uSnowAmount * snowMask * 0.85);
        }`)
      // per-leaf roughness variation for material richness
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float midribR = smoothstep(0.025, 0.0, abs(vUv.x - 0.5));
        roughnessFactor = clamp(roughnessFactor * (0.78 + 0.45 * vJit) * (1.0 - 0.25 * midribR), 0.25, 1.0);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 V = normalize(vViewPosition);
          float facing = abs(dot(normalize(normal), V));
          float trans = pow(1.0 - facing, 2.0);
          totalEmissiveRadiance += diffuseColor.rgb * uLeafTranslucent * trans * 0.30;
          // subtle self-illumination so inner canopy isn't pure black
          totalEmissiveRadiance += diffuseColor.rgb * 0.10;
        }`);
  };

  return material;
}
