import * as THREE from 'three';
import { NOISE_GLSL } from '../../shaders/noise.glsl.js';

// Procedural bark PBR material. No textures. Adds ridges, grain, micro-normals
// and winter snow accumulation on upward-facing surfaces.
export function createBarkMaterial(tint = new THREE.Color(0.5, 0.42, 0.34)) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xffffff),
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.6,
  });

  const shared = {
    uBarkTint: { value: tint.clone() },
    uSnowAmount: { value: 0 },
    uSnowColor: { value: new THREE.Color(0.96, 0.97, 1.0) },
  };
  material.userData.shared = shared;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBarkTint = shared.uBarkTint;
    shader.uniforms.uSnowAmount = shared.uSnowAmount;
    shader.uniforms.uSnowColor = shared.uSnowColor;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
      .replace('#include <normal_vertex>', `#include <normal_vertex>
        vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;\nuniform vec3 uBarkTint;\nuniform float uSnowAmount;\nuniform vec3 uSnowColor;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 wp = vWorldPos;
          vec3 base = diffuseColor.rgb * uBarkTint * 1.6;
          // large vertical striations + fine grain
          float stri = ridged(vec2(wp.y * 5.5 + wp.x * 1.3 + wp.z * 1.1, (wp.x + wp.z) * 2.2), 4);
          float grain = fbm(wp * 7.0, 5);
          float plates = worley((wp.xz + wp.y * 0.4) * 3.0 + wp.y * 1.5);
          float k = clamp(stri * 0.55 + grain * 0.45 + plates * 0.25, 0.0, 1.0);
          vec3 dark = base * 0.52;
          vec3 light = base * 1.18;
          diffuseColor.rgb = mix(dark, light, k);
          // occasional dark knots
          float knot = smoothstep(0.78, 0.95, fbm(wp * 2.3 + 11.0, 3));
          diffuseColor.rgb = mix(diffuseColor.rgb, base * 0.35, knot * 0.6);
          // winter snow on upward faces + ledges
          float up = clamp(vWorldNormal.y * 0.5 + 0.5, 0.0, 1.0);
          float snowMask = smoothstep(0.55, 0.95, up) * uSnowAmount;
          snowMask *= 0.6 + 0.4 * grain;
          diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, snowMask);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // micro bump from bark noise
          vec3 wp = vWorldPos;
          float e = 0.02;
          float h0 = fbm(wp * 7.0, 4);
          float hx = fbm((wp + vec3(e,0.0,0.0)) * 7.0, 4);
          float hz = fbm((wp + vec3(0.0,0.0,e)) * 7.0, 4);
          vec3 bump = vec3((h0 - hx), 0.0, (h0 - hz)) * 1.4;
          normal = normalize(normal + bump);
        }`);
  };

  return material;
}
