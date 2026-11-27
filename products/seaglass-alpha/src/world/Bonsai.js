import * as THREE from 'three';
import { makeRng } from '../core/noise.js';
import { buildBonsai, buildLeafInstances } from './TreeBuilder.js';
import { createMapleLeafGeometry } from './leaf.js';
import { createBarkMaterial } from './materials/BarkMaterial.js';
import { createLeafMaterial } from './materials/LeafMaterial.js';

// Assembles the bonsai: bark meshes + instanced seasonal leaves + spring blossoms.
export class Bonsai {
  constructor(scene, opts = {}) {
    this.group = new THREE.Group();
    this.group.name = 'bonsai';
    scene.add(this.group);

    const rng = makeRng(opts.seed ?? 1337);
    const built = buildBonsai(rng, opts);

    this.barkMaterial = createBarkMaterial(new THREE.Color(0.5, 0.42, 0.34));
    for (const geo of built.barkGeoms) {
      const mesh = new THREE.Mesh(geo, this.barkMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    // ---- leaves ----
    this.leafGeometry = createMapleLeafGeometry({ lobes: 5, size: 1.0 });
    this.leafMaterial = createLeafMaterial();
    const perAnchor = opts.perAnchor ?? 11;
    const instances = buildLeafInstances(built.leafAnchors, rng, { perAnchor, leafSize: 0.44, spread: 0.34 });
    this.leafCount = instances.length;
    this.leafMesh = new THREE.InstancedMesh(this.leafGeometry, this.leafMaterial, this.leafCount);
    this.leafMesh.castShadow = true;
    this.leafMesh.receiveShadow = true;
    this.leafMesh.frustumCulled = false;

    const m = new THREE.Matrix4();
    const jitters = new Float32Array(this.leafCount);
    const tmpScale = new THREE.Vector3();
    for (let i = 0; i < this.leafCount; i++) {
      const inst = instances[i];
      tmpScale.setScalar(inst.scale);
      m.compose(inst.pos, inst.quat, tmpScale);
      this.leafMesh.setMatrixAt(i, m);
      jitters[i] = inst.jitter;
    }
    this.leafMesh.instanceMatrix.needsUpdate = true;
    this.leafMesh.geometry.setAttribute('aJitter', new THREE.InstancedBufferAttribute(jitters, 1));
    this.group.add(this.leafMesh);

    this.height = built.height;
    this.leafAnchors = built.leafAnchors;
  }

  // apply current season palette
  setSeason(p) {
    const bark = this.barkMaterial.userData.shared;
    bark.uBarkTint.value.copy(p.barkTint);
    bark.uSnowAmount.value = p.snowAmount * 0.55;
    bark.uSnowColor.value.copy(p.snowColor);

    const u = this.leafMaterial.userData.uniforms;
    u.uLeafColor.value.copy(p.leafColor);
    u.uLeafColor2.value.copy(p.leafColor2);
    u.uLeafColor3.value.copy(p.leafColor3);
    u.uLeafShade.value.copy(p.leafShade);
    u.uLeafTip.value.copy(p.leafTip);
    u.uNewLeaf.value.copy(p.newLeafColor);
    u.uLeafTranslucent.value.copy(p.leafTranslucent);
    u.uBareness.value = p.bareness;
    u.uSnowAmount.value = p.snowAmount;
    u.uSnowColor.value.copy(p.snowColor);
  }
}
