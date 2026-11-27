import * as THREE from 'three';

// Procedural palmate (Japanese-maple style) leaf geometry. No textures.
// Silhouette generated as r(theta) polygon; UVs normalized to bounds.

export function createMapleLeafGeometry({ lobes = 5, size = 1.0 } = {}) {
  const N = 160;
  const pts = [];
  // palmate radial profile: deep sinuses between lobes
  // angle 0 at top (+Y); base at bottom.
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    // rotate so a lobe points up
    const lobed = Math.pow(Math.abs(Math.cos((lobes / 2) * a + Math.PI / 2)), 0.45);
    // reduce lobing near base
    const baseFade = 0.55 + 0.45 * Math.sin(Math.min(Math.PI, a) * 0.5 + 0.0);
    let r = 0.34 + 0.66 * lobed;
    // central lobe slightly longer
    const central = Math.pow(Math.abs(Math.cos(a + Math.PI / 2)), 8.0);
    r += 0.12 * central;
    r *= baseFade;
    const px = Math.sin(a) * r * 0.5 * size;
    const py = Math.cos(a) * r * 0.5 * size;
    pts.push(new THREE.Vector2(px, py));
  }
  // shift down so stem base sits near origin
  for (const p of pts) p.y += 0.18 * size;

  const shape = new THREE.Shape(pts);
  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const w = (bb.max.x - bb.min.x) || 1;
  const h = (bb.max.y - bb.min.y) || 1;
  // recompute UVs normalized 0..1 across leaf bounds
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / w;
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

// Sakura blossom petal: rounded body + notched tip silhouette, slight cup. No texture.
export function createPetalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.5, -0.45, 0.55, 0.15, 0.28, 0.45);
  s.lineTo(0.10, 0.34);        // notch edge
  s.lineTo(0.0, 0.40);         // central tip notch
  s.lineTo(-0.10, 0.34);
  s.lineTo(-0.28, 0.45);
  s.bezierCurveTo(-0.55, 0.15, -0.5, -0.45, 0, -0.5);
  const geo = new THREE.ShapeGeometry(s, 16);
  // cup the petal
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, 0.10 * (x * x) + 0.04 * Math.max(0, y));
  }
  geo.computeBoundingBox();
  // normalized UVs
  const bb = geo.boundingBox; const w = (bb.max.x - bb.min.x) || 1; const h = (bb.max.y - bb.min.y) || 1;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) - bb.min.x) / w; uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / h; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}
