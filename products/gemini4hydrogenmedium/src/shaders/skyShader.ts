import * as THREE from 'three';

export interface SkyDome {
  mesh: THREE.Mesh;
  uniforms: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uTime: { value: number };
    uNightFactor: { value: number };
  };
}

export function createSkyDome(): SkyDome {
  const uniforms = {
    uTopColor: { value: new THREE.Color('#5a80a8') },
    uHorizonColor: { value: new THREE.Color('#f0d8dc') },
    uSunDir: { value: new THREE.Vector3(0.55, 0.42, -0.72).normalize() },
    uSunColor: { value: new THREE.Color('#fff1dc') },
    uTime: { value: 0 },
    uNightFactor: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uTime;
      uniform float uNightFactor;
      varying vec3 vWorldDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        float horizonBlend = pow(1.0 - clamp(abs(dir.y), 0.0, 1.0), 2.4);

        vec3 col = mix(uTopColor, uHorizonColor, horizonBlend);
        if (dir.y < 0.0) {
          col = mix(uHorizonColor, uTopColor * 0.35, clamp(-dir.y * 2.5, 0.0, 1.0));
        }

        // Soft atmospheric sun/moon glow
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float sunHalo = pow(sunDot, 10.0) * 0.35 + pow(sunDot, 120.0) * 0.7;
        col += uSunColor * sunHalo * (1.0 - uNightFactor * 0.55);

        // Subtle drifting mist wisps above horizon
        if (dir.y > 0.01) {
          vec2 uv = dir.xz / (dir.y + 0.25) * 1.4 + vec2(uTime * 0.012, uTime * 0.004);
          float cloud = noise(uv * 2.2) * 0.6 + noise(uv * 5.0) * 0.4;
          float cloudMask = smoothstep(0.52, 0.82, cloud) * smoothstep(0.02, 0.35, dir.y) * (1.0 - smoothstep(0.45, 0.9, dir.y));
          col = mix(col, mix(uHorizonColor, vec3(1.0), 0.35), cloudMask * 0.28 * (1.0 - uNightFactor * 0.6));
        }

        // Subtle stars in night mode
        if (uNightFactor > 0.05 && dir.y > 0.08) {
          vec2 starUv = floor(dir.xz / (dir.y + 0.35) * 90.0);
          float s = hash(starUv);
          if (s > 0.992) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.5 + s * 60.0);
            col += vec3(0.85, 0.92, 1.0) * twinkle * uNightFactor * smoothstep(0.08, 0.35, dir.y);
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(65, 48, 32), mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
