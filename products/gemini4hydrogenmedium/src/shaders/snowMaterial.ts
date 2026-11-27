import * as THREE from 'three';

export interface SnowUniformRef {
  uSnowAmount: { value: number };
}

/**
 * Enhances a MeshStandardMaterial with world-space upward-facing snow accumulation
 * and subtle moss/crevice richness, updated via a shared uSnowAmount uniform.
 */
export function applySeasonalSnowShader(
  material: THREE.MeshStandardMaterial,
  snowUniform: SnowUniformRef,
  options: { snowSlopeThreshold?: number; maxSnowCover?: number } = {}
): THREE.MeshStandardMaterial {
  const threshold = options.snowSlopeThreshold ?? 0.42;
  const maxCover = options.maxSnowCover ?? 0.92;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnowAmount = snowUniform.uSnowAmount;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vSnowWorldNormal;
         varying vec3 vSnowWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vSnowWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
         vSnowWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uSnowAmount;
         varying vec3 vSnowWorldNormal;
         varying vec3 vSnowWorldPos;

         float snowHash(vec2 p) {
           return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float upDot = clamp(dot(normalize(vSnowWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
         float microNoise = snowHash(floor(vSnowWorldPos.xz * 80.0)) * 0.08;
         float snowMask = smoothstep(${threshold.toFixed(2)}, ${(threshold + 0.34).toFixed(2)}, upDot + uSnowAmount * 0.26 + microNoise - 0.14);
         snowMask *= clamp(uSnowAmount * 1.1, 0.0, 1.0) * ${maxCover.toFixed(2)};
         vec3 snowAlbedo = vec3(0.76, 0.82, 0.89);
         diffuseColor.rgb = mix(diffuseColor.rgb, snowAlbedo, snowMask);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float snowRoughMask = smoothstep(${threshold.toFixed(2)}, ${(threshold + 0.32).toFixed(2)}, clamp(dot(normalize(vSnowWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0) + uSnowAmount * 0.28 - 0.14) * clamp(uSnowAmount * 1.15, 0.0, 1.0);
         roughnessFactor = mix(roughnessFactor, 0.78, snowRoughMask * 0.8);`
      );
  };

  material.customProgramCacheKey = () => `seasonal-snow-${threshold}-${maxCover}`;
  return material;
}
