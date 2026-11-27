import * as THREE from 'three';

export interface WaterUniforms {
  [uniform: string]: THREE.IUniform;
  uTime: { value: number };
  uIceFactor: { value: number };
  uShallowColor: { value: THREE.Color };
  uDeepColor: { value: THREE.Color };
  uSkyColor: { value: THREE.Color };
  uSunDir: { value: THREE.Vector3 };
  uRippleOrigin: { value: THREE.Vector2 };
  uRippleTime: { value: number };
}

export function createPondWaterMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: WaterUniforms;
} {
  const uniforms: WaterUniforms = {
    uTime: { value: 0 },
    uIceFactor: { value: 0 },
    uShallowColor: { value: new THREE.Color('#2d6b68') },
    uDeepColor: { value: new THREE.Color('#0c2229') },
    uSkyColor: { value: new THREE.Color('#d8e6ef') },
    uSunDir: { value: new THREE.Vector3(0.55, 0.55, -0.6).normalize() },
    uRippleOrigin: { value: new THREE.Vector2(0, 0) },
    uRippleTime: { value: -10.0 },
  };

  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uIceFactor;
      uniform vec2 uRippleOrigin;
      uniform float uRippleTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWave;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float liquid = 1.0 - smoothstep(0.2, 0.85, uIceFactor);
        float w1 = sin(pos.x * 16.0 + uTime * 2.1) * cos(pos.z * 14.0 - uTime * 1.7) * 0.004;
        float w2 = sin((pos.x + pos.z) * 24.0 - uTime * 2.9) * 0.0025;

        // Interactive click ripple
        float age = uTime - uRippleTime;
        float dist = length(pos.xz - uRippleOrigin);
        float clickWave = 0.0;
        if (age > 0.0 && age < 3.5) {
          float ring = sin(dist * 34.0 - age * 14.0);
          float env = exp(-dist * 3.8) * exp(-age * 1.4);
          clickWave = ring * env * 0.012;
        }

        float totalWave = (w1 + w2 + clickWave) * liquid;
        pos.y += totalWave;
        vWave = totalWave;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIceFactor;
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uSkyColor;
      uniform vec3 uSunDir;
      uniform vec2 uRippleOrigin;
      uniform float uRippleTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWave;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float liquid = 1.0 - smoothstep(0.25, 0.85, uIceFactor);

        // Procedural ripple normal perturbation
        float nx = sin(vWorldPos.x * 24.0 + uTime * 2.4) * 0.06 + cos(vWorldPos.z * 32.0 - uTime * 1.9) * 0.04;
        float nz = cos(vWorldPos.z * 26.0 + uTime * 2.0) * 0.06 + sin(vWorldPos.x * 30.0 + uTime * 2.3) * 0.04;

        // Interactive ripple normal
        float age = uTime - uRippleTime;
        vec2 rDiff = vWorldPos.xz - uRippleOrigin;
        float rDist = length(rDiff);
        if (age > 0.0 && age < 3.5 && rDist > 0.001) {
          float ringSlope = cos(rDist * 34.0 - age * 14.0) * exp(-rDist * 3.8) * exp(-age * 1.4) * 0.28;
          vec2 dir = rDiff / rDist;
          nx += dir.x * ringSlope;
          nz += dir.y * ringSlope;
        }

        // Ice frost crystal normal
        float frostNoise = noise(vWorldPos.xz * 26.0) * 0.65 + noise(vWorldPos.xz * 64.0) * 0.35;
        vec3 normal = normalize(vec3(nx * liquid + (frostNoise - 0.5) * 0.14 * uIceFactor, 1.0, nz * liquid));

        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.6);
        float centerDist = length(vUv - 0.5) * 2.0;
        vec3 waterCol = mix(uDeepColor, uShallowColor, clamp(centerDist * 0.85, 0.0, 1.0));

        // Ice tint
        vec3 iceCol = mix(vec3(0.76, 0.88, 0.96), vec3(0.92, 0.96, 1.0), frostNoise);
        vec3 baseCol = mix(waterCol, iceCol, uIceFactor * 0.85);

        // Specular highlight
        vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
        float specPower = mix(90.0, 28.0, uIceFactor);
        float spec = pow(max(dot(normal, halfVec), 0.0), specPower) * mix(0.9, 0.45, uIceFactor);

        vec3 finalCol = mix(baseCol, uSkyColor, clamp(fresnel * 0.72 + 0.08, 0.0, 0.85));
        finalCol += vec3(1.0, 0.97, 0.92) * spec;

        float alpha = mix(0.84, 0.95, uIceFactor);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
  });

  return { material, uniforms };
}
