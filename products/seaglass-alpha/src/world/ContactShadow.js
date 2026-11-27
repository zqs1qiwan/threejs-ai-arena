import * as THREE from 'three';

// Procedural soft contact shadow (radial gradient, no texture).
// A dark disc blended on the ground to ground objects. Pure code.
export function addContactShadow(scene, { radius = 2.2, opacity = 0.38, x = 0, z = 0, y = 0.02, color = 0x000000, stretch = 1.0 } = {}) {
  const geo = new THREE.PlaneGeometry(radius * 2 * stretch, radius * 2, 1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main(){
        vec2 c = (vUv - 0.5) * 2.0;
        float d = length(c);
        // soft radial falloff, slightly noisy edge
        float a = smoothstep(1.0, 0.15, d);
        a *= smoothstep(1.1, 0.9, d);
        a *= a; // extra soft falloff
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.renderOrder = 2;
  scene.add(mesh);
  return mesh;
}
