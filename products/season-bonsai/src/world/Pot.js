import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.glsl.js';

// Procedural ceramic bonsai pot (lathe profile + glazed PBR + winter snow),
// with a saucer, inner soil and moss. Pure code.
export class Pot {
  constructor(scene, opts = {}) {
    this.group = new THREE.Group();
    this.group.name = 'pot';
    scene.add(this.group);

    this.outerRadius = opts.outerRadius ?? 1.55;
    this.height = opts.height ?? 1.15;
    this.wall = opts.wall ?? 0.12;
    this.innerRadius = this.outerRadius - this.wall;
    this.topY = this.height; // where soil/tree sit

    const R = this.outerRadius;
    const H = this.height;
    const rb = R * 0.78;      // base radius
    const rimW = 0.14;        // rim lip outward
    const wall = this.wall;
    const innerR = this.innerRadius;

    // lathe profile (x = radius, y = height)
    const innerTop = H * 0.84; // soil surface level inside pot
    const profile = [
      new THREE.Vector2(0, H * 0.12),         // bottom center
      new THREE.Vector2(rb * 0.96, H * 0.10),
      new THREE.Vector2(rb, H * 0.16),
      new THREE.Vector2(rb * 1.0, H * 0.30),  // foot flare
      new THREE.Vector2(R * 0.92, H * 0.42),
      new THREE.Vector2(R, H * 0.58),         // belly
      new THREE.Vector2(R * 0.99, H * 0.78),
      new THREE.Vector2(R + rimW * 0.5, H * 0.90), // rim start
      new THREE.Vector2(R + rimW, H * 0.96),       // rim lip outer
      new THREE.Vector2(R + rimW, H * 1.0),        // rim top outer
      new THREE.Vector2(R + rimW * 0.4, H * 1.0),  // rim top inner
      new THREE.Vector2(innerR + wall * 0.3, H * 0.98),
      new THREE.Vector2(innerR, H * 0.93),         // inner wall top
      new THREE.Vector2(innerR, innerTop),         // inner wall
      new THREE.Vector2(innerR * 0.85, innerTop - 0.02), // inner floor slope
      new THREE.Vector2(0, innerTop - 0.06),       // inner floor center
    ];
    this.innerTop = innerTop;

    const potGeo = new THREE.LatheGeometry(profile, 64);
    potGeo.computeVertexNormals();

    const glaze = opts.glaze ?? new THREE.Color(0.62, 0.24, 0.18); // vermilion
    this.glazeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff), roughness: 0.32, metalness: 0.04, envMapIntensity: 0.9,
    });
    const shared = { uGlaze: { value: glaze.clone() }, uSnowAmount: { value: 0 }, uSnowColor: { value: new THREE.Color(0.96, 0.97, 1.0) } };
    this.glazeMat.userData.shared = shared;
    this.glazeMat.onBeforeCompile = (shader) => {
      shader.uniforms.uGlaze = shared.uGlaze;
      shader.uniforms.uSnowAmount = shared.uSnowAmount;
      shader.uniforms.uSnowColor = shared.uSnowColor;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix*vec4(transformed,1.0)).xyz;')
        .replace('#include <normal_vertex>', '#include <normal_vertex>\nvWN = normalize(mat3(modelMatrix)*objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nvarying vec3 vWP;\nvarying vec3 vWN;\nuniform vec3 uGlaze;\nuniform float uSnowAmount;\nuniform vec3 uSnowColor;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 base = uGlaze;
          // glaze mottling + procedural kiln variation
          float mott = fbm(vWP.xz * 3.5 + vWP.y * 2.0, 4);
          float streak = fbm(vec2(vWP.y * 9.0, atan(vWP.z, vWP.x) * 2.0), 3);
          base *= 0.9 + 0.18 * mott;
          base = mix(base, base * 0.78, smoothstep(0.55, 0.95, streak) * 0.4);
          // subtle glaze pooling at base
          base *= 1.0 - 0.12 * smoothstep(0.55, 0.1, vWP.y);
          diffuseColor.rgb = base;
          // winter snow on top rim + upward faces
          float up = clamp(vWN.y, 0.0, 1.0);
          float snow = smoothstep(0.4, 0.9, up) * uSnowAmount;
          snow = max(snow, smoothstep(${(H * 0.9).toFixed(3)}, ${(H * 1.02).toFixed(3)}, vWP.y) * uSnowAmount);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, snow * 0.92);`);
    };

    const pot = new THREE.Mesh(potGeo, this.glazeMat);
    pot.castShadow = true; pot.receiveShadow = true;
    this.group.add(pot);

    // pot sits directly on ground; procedural contact shadow grounds it (no floating disc)

    // ---- soil inside ----
    const soilGeo = new THREE.CircleGeometry(innerR * 0.97, 48);
    soilGeo.rotateX(-Math.PI / 2);
    const soilMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.14, 0.10, 0.075), roughness: 1.0 });
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.y = innerTop + 0.005;
    soil.receiveShadow = true;
    this.group.add(soil);

    // ---- moss on soil ----
    const mossMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.18, 0.32, 0.14), roughness: 1.0 });
    const mossGeo = new THREE.SphereGeometry(0.05, 6, 4);
    const mossCount = 34;
    const moss = new THREE.InstancedMesh(mossGeo, mossMat, mossCount);
    const mat = new THREE.Matrix4();
    const sc = new THREE.Vector3();
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed % 1000) / 1000; };
    for (let i = 0; i < mossCount; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * innerR * 0.92;
      // keep center clear for trunk
      const rr = r < 0.45 ? 0.45 + rnd() * (innerR * 0.92 - 0.45) : r;
      const s = 0.5 + rnd() * 1.4;
      sc.set(s, s * 0.5, s);
      mat.compose(new THREE.Vector3(Math.cos(a) * rr, innerTop + 0.03, Math.sin(a) * rr), new THREE.Quaternion(), sc);
      moss.setMatrixAt(i, mat);
    }
    moss.instanceMatrix.needsUpdate = true;
    moss.receiveShadow = true;
    this.group.add(moss);
    this.mossMat = mossMat;

    this.soilY = innerTop + 0.03;      // surface where tree emerges
    this.treeY = H * 0.24 + 0.05;      // bonsai group y offset... tree roots sit in soil
  }

  setSeason(p) {
    const shared = this.glazeMat.userData.shared;
    shared.uSnowAmount.value = p.potSnow;
    shared.uSnowColor.value.copy(p.snowColor);
    this.mossMat.color.copy(p.groundMoss);
  }
}
