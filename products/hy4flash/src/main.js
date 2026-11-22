import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import {
  skyVert, skyFrag, envVert, envFrag, sandInject, waterVert, waterFrag,
  particleVert, particleFrag, gradeShader,
} from './shaders.js';

// ---------------------------------------------------------------- utilities
const C = (h) => new THREE.Color(h);
const clamp = (v, a, b) => Math.min(b, Math.max(a, b));
const mod1 = (v) => ((v % 1) + 1) % 1;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry32(20261121);
const rr = (a, b) => a + R() * (b - a);
const pick = (a) => a[Math.floor(R() * a.length)];

const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 760;
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- procedural textures
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d', { willReadFrequently: true }), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}
function makeLeafTex(style) {
  const W = 512, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const gx = W*0.5, gy = H*0.56;      // leaf centre
  const R0 = H*0.42;                  // lobe radius: fills most of the square canvas

  // Complete palmate maple: 5 lobes around a full circle, each a sharp point
  // with a deep rounded valley between, plus a short stem below.
  const path = new Path2D();
  const N = 5, step = (Math.PI*2)/N;
  const rot = -Math.PI/2 + (style-1)*0.12; // top lobe points up; slight per-style rotation
  const pt = (a,r)=>[gx+Math.cos(a)*r, gy+Math.sin(a)*r];
  for (let k = 0; k <= N; k++) {
    const a = rot + k*step;
    // valley between lobes (rounded, at ~0.52R)
    const va = a - step*0.5;
    const v = pt(va, R0*0.52);
    if (k===0) path.moveTo(v[0],v[1]); else path.lineTo(v[0],v[1]);
    // tip of this lobe
    const tipR = R0*(0.92 + 0.08*Math.sin(k*2.3+style*1.7));
    // approach and leave the tip with slight serration
    for (let s = 0; s <= 8; s++) {
      const f = s/8;
      const ang = va + step*0.5*f;
      const prof = Math.pow(Math.sin(Math.PI*f), 0.55);
      const r = R0*0.52 + (tipR-R0*0.52)*prof;
      const serr = 1 + 0.05*Math.sin(f*Math.PI*7+style)*prof;
      const p = pt(ang, r*serr);
      path.lineTo(p[0],p[1]);
    }
  }
  path.closePath();
  ctx.save(); ctx.clip(path);
  const g = ctx.createRadialGradient(gx,gy,R0*0.1,gx,gy,R0);
  g.addColorStop(0,'#f0f8e6'); g.addColorStop(.6,'#d4e8c0'); g.addColorStop(1,'#a4c48e');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // fine mottling
  for (let i=0;i<2200;i++){
    ctx.fillStyle=Math.random()>.5?`rgba(255,255,235,${rand(.02,.08)})`:`rgba(70,105,55,${rand(.02,.08)})`;
    ctx.beginPath();ctx.arc(Math.random()*W,Math.random()*H,rand(1,6),0,6.283);ctx.fill();
  }
  // veins radiating from centre to each lobe tip
  ctx.lineCap='round';
  for (let k=0;k<N;k++){
    const a=rot+k*step;
    const tipR=R0*(0.92+0.08*Math.sin(k*2.3+style*1.7));
    const ex=gx+Math.cos(a)*tipR, ey=gy+Math.sin(a)*tipR;
    ctx.strokeStyle='rgba(38,56,28,0.78)';ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(gx,gy);ctx.quadraticCurveTo(gx+Math.cos(a)*tipR*.5,gy+Math.sin(a)*tipR*.5,ex,ey);ctx.stroke();
    ctx.strokeStyle='rgba(70,96,54,0.42)';ctx.lineWidth=1.8;
    const vx=ex-gx,vy=ey-gy,vl=Math.hypot(vx,vy),px=-vy/vl,py=vx/vl;
    for(let b=1;b<=4;b++){
      const f=b/5,bx=gx+vx*f,by=gy+vy*f;
      for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+px*s*R0*.12+vx*.04,by+py*s*R0*.12+vy*.04);ctx.stroke();}
    }
  }
  ctx.restore();
  // stem below the leaf
  ctx.strokeStyle='rgba(70,90,45,0.9)';ctx.lineWidth=9;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(gx,gy+R0*0.35);ctx.lineTo(gx+R0*0.04,H-14);ctx.stroke();
  const img = ctx.getImageData(0, 0, W, H), data = img.data;
  const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
  const mx = mc.getContext('2d', { willReadFrequently: true });
  mx.fillStyle = '#fff'; mx.fill(path);
  const mask = mx.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = mask[i * 4 + 3];
  ctx.putImageData(img, 0, 0);
  // dilate RGB into transparent pixels to avoid mip halo
  const rgb = ctx.getImageData(0, 0, W, H), d = rgb.data;
  const opaque = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) opaque[i] = d[i * 4 + 3] > 8 ? 1 : 0;
  for (let pass = 0; pass < 5; pass++) {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (opaque[i]) continue;
      let r = 0, g2 = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = i + dy * W + dx;
        if (opaque[j]) { r += d[j * 4]; g2 += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
      }
      if (n) { d[i * 4] = r / n; d[i * 4 + 1] = g2 / n; d[i * 4 + 2] = b / n; opaque[i] = 1; }
    }
  }
  ctx.putImageData(rgb, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
const leafTex0 = makeLeafTex(0), leafTex1 = makeLeafTex(1), leafTex2 = makeLeafTex(2);

const barkTex = canvasTexture(512, 1024, (ctx, w, h) => {
  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, '#a8a8a8'); base.addColorStop(.5, '#c6c6c6'); base.addColorStop(1, '#9c9c9c');
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1300; i++) {
    const s = Math.floor(rand(55, 225));
    ctx.strokeStyle = `rgba(${s},${s},${s},${rand(.25, .6)})`;
    ctx.lineWidth = rand(.6, 6);
    let x = Math.random() * w, y = -20;
    ctx.beginPath(); ctx.moveTo(x, y);
    while (y < h + 20) { y += rand(10, 26); x += rand(-6, 6) + (Math.random() < .04 ? rand(-16, 16) : 0); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * w, y = Math.random() * h, len = rand(10, 46), s = Math.floor(rand(20, 95));
    ctx.strokeStyle = `rgba(${s},${s},${s},${rand(.3, .65)})`; ctx.lineWidth = rand(1, 3.5);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y + rand(-5, 5), x + len, y + rand(-4, 4)); ctx.stroke();
  }
  for (let k = 0; k < 7; k++) {
    const kx = rand(0, w), ky = rand(0, h), kr = rand(12, 34);
    for (let r = kr; r > 2; r -= 3) {
      ctx.strokeStyle = `rgba(${Math.floor(rand(35, 90))},${Math.floor(rand(30, 75))},${Math.floor(rand(25, 65))},.4)`;
      ctx.lineWidth = rand(1, 2.5);
      ctx.beginPath(); ctx.ellipse(kx, ky, r, r * rand(.5, .8), rand(-.4, .4), 0, 6.283); ctx.stroke();
    }
  }
});
barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping; barkTex.repeat.set(1, 1.8); barkTex.anisotropy = 8;

const rockTex = canvasTexture(512, 512, (ctx, w, h) => {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#b4b4b4'); base.addColorStop(.5, '#c2c2c2'); base.addColorStop(1, '#a4a4a4');
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 15000; i++) {
    const s = Math.floor(rand(80, 235));
    ctx.fillStyle = `rgba(${s},${s},${s},${rand(.1, .3)})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, rand(.3, 1.7), 0, 6.283); ctx.fill();
  }
  for (let i = 0; i < 500; i++) {
    ctx.strokeStyle = `rgba(45,48,44,${rand(.04, .18)})`; ctx.lineWidth = rand(.4, 1.8);
    let x = Math.random() * w, y = Math.random() * h;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += rand(-7, 7); y += rand(-9, 9); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rand(8, 30);
    const mg = ctx.createRadialGradient(x, y, 0, x, y, r);
    mg.addColorStop(0, 'rgba(90,105,80,.16)'); mg.addColorStop(1, 'rgba(90,105,80,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  }
});
rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping; rockTex.repeat.set(2, 2); rockTex.anisotropy = 8;

function normalTexture(src, strength) {
  const im = src.image, w = im.width, h = im.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const px = x.getImageData(0, 0, w, h).data;
  const o = document.createElement('canvas'); o.width = w; o.height = h;
  const ox = o.getContext('2d'); const img = ox.createImageData(w, h);
  const L = (i, j) => { i = (i + w) % w; j = (j + h) % h; const k = (j * w + i) * 4; return (px[k] + px[k + 1] + px[k + 2]) / 765; };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (L(i + 1, j) - L(i - 1, j)) * strength, dy = (L(i, j + 1) - L(i, j - 1)) * strength;
    let nx = -dx, ny = -dy, nz = 1; const inv = 1 / Math.hypot(nx, ny, nz); nx *= inv; ny *= inv; nz *= inv;
    const k = (j * w + i) * 4;
    img.data[k] = (nx * .5 + .5) * 255; img.data[k + 1] = (ny * .5 + .5) * 255; img.data[k + 2] = (nz * .5 + .5) * 255; img.data[k + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(o); t.needsUpdate = true; t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (src.repeat) t.repeat.copy(src.repeat);
  return t;
}
const barkN = normalTexture(barkTex, 2.0), rockN = normalTexture(rockTex, 1.7);

// ---------------------------------------------------------------- seasons
const SEASONS = [
  { name:'春 · Spring',
    top:C('#7fa7c4'), horizon:C('#d9e4d8'), ground:C('#65786a'), cloud:C('#f6e6ea'), fog:C('#c6d2c7'),
    sun:C('#fff2d6'), sunDir:new THREE.Vector3(.55,.62,.35),
    leafLit:C('#8fc75a'), leafShade:C('#2f6636'), leafAccent:C('#c8e08a'),
    sand:C('#d9d4c4'), groove:C('#b0a993'), moss:C('#6f9256'), snow:0, autumn:0,
    waterDeep:C('#284a52'), waterShallow:C('#6a9a92'), skyWater:C('#a9c4c0'),
    bloom:1, petals:1, fireflies:0, leafFall:0, snowFall:0, night:0 },
  { name:'夏 · Summer',
    top:C('#4f8fc4'), horizon:C('#cfe0d0'), ground:C('#425e4a'), cloud:C('#eef4ec'), fog:C('#adc4b3'),
    sun:C('#fff4cf'), sunDir:new THREE.Vector3(.3,.85,.3),
    leafLit:C('#4e9a52'), leafShade:C('#20502f'), leafAccent:C('#8fc95a'),
    sand:C('#dcd5be'), groove:C('#aea688'), moss:C('#4f7c3e'), snow:0, autumn:0,
    waterDeep:C('#1e4c56'), waterShallow:C('#5aa39a'), skyWater:C('#9fc8c0'),
    bloom:0, petals:0, fireflies:.9, leafFall:0, snowFall:0, night:.12 },
  { name:'秋 · Autumn',
    top:C('#8a7f96'), horizon:C('#e8c39a'), ground:C('#6b5a43'), cloud:C('#f3d8b8'), fog:C('#c4a888'),
    sun:C('#ffcf95'), sunDir:new THREE.Vector3(.7,.4,-.1),
    leafLit:C('#e8913c'), leafShade:C('#8f3a22'), leafAccent:C('#f2c95b'),
    sand:C('#d3c6ad'), groove:C('#a89578'), moss:C('#7b7c45'), snow:0, autumn:1,
    waterDeep:C('#3a4038'), waterShallow:C('#947a52'), skyWater:C('#c8aa86'),
    bloom:0, petals:0, fireflies:0, leafFall:1, snowFall:0, night:.05 },
  { name:'冬 · Winter',
    top:C('#5b6e88'), horizon:C('#d4dde6'), ground:C('#56626e'), cloud:C('#e6edf5'), fog:C('#cbd6dd'),
    sun:C('#e8f0ff'), sunDir:new THREE.Vector3(.4,.35,-.35),
    leafLit:C('#c9d2cf'), leafShade:C('#6b7a78'), leafAccent:C('#dce4df'),
    sand:C('#e6ebec'), groove:C('#c4cdd0'), moss:C('#8a9a92'), snow:1, autumn:0,
    waterDeep:C('#39505e'), waterShallow:C('#9fb4bd'), skyWater:C('#c9d6dc'),
    bloom:0, petals:0, fireflies:0, leafFall:0, snowFall:1, night:.25 },
];

// ---------------------------------------------------------------- renderer
const app = document.getElementById('app');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('no-webgl').hidden = false;
  document.getElementById('loader').style.display = 'none';
  throw e;
}
const _gl = renderer.getContext();
const _dbg = _gl.getExtension('WEBGL_debug_renderer_info');
const _gpu = _dbg ? _gl.getParameter(_dbg.UNMASKED_RENDERER_WEBGL) : (_gl.getParameter(_gl.RENDERER) || '');
const isSoftware = /swiftshader|llvmpipe|software|basic render/i.test(_gpu);
// ?hq=1 forces the full real-GPU quality pipeline even on software renderers
// (for visual review). Normal users still get adaptive quality.
const forceHQ = new URLSearchParams(location.search).get('hq') === '1';
const fullQuality = forceHQ || !isSoftware;
renderer.setPixelRatio(fullQuality ? Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2) : 0.7);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = fullQuality;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.72;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(SEASONS[0].fog.getHex(), 0.0026);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(6.6, 5.2, 9.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.055;
controls.target.set(-0.3, 0.9, 0.1);
controls.minDistance = 4.5; controls.maxDistance = 26;
controls.maxPolarAngle = Math.PI * .495; controls.minPolarAngle = 0.25;
controls.enablePan = false; controls.autoRotate = true; controls.autoRotateSpeed = 0.32;

// lighting
const hemi = new THREE.HemisphereLight(0xdfe8f0, 0x4a5546, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 3.2);
sun.position.copy(SEASONS[0].sunDir).multiplyScalar(18);
sun.castShadow = fullQuality;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 45;
sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.015;
sun.shadow.intensity = 1.0;
sun.target.position.set(0, 0, 0);
scene.add(sun.target);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9fc4d8, 0.18);
fill.position.set(-8, 6, -6); scene.add(fill);

// ---------------------------------------------------------------- sky
const skyU = {
  uZenith:{value:SEASONS[0].top.clone()}, uHorizon:{value:SEASONS[0].horizon.clone()},
  uNadir:{value:SEASONS[0].ground.clone()}, uSunColor:{value:SEASONS[0].sun.clone()},
  uMoonColor:{value:C('#dfe8ff')}, uCloudColor:{value:SEASONS[0].cloud.clone()},
  uSunDir:{value:SEASONS[0].sunDir.clone()}, uFog:{value:SEASONS[0].fog.clone()},
  uTime:{value:0}, uNight:{value:0}, uCloudAmt:{value:.45}, uStarAmt:{value:0}, uExposure:{value:1.0},
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20),
  new THREE.ShaderMaterial({ uniforms:skyU, vertexShader:skyVert, fragmentShader:skyFrag, side:THREE.BackSide, depthWrite:false, fog:false }));
scene.add(sky);

// ---------------------------------------------------------------- IBL
const envU = {
  uZenith:{value:SEASONS[0].top.clone().multiplyScalar(1.25)}, uHorizon:{value:SEASONS[0].horizon.clone()},
  uNadir:{value:SEASONS[0].ground.clone().multiplyScalar(.5)}, uGroundColor:{value:SEASONS[0].fog.clone().multiplyScalar(.65)},
  uSunColor:{value:SEASONS[0].sun.clone().multiplyScalar(1.6)}, uSunDir:{value:SEASONS[0].sunDir.clone()},
};
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 40, 24),
  new THREE.ShaderMaterial({ uniforms:envU, vertexShader:envVert, fragmentShader:envFrag, side:THREE.BackSide, depthWrite:false, fog:false })));
const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type:THREE.HalfFloatType, generateMipmaps:false });
const cubeCam = new THREE.CubeCamera(0.1, 200, cubeRT);
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileCubemapShader();
let envRT = null;
function rebuildIBL() {
  cubeCam.update(renderer, envScene);
  const next = pmrem.fromScene(envScene, 0.04, 0.1, 200);
  scene.environment = next.texture;
  scene.environmentIntensity = 0.9;
  if (envRT) envRT.dispose();
  envRT = next;
}
rebuildIBL();

// ---------------------------------------------------------------- materials
const barkMat = new THREE.MeshStandardMaterial({
  color:0xd9b78a, map:barkTex, normalMap:barkN, normalScale:new THREE.Vector2(.6,.6),
  roughness:.86, metalness:0, envMapIntensity:1.4, emissive:0x3a2c1a, emissiveIntensity:.3,
});
const rockMats = [
  new THREE.MeshStandardMaterial({ color:0xbcc0b6, map:rockTex, normalMap:rockN, normalScale:new THREE.Vector2(.4,.4), roughness:.95, envMapIntensity:1.0 }),
  new THREE.MeshStandardMaterial({ color:0x9ca39a, map:rockTex, normalMap:rockN, normalScale:new THREE.Vector2(.4,.4), roughness:.96, envMapIntensity:1.0 }),
  new THREE.MeshStandardMaterial({ color:0xc9c3b4, map:rockTex, normalMap:rockN, normalScale:new THREE.Vector2(.4,.4), roughness:.93, envMapIntensity:1.0 }),
];
const stoneMat = new THREE.MeshStandardMaterial({ color:0x9a9d94, map:rockTex, roughness:.9, envMapIntensity:1.0 });
const darkStoneMat = new THREE.MeshStandardMaterial({ color:0x4a4f49, map:rockTex, roughness:.92, envMapIntensity:.8 });

// ---------------------------------------------------------------- garden base
const slab = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.7, .55, 64), darkStoneMat);
slab.position.y = -.42; slab.receiveShadow = true; slab.castShadow = true; scene.add(slab);
const slabLip = new THREE.Mesh(new THREE.TorusGeometry(6.48, .10, 10, 80), new THREE.MeshStandardMaterial({ color:0x6a6f66, roughness:.8, metalness:.1 }));
slabLip.rotation.x = Math.PI/2; slabLip.position.y = -.16; scene.add(slabLip);
const rim = new THREE.Mesh(new THREE.TorusGeometry(6.05, .16, 10, 96), new THREE.MeshStandardMaterial({ color:0x5d4632, map:barkTex, roughness:.85 }));
rim.rotation.x = Math.PI/2; rim.position.y = .03; rim.castShadow = true; rim.receiveShadow = true; scene.add(rim);

const rockData = [
  new THREE.Vector3(-2.9, 1.2, .85), new THREE.Vector3(2.6, -1.6, .7),
  new THREE.Vector3(3.4, 1.9, .55), new THREE.Vector3(-3.6, -1.9, .5),
];
const rockUniform = rockData.concat(Array.from({length:4}, () => new THREE.Vector3(100,100,.01)));
const treePos = new THREE.Vector2(-.8, .4);
const sandU = {
  uSand:{value:SEASONS[0].sand.clone()}, uGroove:{value:SEASONS[0].groove.clone()},
  uMoss:{value:SEASONS[0].moss.clone()}, uSnowColor:{value:C('#eef3f4')},
  uLeafLitter:{value:C('#b5763a')}, uRocks:{value:rockUniform}, uRockCount:{value:rockData.length},
  uTree:{value:treePos}, uSnow:{value:0}, uAutumn:{value:0}, uTime:{value:0}, uRakeFreq:{value:7.5},
};
const sandMat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:.96, metalness:0 });
sandMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, sandU);
  sh.vertexShader = 'varying vec3 vSandWorld;\n' + sh.vertexShader.replace('#include <worldpos_vertex>',
    '#include <worldpos_vertex>\n vSandWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader = sandInject + '\n' + sh.fragmentShader
    .replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb*=sandColor(vSandWorld.xz);')
    .replace('#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       // rake grooves catch the light: perturb view-space normal by relief gradient
       float h = sandRelief(vSandWorld.xz);
       normal = normalize(normal + vec3(dFdx(h), dFdy(h), 0.0)*-1.2);`);
};
// Raked sand as real displaced geometry: a dense disc whose vertices carry the
// groove relief, so rake lines catch light and self-shadow instead of being a flat texture.
const sand = new THREE.Mesh(new THREE.CircleGeometry(6.0, 96), sandMat);
sand.rotation.x = -Math.PI/2;
sand.position.y = .02; sand.receiveShadow = true; scene.add(sand);

// geometric rake ridges (merged into one draw call)
// Rake grooves are drawn entirely by the sand shader (colour + normal relief).
// Separate torus geometry previously double-drew them, causing moiré/dashing.
const ridgeGroup = new THREE.Group(); scene.add(ridgeGroup);

// rocks
function makeRock(px, pz, sx, sy, sz, mat, seed) {
  const g = new THREE.IcosahedronGeometry(1, 3);   // smoother base for eroded stone
  const pos = g.attributes.position, r = mulberry32(seed);
  const la = r()*6.283, lb = r()*6.283, lc = r()*6.283;
  // smooth coherent displacement (no per-vertex randomness → no faceting)
  const disp = (x,y,z) =>
      .10*Math.sin(x*2.3+la)*Math.cos(z*2.1+lb)
    + .06*Math.sin(y*3.7+lc)*Math.cos(x*3.1+lb)
    + .03*Math.sin(x*6.2+lb)*Math.sin(z*5.4+la);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = .86 + disp(x,y,z);
    pos.setXYZ(i, x*n, y*n*.72, z*n);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.position.set(px, sy*.18, pz); m.scale.set(sx, sy, sz);
  m.rotation.set(r()*.12, r()*6.283, r()*.12);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m); return m;
}
rockData.forEach((rk,i) => makeRock(rk.x, rk.y, rk.z*(i%2?1.1:.9), rk.z*(1.2+i*.1), rk.z*(i%2?.9:1.1), pick(rockMats), 100+i));
for (let i = 0; i < 14; i++) {
  const a = rr(0,6.283), d = rr(2.2,5.5), s = rr(.08,.24);
  makeRock(Math.cos(a)*d, Math.sin(a)*d, s, s*rr(.5,.9), s*rr(.8,1.2), pick(rockMats), 300+i);
}

// ---------------------------------------------------------------- koi pond
const pondX = 3.1, pondZ = 1.0, pondR = 1.55;
const WATER_Y = 0.055;
const basin = new THREE.Mesh(new THREE.CylinderGeometry(pondR+.12, pondR+.18, .3, 64), darkStoneMat);
basin.position.set(pondX, -.1, pondZ); basin.receiveShadow = true; scene.add(basin);
const waterU = {
  uDeep:{value:SEASONS[0].waterDeep.clone()}, uShallow:{value:SEASONS[0].waterShallow.clone()},
  uSky:{value:SEASONS[0].skyWater.clone()}, uSunColor:{value:SEASONS[0].sun.clone()},
  uSunDir:{value:SEASONS[0].sunDir.clone()}, uSnowColor:{value:C('#e8eef0')},
  uTime:{value:0}, uOpacity:{value:.92}, uSnow:{value:0}, uRipple:{value:0}, uEnv:{value:cubeRT.texture},
};
const water = new THREE.Mesh(new THREE.CircleGeometry(pondR, 64),
  new THREE.ShaderMaterial({ uniforms:waterU, vertexShader:waterVert, fragmentShader:waterFrag, transparent:true, side:THREE.DoubleSide, depthWrite:false }));
water.rotation.x = -Math.PI/2; water.position.set(pondX, .055, pondZ); water.renderOrder = 2; scene.add(water);
for (let i = 0; i < 20; i++) {
  const a = (i/20)*6.283, s = rr(.16,.26);
  const st = makeRock(pondX+Math.cos(a)*(pondR+.10), pondZ+Math.sin(a)*(pondR+.10), s*1.15, s*.5, s*.95, rockMats[i%3], 500+i);
  st.position.y = .04;
}
// koi
const koiGroup = new THREE.Group(); scene.add(koiGroup);
const koiWhite = new THREE.MeshStandardMaterial({ color:0xf7f3e8, roughness:.42, metalness:.0 });
const koiOrange = new THREE.MeshStandardMaterial({ color:0xe8792e, roughness:.45 });
const koiDark = new THREE.MeshStandardMaterial({ color:0x2c2620, roughness:.5 });
const finMat = new THREE.MeshStandardMaterial({ color:0xf6e6cf, roughness:.55, side:THREE.DoubleSide, transparent:true, opacity:.82 });
const koi = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  // tapered spindle body built from a lathe profile (head -> belly -> tail)
  const profile = [
    new THREE.Vector2(0.001,-0.30), new THREE.Vector2(0.045,-0.26),
    new THREE.Vector2(0.085,-0.16), new THREE.Vector2(0.105,-0.02),
    new THREE.Vector2(0.095,0.12), new THREE.Vector2(0.055,0.24),
    new THREE.Vector2(0.018,0.31),
  ];
  const bodyGeo = new THREE.LatheGeometry(profile, 12);
  bodyGeo.rotateX(-Math.PI/2);         // head toward +Z (long axis along Z)
  bodyGeo.scale(1, 0.62, 1);            // flatten slightly
  const baseMat = (i===1)?koiOrange:koiWhite;
  const body = new THREE.Mesh(bodyGeo, baseMat);
  g.add(body);
  // characteristic koi patches (orange or black blotches)
  const patchCount = 2 + (i%2);
  for (let k = 0; k < patchCount; k++) {
    const pm = (i===1 ? koiDark : (k%2?koiDark:koiOrange));
    const patch = new THREE.Mesh(new THREE.SphereGeometry(rr(.035,.055),8,6), pm);
    patch.scale.set(1, .35, rr(.8,1.4));
    patch.position.set(rr(-.02,.02), .085, rr(-.18,.18));
    g.add(patch);
  }
  // forked tail fin
  const tail = new THREE.Group(); tail.position.z = 0.32;
  [-1,1].forEach(s=>{
    const tf = new THREE.Mesh(new THREE.ConeGeometry(.075,.20,3), finMat);
    tf.rotation.x = Math.PI/2; tf.rotation.z = s*0.42;
    tf.position.set(s*.03,0,.08); tail.add(tf);
  });
  g.add(tail);
  // pectoral fins
  [-1,1].forEach(s=>{
    const fin = new THREE.Mesh(new THREE.ConeGeometry(.045,.13,3), finMat);
    fin.rotation.z = s*Math.PI/2.3; fin.position.set(s*.08,-.01,-.05);
    g.add(fin);
  });
  g.position.set(pondX, .02, pondZ); koiGroup.add(g);
  koi.push({ mesh:g, tail, phase:rr(0,6.283), radius:rr(.32,1.0), speed:rr(.22,.42) });
}
// lily pads
const lilyMat = new THREE.MeshStandardMaterial({ color:0x5f8f52, roughness:.7, side:THREE.DoubleSide });
for (let i = 0; i < 4; i++) {
  const a = rr(0,6.283), d = rr(.5,1.15);
  const lx = pondX+Math.cos(a)*d, lz = pondZ+Math.sin(a)*d;
  const pad = new THREE.Mesh(new THREE.CircleGeometry(rr(.16,.26), 20, .25, 6.03), lilyMat);
  pad.rotation.x = -Math.PI/2; pad.position.set(lx, .062, lz); scene.add(pad);
}

// ---------------------------------------------------------------- bonsai
const tree = new THREE.Group();
tree.position.set(treePos.x, .05, treePos.y); scene.add(tree);

const branchTips = [];
function tubeFromPoints(points, radii, sides, mat) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tubular = points.length * 3;
  const g = new THREE.TubeGeometry(curve, tubular, 1, sides, false);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const frames = curve.computeFrenetFrames(tubular, false);
  for (let i = 0; i <= tubular; i++) {
    const t = i/tubular, segF = t*(radii.length-1);
    const idx = Math.min(radii.length-2, Math.floor(segF));
    const f = segF-idx, rad = lerp(radii[idx], radii[idx+1], f);
    const nrm = frames.normals[Math.min(i,tubular-1)], bin = frames.binormals[Math.min(i,tubular-1)];
    const center = curve.getPointAt(Math.min(t,.9999));
    for (let j = 0; j <= sides; j++) {
      const vi = i*(sides+1)+j; if (vi >= pos.count) break;
      const a = j/sides*6.283;
      // bark relief: longitudinal ridges + slow gnarl, scaled with trunk size
      const ridge = 1 + rad*(
        0.16*Math.sin(a*7 + t*9.0) +
        0.10*Math.sin(a*13 - t*5.0 + 1.7) +
        0.06*Math.sin(a*3 + t*2.3)
      );
      const rr2 = rad*ridge;
      const nx = nrm.x*Math.cos(a)+bin.x*Math.sin(a);
      const ny = nrm.y*Math.cos(a)+bin.y*Math.sin(a);
      const nz = nrm.z*Math.cos(a)+bin.z*Math.sin(a);
      pos.setXYZ(vi, center.x+nx*rr2, center.y+ny*rr2, center.z+nz*rr2);
      nor.setXYZ(vi, nx, ny, nz);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();   // let ridges catch the light properly
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
const trunkPts = [
  new THREE.Vector3(0,0,0), new THREE.Vector3(.05,.45,.02), new THREE.Vector3(.18,.95,-.05),
  new THREE.Vector3(.42,1.45,-.12), new THREE.Vector3(.30,1.95,-.02),
  new THREE.Vector3(-.05,2.35,.12), new THREE.Vector3(-.30,2.65,.18),
];
const trunkRad = [.42,.34,.27,.21,.16,.11,.07];
tree.add(tubeFromPoints(trunkPts, trunkRad, 18, barkMat));
for (let i = 0; i < 5; i++) {
  const a = (i/5)*6.283+.3;
  const pts = [
    new THREE.Vector3(Math.cos(a)*.05,.12,Math.sin(a)*.05),
    new THREE.Vector3(Math.cos(a)*.30,.05,Math.sin(a)*.30),
    new THREE.Vector3(Math.cos(a)*.62,-.02,Math.sin(a)*.62),
  ];
  tree.add(tubeFromPoints(pts, [.11,.07,.02], 12, barkMat));
}
// Aged moss on the lower trunk and roots — a signature of old bonsai.
const mossTrunkMat = new THREE.MeshStandardMaterial({ color:0x55713a, roughness:1, envMapIntensity:.5 });
{
  const mossGeos = [];
  for (let i = 0; i < 55; i++) {
    const t = R()*0.62;                       // lower two thirds of the trunk
    const seg = t*(trunkPts.length-1);
    const idx = Math.min(trunkPts.length-2, Math.floor(seg));
    const base = trunkPts[idx].clone().lerp(trunkPts[idx+1], seg-idx);
    const rad = lerp(trunkRad[idx], trunkRad[idx+1], seg-idx);
    const ang = R()*6.283;
    const p = base.clone().add(new THREE.Vector3(Math.cos(ang)*rad*.92, rr(-.05,.1), Math.sin(ang)*rad*.92));
    const s = rr(.035,.085);
    const g = new THREE.IcosahedronGeometry(s, 1);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, pos.getY(k)*0.5); // flatten
    g.translate(p.x, p.y, p.z);
    mossGeos.push(g);
  }
  if (mossGeos.length) {
    const m = new THREE.Mesh(mergeGeometries(mossGeos,false), mossTrunkMat);
    m.castShadow = true; m.receiveShadow = true; tree.add(m);
    mossGeos.forEach(g=>g.dispose());
  }
}
function addBranch(start, dir, len, rad, depth) {
  if (depth > 3 || len < .22) { branchTips.push({ pos:start.clone(), radius:rad, depth }); return; }
  const pts = [start.clone()];
  let p = start.clone(), d = dir.clone().normalize();
  for (let i = 1; i <= 4; i++) {
    const t = i/4;
    d.y -= .14+t*.10; d.x += rr(-.22,.22); d.z += rr(-.22,.22); d.normalize();
    p = p.clone().addScaledVector(d, len/4); pts.push(p.clone());
  }
  const radii = [];
  for (let i = 0; i <= 4; i++) radii.push(rad*(1-i/4*.68));
  tree.add(tubeFromPoints(pts, radii, 11, barkMat));
  const end = pts[pts.length-1];
  const n = depth < 2 ? 2 : pick([2,3]);
  for (let i = 0; i < n; i++) {
    const nd = d.clone().applyAxisAngle(new THREE.Vector3(0,1,0), rr(-1,1)+(i-(n-1)/2)*.7);
    nd.y += rr(.05,.35); nd.normalize();
    addBranch(end, nd, len*rr(.55,.74), rad*.6, depth+1);
  }
}
[
  [new THREE.Vector3(.36,1.52,-.1), new THREE.Vector3(1,.5,.2), 1.5],
  [new THREE.Vector3(.25,1.85,0), new THREE.Vector3(-.5,.6,.7), 1.35],
  [new THREE.Vector3(-.15,2.4,.1), new THREE.Vector3(-1,.35,-.3), 1.45],
  [new THREE.Vector3(-.28,2.62,.18), new THREE.Vector3(.3,.5,1), 1.2],
  [new THREE.Vector3(.32,2.1,-.08), new THREE.Vector3(.8,.3,-.8), 1.15],
].forEach(([p,d,l]) => addBranch(p,d,l,.13,0));
branchTips.slice().forEach(tip => {
  if (tip.depth >= 2 && R() > .35) {
    for (let i = 0; i < 2; i++) {
      const d = new THREE.Vector3(rr(-1,1), rr(.1,.6), rr(-1,1)).normalize();
      const end = tip.pos.clone().addScaledVector(d, rr(.2,.45));
      tree.add(tubeFromPoints([tip.pos.clone(), end], [tip.radius*.5, tip.radius*.12], 8, barkMat));
      branchTips.push({ pos:end, radius:tip.radius*.12, depth:4 });
    }
  }
});

// foliage pads — the signature bonsai silhouette
function leafGeometry() {
  // Square card facing the camera; the alpha texture defines the maple silhouette.
  const g = new THREE.PlaneGeometry(1.15, 1.15, 4, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, x*x*0.22 - 0.05);
  }
  g.computeVertexNormals(); return g;
}
const leafGeo = leafGeometry();
const leafU = {
  uTime:{value:0}, uWind:{value:.35}, uWindDir:{value:new THREE.Vector2(1,.3)},
  uCamVel:{value:new THREE.Vector2()}, uLeafScale:{value:1},
  uLeafLit:{value:SEASONS[0].leafLit.clone()}, uLeafShade:{value:SEASONS[0].leafShade.clone()},
  uLeafAccent:{value:SEASONS[0].leafAccent.clone()}, uSunColor:{value:SEASONS[0].sun.clone()},
  uSunDir:{value:SEASONS[0].sunDir.clone()}, uAmbient:{value:1}, uLeafAlpha:{value:1},
  uLeafTex:{value:leafTex0}, uLeafTexB:{value:leafTex1}, uLeafTexC:{value:leafTex2},
  uSnow:{value:0}, uAutumn:{value:0},
};
const leafMat = new THREE.ShaderMaterial({
  uniforms:leafU,
  vertexShader: /* glsl */ `
    attribute float aTint,aSeed,aPhase,aShade;
    uniform float uTime,uWind,uLeafScale,uSnow;
    uniform vec2 uWindDir,uCamVel;
    varying vec2 vUv; varying float vTint,vSeed,vShade;
    varying vec3 vWorldNormal,vViewDir,vLeafWorld;
    void main(){
      vUv=uv;
      if(aSeed>0.5) vUv.x=1.0-vUv.x;
      if(aPhase>0.5) vUv.y=1.0-vUv.y;
      vTint=aTint; vSeed=aSeed; vShade=aShade;
      // per-instance scale was dropped in the billboard rewrite — restore it
      float instScale=length(instanceMatrix[0].xyz);
      float scale=uLeafScale*instScale*(0.7+aShade*.5)*mix(1.0,.62,uSnow*.8);
      // leaf anchor in world space
      vec3 center=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
      // camera-facing basis so the maple silhouette is always visible
      vec3 toCam=normalize(cameraPosition-center);
      vec3 right=normalize(cross(vec3(0.0,1.0,0.0),toCam));
      vec3 up=normalize(cross(toCam,right));
      // per-leaf in-plane tilt so cards aren't perfectly aligned
      float tilt=(aPhase-0.5)*1.2;
      float cs=cos(tilt), sn=sin(tilt);
      vec3 rr2=right*cs+up*sn;
      vec3 uu2=up*cs-right*sn;
      vec3 local=position*scale;
      vec3 world=center + rr2*local.x + uu2*local.y + toCam*local.z;
      vec2 wd=normalize(uWindDir+vec2(1e-4));
      float travel=dot(world.xz,wd);
      float gust=sin(uTime*2.1-travel*1.4+aPhase*6.2831);
      float flutter=sin(uTime*5.4+aPhase*19.0);
      float amp=uWind*(.5+aSeed*.8);
      vec2 perp=vec2(-wd.y,wd.x);
      world.x+=wd.x*(.6+.8*gust)*amp*.075+perp.x*flutter*amp*.03-uCamVel.x*(.02+aSeed*.03);
      world.z+=wd.y*(.6+.8*gust)*amp*.075+perp.y*flutter*amp*.03-uCamVel.y*(.02+aSeed*.03);
      world.y+=max(0.0,gust)*amp*.025;
      vLeafWorld = world.xyz;
      vWorldNormal=normalize(toCam + vec3(0.0,0.35,0.0)*(aSeed-0.5));
      vViewDir=normalize(cameraPosition-world.xyz);
      gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uLeafLit,uLeafShade,uLeafAccent,uSunColor,uSunDir;
    uniform float uAmbient,uLeafAlpha,uSnow;
    uniform sampler2D uLeafTex,uLeafTexB,uLeafTexC;
    varying vec2 vUv; varying float vTint,vSeed,vShade;
    varying vec3 vWorldNormal,vViewDir,vLeafWorld;
    void main(){
      vec4 txA=texture2D(uLeafTex,vUv),txB=texture2D(uLeafTexB,vUv),txC=texture2D(uLeafTexC,vUv);
      vec4 tx=mix(txA,txB,step(.34,vSeed));
      tx=mix(tx,txC,step(.68,vSeed));
      float alpha=tx.a*uLeafAlpha;
      if(alpha<0.03) discard;
      vec3 N=normalize(vWorldNormal);
      if(!gl_FrontFacing) N=-N;
      vec3 V=normalize(vViewDir),L=normalize(uSunDir);
      float texL=tx.r;
      float vein=smoothstep(0.88,0.62,texL);
      N=normalize(N+vec3(dFdx(texL),dFdy(texL),0.0)*4.0);
      float ndl=max(dot(N,L),0.0);
      float ramp=smoothstep(.02,.72,ndl);
      vec3 albedo=tx.rgb;
      // cool the shaded side, warm the lit side (colour-temperature depth cue)
      vec3 season=mix(uLeafShade,uLeafLit,ramp);
      season*=mix(vec3(0.82,0.92,1.12), vec3(1.10,1.02,0.86), ramp);
      vec3 base=albedo*season*1.7;
      // tonal variation: interior leaves darker, canopy tips brighter
      float h = clamp((vLeafWorld.y-1.8)/1.8,0.0,1.0);
      base *= mix(0.62, 1.18, h);
      base *= 0.74 + 0.40*vSeed;
      base=mix(base,base*uLeafAccent*1.8,vTint*.35);
      base*=(.82+.32*vSeed)*vShade;
      base*=(.48+.8*texL);
      base=mix(base,base*.38,vein*.7);
      vec3 H=normalize(L+V);
      float sheen=pow(max(dot(N,H),0.0),34.0)*.45;
      float fres=pow(1.0-max(dot(N,V),0.0),4.0)*.18;
      float sss=pow(max(dot(V,-(L+N*.35)),0.0),2.5)*1.1;
      base+=uSunColor*(sheen+fres);
      base+=uLeafLit*sss*(1.0-ramp*.5);
      base+=uSunColor*max(dot(N+L*.5,V),0.0)*.08;
      base=mix(base,uLeafLit*1.05,uSnow*.35);
      gl_FragColor=vec4(base,alpha);
    }`,
  transparent:false, side:THREE.DoubleSide, depthWrite:true,
  alphaToCoverage: !isMobile,   // smooth alpha-cut edges using the MSAA samples
});

const leafData = [];
const padCenters = [];
branchTips.forEach(tip => {
  if (tip.depth < 2) return;
  padCenters.push({
    p:tip.pos.clone().add(new THREE.Vector3(rr(-.08,.08),rr(-.03,.1),rr(-.08,.08))),
    rx:rr(.36,.58), ry:rr(.13,.22), rz:rr(.36,.58),
  });
});
padCenters.forEach(pad => {
  const count = Math.round(42*(.7+R()*.5));
  for (let i = 0; i < count; i++) {
    const a = rr(0,6.283), rad = Math.sqrt(R());
    const p = pad.p.clone().add(new THREE.Vector3(
      Math.cos(a)*rad*pad.rx, rr(-1,1)*pad.ry*Math.sqrt(1-rad*rad*.6), Math.sin(a)*rad*pad.rz));
    leafData.push({
      p, quat:new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(-.35,.35),rr(0,6.283),rr(-.4,.4))),
      s:rr(.72,1.0), tint:R(), seed:R(), phase:R(), shade:rr(.8,1.15),
    });
  }
});
padCenters.forEach(pad => {
  if (R() > .5) return;
  for (let i = 0; i < 8; i++) {
    const a = rr(0,6.283), rad = Math.sqrt(R())*.7;
    const p = pad.p.clone().add(new THREE.Vector3(Math.cos(a)*rad*pad.rx, rr(-.1,.1), Math.sin(a)*rad*pad.rz));
    leafData.push({ p, quat:new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(-.5,.5),rr(0,6.283),rr(-.5,.5))), s:rr(.6,.85), tint:R(), seed:R(), phase:R(), shade:rr(.7,1.0) });
  }
});
const dummy = new THREE.Object3D();
const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafData.length);
const aTint = new Float32Array(leafData.length), aSeed = new Float32Array(leafData.length),
      aPhase = new Float32Array(leafData.length), aShade = new Float32Array(leafData.length);
leafData.forEach((l,i) => {
  dummy.position.copy(l.p); dummy.quaternion.copy(l.quat); dummy.scale.setScalar(l.s); dummy.updateMatrix();
  leaves.setMatrixAt(i, dummy.matrix);
  aTint[i]=l.tint; aSeed[i]=l.seed; aPhase[i]=l.phase; aShade[i]=l.shade;
});
leaves.instanceMatrix.needsUpdate = true;
leafGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint,1));
leafGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed,1));
leafGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase,1));
leafGeo.setAttribute('aShade', new THREE.InstancedBufferAttribute(aShade,1));
// Correct cutout shadows: a depth material that samples the leaf alpha, so the
// canopy casts leaf-shaped (not solid-quad) shadows.
const leafDepthMat = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
  map: leafTex0,
  alphaTest: 0.45,
  side: THREE.DoubleSide,
});
leaves.customDepthMaterial = leafDepthMat;
leaves.castShadow = true; leaves.frustumCulled = false; tree.add(leaves);

// blossoms (spring)
const blossomGeo = new THREE.IcosahedronGeometry(.032, 0);
const blossomMat = new THREE.MeshStandardMaterial({ color:0xffc4d8, roughness:.55, emissive:0x501830, emissiveIntensity:.35 });
const blossoms = new THREE.InstancedMesh(blossomGeo, blossomMat, 140);
let bi = 0;
for (let i = 0; i < 420 && bi < 140; i++) {
  const l = leafData[Math.floor(R()*leafData.length)];
  if (l.p.y < 2.4 || l.p.length() < 1.2) continue;
  dummy.position.copy(l.p).add(new THREE.Vector3(rr(-.06,.06), rr(0,.1), rr(-.06,.06)));
  dummy.quaternion.identity(); dummy.scale.setScalar(rr(.5,1.0)); dummy.updateMatrix();
  blossoms.setMatrixAt(bi++, dummy.matrix);
}
blossoms.count = bi; blossoms.instanceMatrix.needsUpdate = true; tree.add(blossoms);

// ---------------------------------------------------------------- ground cover
// Low moss cushions, grass tufts and tiny ferns around rocks and the tree base.
// Merged into a handful of draw calls so it stays cheap even in software.
const mossMat = new THREE.MeshStandardMaterial({ color:0x4f7a3e, roughness:1, envMapIntensity:.6 });
const grassMat = new THREE.MeshStandardMaterial({ color:0x6f9a4a, roughness:.95, side:THREE.DoubleSide, envMapIntensity:.6 });
const pebbleMat = new THREE.MeshStandardMaterial({ color:0x9aa093, map:rockTex, roughness:.95 });
{
  // moss cushions (flattened, noisy spheres) around rock bases and tree
  const mossGeos = [];
  const anchors = rockData.map(r => new THREE.Vector3(r.x, 0, r.y))
    .concat([new THREE.Vector3(treePos.x, 0, treePos.y)]);
  anchors.forEach((anc, ai) => {
    const n = ai === anchors.length - 1 ? 16 : 7;
    for (let i = 0; i < n; i++) {
      const a = rr(0,6.283), d = rr(0.45, ai === anchors.length-1 ? 1.6 : 1.25);
      const x = anc.x+Math.cos(a)*d, z = anc.z+Math.sin(a)*d;
      if (Math.hypot(x-pondX,z-pondZ) < pondR+0.25) continue;
      if (Math.hypot(x,z) > 5.7) continue;
      const s = rr(.10,.26);
      const g = new THREE.IcosahedronGeometry(s, 1);
      const pos = g.attributes.position;
      for (let k = 0; k < pos.count; k++) pos.setY(k, pos.getY(k)*rr(.35,.6));
      g.translate(x, .03+s*.12, z);
      mossGeos.push(g);
    }
  });
  if (mossGeos.length) {
    const m = new THREE.Mesh(mergeGeometries(mossGeos,false), mossMat);
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
    mossGeos.forEach(g=>g.dispose());
  }
  // grass tufts: crossed blades as thin tapered triangles
  const tufts = [];
  for (let i = 0; i < 220; i++) {
    const a = rr(0,6.283), d = Math.sqrt(R())*5.5;
    const x = Math.cos(a)*d, z = Math.sin(a)*d;
    if (Math.hypot(x-pondX,z-pondZ) < pondR+0.15) continue;
    tufts.push([x,z]);
  }
  const bladeGeos = [];
  const bladeShape = new THREE.BufferGeometry();
  // a single tapered blade (quad-ish triangle) reused via transforms
  const bv = new Float32Array([-.018,0,0, .018,0,0, 0,.28,0, 0,.28,0]);
  bladeShape.setAttribute('position', new THREE.BufferAttribute(bv,3));
  bladeShape.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),3));
  bladeShape.setIndex([0,1,2,3,2,1]);
  tufts.forEach(([x,z]) => {
    const blades = 3+Math.floor(R()*4);
    for (let b = 0; b < blades; b++) {
      const g = bladeShape.clone();
      const m = new THREE.Matrix4()
        .makeRotationY(rr(0,6.283))
        .multiply(new THREE.Matrix4().makeScale(1, rr(.7,1.6), 1));
      g.applyMatrix4(m);
      g.translate(x+rr(-.06,.06), .04, z+rr(-.06,.06));
      bladeGeos.push(g);
    }
  });
  if (bladeGeos.length) {
    const gm = mergeGeometries(bladeGeos,false);
    const grass = new THREE.Mesh(gm, grassMat);
    grass.castShadow = false; grass.receiveShadow = false;
    scene.add(grass);
    bladeGeos.forEach(g=>g.dispose());
  }
  // scattered fine pebbles
  const pebbleGeos = [];
  for (let i = 0; i < 90; i++) {
    const a = rr(0,6.283), d = Math.sqrt(R())*5.7;
    const x = Math.cos(a)*d, z = Math.sin(a)*d;
    if (Math.hypot(x-pondX,z-pondZ) < pondR+0.1) continue;
    const s = rr(.02,.055);
    const g = new THREE.IcosahedronGeometry(s,0);
    g.scale(1,.5,1); g.translate(x,.02,z);
    pebbleGeos.push(g);
  }
  if (pebbleGeos.length) {
    const pm = new THREE.Mesh(mergeGeometries(pebbleGeos,false), pebbleMat);
    pm.castShadow = false; pm.receiveShadow = true; scene.add(pm);
    pebbleGeos.forEach(g=>g.dispose());
  }
}

// ---------------------------------------------------------------- contact shadow decals
// Soft radial shadow blobs that ground props in the default (no real-shadow) path.
// Subtle enough to coexist with real shadows in HQ, so they stay enabled always.
// Contact grounding is baked into the sand shader (see sandInject) — reliable in
// every quality tier and free of decal sorting issues.

// ---------------------------------------------------------------- bamboo, lantern, torii, hills
const bambooGroup = new THREE.Group(); scene.add(bambooGroup);
const bambooMat = new THREE.MeshStandardMaterial({ color:0x6e8b4a, roughness:.85 });
const bambooLeafMat = new THREE.MeshStandardMaterial({ color:0x53753d, roughness:.9, side:THREE.DoubleSide });
function makeBamboo(x, z, h, seed, scale = 1) {
  const g = new THREE.Group(); g.position.set(x,-0.75,z);   // base on the ground plane
  g.scale.setScalar(scale);
  // dark rooted base so stalks don't float on the surface
  const root = new THREE.Mesh(new THREE.IcosahedronGeometry(.16,1), new THREE.MeshStandardMaterial({ color:0x3e4a33, roughness:1 }));
  root.scale.set(1.6,.35,1.6); root.position.y=.05; g.add(root);
  const segs = Math.round(h/.55);
  for (let i = 0; i < segs; i++) {
    const r = .055-i*.0025;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r*1.05, .52, 7), bambooMat);
    seg.position.y = i*.55+.26; seg.rotation.z = Math.sin(seed+i*.4)*.015; seg.castShadow = true; g.add(seg);
    const node = new THREE.Mesh(new THREE.TorusGeometry(r*1.05,.012,5,8), darkStoneMat);
    node.rotation.x = Math.PI/2; node.position.y = i*.55+.52; g.add(node);
  }
  // denser leaf sprays near the top, in a small fan per node
  for (let i = 0; i < segs*4; i++) {
    const a = R()*6.283, y = h*rr(.5,1.0);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(.08,.42), bambooLeafMat);
    leaf.position.set(Math.cos(a)*rr(.08,.32), y, Math.sin(a)*rr(.08,.32));
    leaf.rotation.set(rr(-.5,.5), a, rr(.2,1.1)); g.add(leaf);
  }
  bambooGroup.add(g);
}
// grow bamboo in natural groves (clusters) rather than isolated evenly-spread stalks
for (let grove = 0; grove < 7; grove++) {
  const ga = (grove/7)*6.283 + rr(-.3,.3);
  const gd = rr(13,18);
  const gx = Math.cos(ga)*gd, gz = Math.sin(ga)*gd;
  const n = 3 + Math.floor(R()*4);
  for (let i = 0; i < n; i++) {
    const a = R()*6.283, d = rr(0.3, 2.0);
    makeBamboo(gx+Math.cos(a)*d, gz+Math.sin(a)*d, rr(2.6,4.8), R()*10, rr(.8,1.25));
  }
}

const lantern = new THREE.Group(); lantern.position.set(-3.9, 0, 1.6); scene.add(lantern);
const lanternStone = new THREE.MeshStandardMaterial({ color:0x9a9d94, map:rockTex, normalMap:rockN, roughness:.95, envMapIntensity:.7 });
const lanternEdge = new THREE.MeshStandardMaterial({ color:0x7b8078, map:rockTex, roughness:.98 });
// broad footing + pedestal
const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(.40,.52,.18,8), lanternEdge); lanternBase.position.y=.09; lantern.add(lanternBase);
const lanternFoot = new THREE.Mesh(new THREE.CylinderGeometry(.30,.38,.14,8), lanternStone); lanternFoot.position.y=.24; lantern.add(lanternFoot);
// tapered shaft with a subtle ring
const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,.86,8), lanternStone); lanternPost.position.y=.74; lantern.add(lanternPost);
const shaftRing = new THREE.Mesh(new THREE.TorusGeometry(.15,.025,6,12), lanternEdge); shaftRing.rotation.x=Math.PI/2; shaftRing.position.y=.52; lantern.add(shaftRing);
// platform under the light chamber
const lanternMid = new THREE.Mesh(new THREE.CylinderGeometry(.38,.28,.14,8), lanternStone); lanternMid.position.y=1.22; lantern.add(lanternMid);
// open light chamber: four corner posts + translucent glowing core
const lanternLight = new THREE.Mesh(new THREE.BoxGeometry(.30,.34,.30), new THREE.MeshStandardMaterial({ color:0xffdca0, emissive:0xffbb55, emissiveIntensity:0, roughness:.6 }));
lanternLight.position.y=1.48; lantern.add(lanternLight);
const chamberMat = new THREE.MeshStandardMaterial({ color:0x8f958c, roughness:.95, transparent:true, opacity:.55, side:THREE.DoubleSide });
const chamber = new THREE.Mesh(new THREE.BoxGeometry(.42,.36,.42), chamberMat); chamber.position.y=1.48; lantern.add(chamber);
[[-.19,-.19],[-.19,.19],[.19,-.19],[.19,.19]].forEach(([x,z])=>{
  const cpost=new THREE.Mesh(new THREE.BoxGeometry(.045,.38,.045), lanternStone);
  cpost.position.set(x,1.48,z); lantern.add(cpost);
});
// pagoda roof: broad low pyramid with layered eaves + upturned corners
const lanternRoof = new THREE.Mesh(new THREE.ConeGeometry(.58,.30,4), lanternStone);
lanternRoof.position.y=1.85; lanternRoof.rotation.y=Math.PI/4; lantern.add(lanternRoof);
const eave = new THREE.Mesh(new THREE.CylinderGeometry(.60,.60,.05,4), lanternEdge);
eave.rotation.y=Math.PI/4; eave.position.y=1.71; lantern.add(eave);
[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz])=>{
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5), lanternEdge);
  tip.position.set(sx*.42,1.70,sz*.42); lantern.add(tip);
});
// finial
const lanternNeck = new THREE.Mesh(new THREE.CylinderGeometry(.07,.10,.10,8), lanternStone); lanternNeck.position.y=2.04; lantern.add(lanternNeck);
const lanternTop = new THREE.Mesh(new THREE.SphereGeometry(.10,10,8), lanternStone); lanternTop.position.y=2.16; lantern.add(lanternTop);
lantern.traverse(o => { if (o.isMesh) { o.castShadow=true; o.receiveShadow=true; } });
const lanternGlow = new THREE.PointLight(0xffbb66, 0, 6, 2); lanternGlow.position.set(-3.9,1.48,1.6); scene.add(lanternGlow);

const torii = new THREE.Group(); torii.position.set(0,-.72,-9.5); scene.add(torii);
// Weathered vermilion: desaturated and darker so it sits in the pastel palette
const toriiTex = canvasTexture(128,128,(ctx,w,h)=>{
  ctx.fillStyle='#b0b0b0'; ctx.fillRect(0,0,w,h);
  for(let i=0;i<1600;i++){const s=Math.floor(rand(70,210));ctx.fillStyle=`rgba(${s},${s},${s},${rand(.1,.35)})`;ctx.beginPath();ctx.arc(Math.random()*w,Math.random()*h,rand(.4,1.8),0,6.283);ctx.fill();}
  for(let i=0;i<80;i++){ctx.strokeStyle=`rgba(40,30,25,${rand(.05,.18)})`;ctx.lineWidth=rand(.5,1.5);const x=Math.random()*w,y=Math.random()*h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand(-6,6),y+rand(-10,10));ctx.stroke();}
});
toriiTex.wrapS=toriiTex.wrapT=THREE.RepeatWrapping; toriiTex.repeat.set(1,2);
const toriiMat = new THREE.MeshStandardMaterial({ color:0x8f3b32, map:toriiTex, roughness:.92, envMapIntensity:.7 });
const toriiDark = new THREE.MeshStandardMaterial({ color:0x2e2724, roughness:.9 });
[-1.25,1.25].forEach(x => {
  // slightly tapered posts with a dark protective base band
  const p = new THREE.Mesh(new THREE.CylinderGeometry(.095,.12,2.45,12), toriiMat);
  p.position.set(x,1.22,0); p.castShadow=true; torii.add(p);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.105,.11,.26,12), toriiDark);
  band.position.set(x,.16,0); torii.add(band);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.24,.30,.16,10), stoneMat);
  foot.position.set(x,.02,0); foot.castShadow=true; foot.receiveShadow=true; torii.add(foot);
});
// lower tie beam (nuki)
const nuki = new THREE.Mesh(new THREE.BoxGeometry(2.9,.13,.19), toriiMat); nuki.position.y=1.82; nuki.castShadow=true; torii.add(nuki);
// upper lintel (shimaki) + gently upturned kasagi cap built from a tapered box
const shimaki = new THREE.Mesh(new THREE.BoxGeometry(3.25,.16,.26), toriiMat); shimaki.position.y=2.30; shimaki.castShadow=true; torii.add(shimaki);
const kasagi = new THREE.Mesh(new THREE.BoxGeometry(3.55,.11,.32), toriiDark); kasagi.position.y=2.42; kasagi.castShadow=true; torii.add(kasagi);
[-1,1].forEach(s=>{const tip=new THREE.Mesh(new THREE.BoxGeometry(.34,.10,.32),toriiDark);tip.position.set(s*1.78,2.46,0);tip.rotation.z=-s*.16;torii.add(tip);});
// central plaque (gakuzuka)
const plaque = new THREE.Mesh(new THREE.BoxGeometry(.22,.34,.08), toriiDark); plaque.position.set(0,2.08,.14); torii.add(plaque);
// stepping-stone path leading from the garden toward the torii
const pathMat = new THREE.MeshStandardMaterial({ color:0x8f958a, map:rockTex, roughness:.95 });
for (let i = 0; i < 9; i++) {
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.30,.34,.08,7), pathMat);
  const z = -6.6 - i*0.34;
  st.position.set(Math.sin(i*0.7)*0.18, -0.70, z);
  st.rotation.y = rr(0,6.283);
  st.scale.set(rr(.85,1.1),1,rr(.7,1.0));
  st.receiveShadow=true; st.castShadow=true;
  scene.add(st);
}

// Noise-displaced mountain ridges: smooth, layered terrain instead of cone primitives.
function mountainRange(opts) {
  const { cx, cz, width, depth, height, color, seed, mist } = opts;
  const rnd = mulberry32(seed);
  const o1 = rnd()*100, o2 = rnd()*100;
  const segX = 96, segZ = 48;
  const g = new THREE.PlaneGeometry(width, depth, segX, segZ);
  g.rotateX(-Math.PI/2);
  const pos = g.attributes.position;
  const colors = [];
  const base = C(color);
  const snow = C(0xe9f0ec);
  // Distinct overlapping peaks with jagged ridgelines, precomputed once.
  const peaks = [];
  const peakCount = 5 + (seed % 3);
  for (let p = 0; p < peakCount; p++) {
    const rs = mulberry32(seed*131 + p*17);
    peaks.push({
      px:(rs()-0.5)*width*0.82,
      pz:-depth*0.15-rs()*depth*0.5,
      pw:width*(0.10+rs()*0.13),
      ph:height*(0.55+rs()*0.5),
      phase:rs()*6.283,
    });
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let peakH = 0;
    for (let p = 0; p < peaks.length; p++) {
      const pk = peaks[p];
      const dx = (x-pk.px)/pk.pw, dz = (z-pk.pz)/(pk.pw*1.6);
      const rd = Math.sqrt(dx*dx + dz*dz);
      if (rd < 1.6) {
        const cone = Math.pow(Math.max(0, 1-rd), 1.5);
        const ang = Math.atan2(dz, dx);
        const jag = 0.86 + 0.14*Math.sin(ang*5+seed+pk.phase) + 0.06*Math.sin(ang*9+pk.phase);
        peakH = Math.max(peakH, cone*pk.ph*jag);
      }
    }
    // ridged multifractal surface detail — fewer/lower octaves to avoid
    // sub-pixel striping (moiré) on the distant, small-on-screen mountains
    const nx = (x+o1)*0.18, nz = (z+o2)*0.18;
    let n = 0, amp = 0.5, freq = 1;
    for (let k = 0; k < 3; k++) {
      let v = Math.sin(nx*freq)*Math.cos(nz*freq*0.8+seed);
      v = 1 - Math.abs(v); v = v*v;
      n += amp*v; amp *= 0.5; freq *= 2.0;
    }
    n /= 0.875; // normalize for the reduced octave count
    const frontT = clamp((depth/2 - z)/depth, 0, 1);
    const backRise = smoothstep(0, 0.85, frontT);
    const sideTaper = 1 - smoothstep(width*0.34, width*0.5, Math.abs(x));
    let y = (peakH*0.85 + n*height*0.28)*backRise*(0.4+0.6*sideTaper) - 2.4;
    pos.setY(i, y);
    const hN = clamp(y/height, 0, 1);
    // subtle altitude tint; restrained snow only on the very highest crests
    const c = base.clone().multiplyScalar(0.82 + hN*0.34);
    if (hN > 0.78) c.lerp(snow, smoothstep(0.78, 1.0, hN)*0.45);
    // blend the low base into the ground/mist so there is no hard seam
    const baseBlend = smoothstep(0.02, 0.5, hN);
    c.lerp(C(0x5f6f5b), (1-baseBlend)*0.9);
    c.lerp(C(mist), (1-backRise)*0.55);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    vertexColors:true, roughness:1, metalness:0, flatShading:false,
    fog:true, envMapIntensity:0.35, side:THREE.DoubleSide,
  }));
  m.position.set(cx, 0, cz);
  m.receiveShadow = false;
  scene.add(m);
  return m;
}
const mistC = 0xbccbbd;
mountainRange({ cx:0, cz:-26, width:80, depth:26, height:11, color:0x6d8474, seed:3, mist:mistC });
mountainRange({ cx:-20, cz:-30, width:60, depth:24, height:14, color:0x7b907d, seed:7, mist:mistC });
mountainRange({ cx:22, cz:-31, width:60, depth:24, height:13, color:0x809580, seed:11, mist:mistC });
mountainRange({ cx:2, cz:-38, width:110, depth:26, height:17, color:0x6a806f, seed:17, mist:mistC });
// Ground fades to the horizon/fog colour with distance — atmospheric perspective
// without discrete mist planes (which create hard seams).
const groundMat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:1 });
const groundU = { uNear:{value:C(0x5f6f5b)}, uFar:{value:SEASONS[0].fog.clone()} };
groundMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, groundU);
  sh.vertexShader = 'varying vec3 vGWorld;\n' + sh.vertexShader.replace('#include <worldpos_vertex>',
    '#include <worldpos_vertex>\n vGWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader = `
    uniform vec3 uNear,uFar; varying vec3 vGWorld;
    float gh(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float gn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(gh(i),gh(i+vec2(1,0)),f.x),mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x),f.y); }
  ` + sh.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
     float gd=length(vGWorld.xz);
     vec3 gc=mix(uNear,uFar,smoothstep(8.0,55.0,gd));
     // soft mottled ground variation; fine speckle fades with distance to avoid moire
     float m=gn(vGWorld.xz*0.35)*0.5+gn(vGWorld.xz*1.2)*0.3+gn(vGWorld.xz*3.5)*0.2;
     gc*=0.86+m*0.28;
     float detailFade = 1.0-smoothstep(12.0,28.0,gd);
     float sp=smoothstep(0.72,0.92,gn(vGWorld.xz*9.0))*detailFade;
     gc=mix(gc,gc*1.18,sp*0.4);
     diffuseColor.rgb*=gc;`);
};
const ground = new THREE.Mesh(new THREE.CircleGeometry(160,64), groundMat);
ground.rotation.x = -Math.PI/2; ground.position.y = -.75; ground.receiveShadow=true; scene.add(ground);

// ---------------------------------------------------------------- particles
function makeParticles(mode, count, color, size) {
  const pos = new Float32Array(count*3), seed = new Float32Array(count), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i*3]=rr(-4.0,4.0); pos[i*3+1]=rr(0,4.0); pos[i*3+2]=rr(-4.0,4.0);
    seed[i]=R(); sz[i]=rr(size*.6,size*1.4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed,1));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz,1));
  const u = {
    uTime:{value:0}, uPixelRatio:{value:renderer.getPixelRatio()}, uMode:{value:mode},
    uRange:{value:7.5}, uBaseY:{value:.3}, uFall:{value:1}, uWind:{value:0},
    uWindDir:{value:new THREE.Vector2(1,.3)}, uCamVel:{value:new THREE.Vector2()},
    uColor:{value:color.clone()}, uOpacity:{value:0},
  };
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms:u, vertexShader:particleVert, fragmentShader:particleFrag,
    transparent:true, depthWrite:false, blending:THREE.NormalBlending,
  }));
  m.frustumCulled = false; scene.add(m);
  return { mesh:m, uniforms:u };
}
const pPetals = makeParticles(0, isMobile?24:48, C('#f2a8bf'), 4);
const pFireflies = makeParticles(1, isMobile?25:55, C('#ffe98a'), 12);
const pLeaves = makeParticles(2, isMobile?45:95, C('#d97a36'), 8);
const pSnow = makeParticles(3, isMobile?110:260, C('#ffffff'), 9);

// ---------------------------------------------------------------- post-processing
// Multisampled HDR target: true MSAA smooths geometry and alpha-cut foliage edges
// before post passes. 4 samples is a good quality/performance balance.
const msaaSamples = isMobile ? 0 : (isSoftware ? 2 : 4);
const composerRT = new THREE.WebGLRenderTarget(
  Math.floor(window.innerWidth*renderer.getPixelRatio()),
  Math.floor(window.innerHeight*renderer.getPixelRatio()),
  { type:THREE.HalfFloatType, samples:msaaSamples }
);
const composer = new EffectComposer(renderer, composerRT);
composer.addPass(new RenderPass(scene, camera));
const gtaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
gtaoPass.output = GTAOPass.OUTPUT.Default;
gtaoPass.blendIntensity = 1.3;
gtaoPass.updateGtaoMaterial({ radius:.35, distanceExponent:1.2, thickness:.8, distanceFallOff:1, scale:1.5, samples:isMobile?12:20, screenSpaceRadius:false });
gtaoPass.updatePdMaterial({ lumaPhi:10, depthPhi:2, normalPhi:3, radius:5, rings:2, samples:12 });
gtaoPass.enabled = fullQuality; composer.addPass(gtaoPass);
const bokehPass = new BokehPass(scene, camera, { focus:12, aperture:isMobile?.00025:.00065, maxblur:.011 });
bokehPass.enabled = fullQuality; composer.addPass(bokehPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), isMobile?.12:.16, .6, .96);
bloom.enabled = fullQuality; composer.addPass(bloom);
const grade = new ShaderPass(gradeShader); composer.addPass(grade);
const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight); composer.addPass(smaaPass);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- state & interaction
const state = {
  seasonF:0, targetSeason:0, speed:45, paused:true, autoRotate:true, quality:true,
  closeView:false, windGust:0, time:0, lastCamPos:camera.position.clone(),
  timeOfDay:0.5, autoDay:false,        // 0.5 = midday; 0/1 = midnight
};
const urlParams = new URLSearchParams(location.search);
const initialSeason = parseInt(urlParams.get('season'), 10);
if (initialSeason >= 1 && initialSeason <= 4) state.seasonF = state.targetSeason = initialSeason-1;
if (urlParams.get('play') === '1') {
  state.paused = false;
  const bp = document.getElementById('btn-pause'); if (bp) bp.classList.add('active');
}
const seasonEls = {
  name:document.getElementById('season-name'), day:document.getElementById('season-day'),
  fps:document.getElementById('stat-fps'), marker:document.getElementById('track-marker'),
};
const pips = Array.from(document.querySelectorAll('.pip'));
if (initialSeason >= 1 && initialSeason <= 4) pips.forEach((p,k) => p.classList.toggle('active', k===state.targetSeason));
function setSeason(i) { state.targetSeason=i; pips.forEach((p,k) => p.classList.toggle('active', k===i)); }
pips.forEach(p => p.addEventListener('click', () => setSeason(parseInt(p.dataset.i,10))));
document.getElementById('btn-pause').addEventListener('click', e => { state.paused=!state.paused; e.currentTarget.classList.toggle('active',!state.paused); });
document.getElementById('btn-orbit').addEventListener('click', e => { state.autoRotate=!state.autoRotate; controls.autoRotate=state.autoRotate&&!state.closeView; e.currentTarget.classList.toggle('active',state.autoRotate); });
document.getElementById('btn-time').addEventListener('click', (e) => {
  // cycle: midday -> dusk -> night -> dawn -> midday
  const stops = [0.5, 0.75, 0.0, 0.25];
  const cur = stops.reduce((best,s,i)=>Math.abs(s-state.timeOfDay)<Math.abs(stops[best]-state.timeOfDay)?i:best,0);
  state.timeOfDay = stops[(cur+1)%stops.length];
  e.currentTarget.textContent = state.timeOfDay===0.5?'白昼':state.timeOfDay===0.75?'黄昏':state.timeOfDay===0?'夜色':'拂晓';
  e.currentTarget.classList.toggle('active', state.timeOfDay!==0.5);
});
document.getElementById('btn-quality').addEventListener('click', e => {
  state.quality=!state.quality; e.currentTarget.classList.toggle('active',state.quality);
  gtaoPass.enabled=state.quality&&fullQuality; bokehPass.enabled=state.quality&&fullQuality;
  bloom.enabled=state.quality&&fullQuality; smaaPass.enabled=state.quality;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, state.quality?(isMobile?1.6:2):1));
  onResize();
});
let camTween = null;
document.getElementById('btn-view').addEventListener('click', e => {
  state.closeView=!state.closeView; e.currentTarget.classList.toggle('active',state.closeView);
  e.currentTarget.textContent = state.closeView?'远景':'近景';
  controls.autoRotate = !state.closeView && state.autoRotate;
  controls.minDistance = state.closeView?2.4:4.5;
  const to = state.closeView?new THREE.Vector3(2.6,3.6,3.8):new THREE.Vector3(6.6,5.2,9.6);
  const tTo = state.closeView?new THREE.Vector3(-0.6,2.55,.25):new THREE.Vector3(-0.3,0.9,.1);
  camTween = { from:camera.position.clone(), to, start:performance.now(), tFrom:controls.target.clone(), tTo };
});
document.getElementById('btn-reset').addEventListener('click', () => {
  setSeason(0); state.speed=45; document.getElementById('speed-range').value='45';
  state.timeOfDay=0.5;
  const bt=document.getElementById('btn-time'); if(bt){bt.textContent='白昼';bt.classList.remove('active');}
  camTween = { from:camera.position.clone(), to:new THREE.Vector3(6.6,5.2,9.6), start:performance.now(), tFrom:controls.target.clone(), tTo:new THREE.Vector3(-0.3,0.9,0.1) };
});
const speedRange = document.getElementById('speed-range');
function updateSpeedLabel() {
  const v = parseInt(speedRange.value,10); state.speed=v;
  const secs = Math.round(lerp(240,12,v/100));
  document.getElementById('speed-val').textContent = v===0?'静止':`约 ${secs} 秒 / 年`;
}
speedRange.addEventListener('input', updateSpeedLabel); updateSpeedLabel();
window.addEventListener('keydown', e => {
  if (e.code==='Space') { e.preventDefault(); document.getElementById('btn-pause').click(); }
  else if (e.code>='Digit1'&&e.code<='Digit4') setSeason(parseInt(e.code.slice(-1),10)-1);
  else if (e.code==='KeyR') document.getElementById('btn-reset').click();
  else if (e.code==='KeyT') document.getElementById('btn-time').click();
  else if (e.code==='KeyH') document.getElementById('ui').classList.toggle('hidden');
});
renderer.domElement.addEventListener('pointerdown', () => { state.windGust=Math.min(1,state.windGust+.25); });
renderer.domElement.addEventListener('click', () => { state.windGust=1; waterU.uRipple.value=1; });
function onResize() {
  const w=window.innerWidth, h=window.innerHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h); composer.setSize(w,h);
  bloom.resolution.set(w,h);
  if (smaaPass.setSize) smaaPass.setSize(w,h);
  const pr = renderer.getPixelRatio();
  [pPetals,pFireflies,pLeaves,pSnow].forEach(p => p.uniforms.uPixelRatio.value=pr);
}
window.addEventListener('resize', onResize);
onResize();

const tmpC = new THREE.Color();
function mixC(a,b,t,out) { return out.copy(a).lerp(b,t); }

// ---------------------------------------------------------------- animation
const clock = new THREE.Clock();
let frames=0, fpsTimer=0, loadP=0, loaded=false;
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderSub = document.getElementById('loader-sub');
const loadStart = performance.now()*.001;
let lastEnvSeason = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  state.time += dt;
  const T = state.time;

  if (!loaded) {
    const elapsed = performance.now()*.001-loadStart;
    loadP = clamp(Math.max(loadP+dt*.9, elapsed/2.6),0,1);
    if (loaderFill) loaderFill.style.width=(loadP*100).toFixed(0)+'%';
    if (loaderSub) loaderSub.textContent = loadP<.35?'planting the seed…':loadP<.7?'growing branches…':'raking the sand…';
    if (loadP>=1) { loaded=true; loader.classList.add('done'); setTimeout(()=>loader.style.display='none',700); }
  }

  if (!state.paused && state.speed>0) {
    state.seasonF += dt*(state.speed/100)*(4/lerp(240,12,state.speed/100));
  } else if (state.targetSeason!==Math.round(state.seasonF)%4 && state.paused) {
    let diff = ((state.targetSeason-(state.seasonF%4)+4)%4);
    if (diff>2) diff-=4;
    state.seasonF += diff*Math.min(1,dt*3);
  }
  state.seasonF = ((state.seasonF%4)+4)%4;
  const i0 = Math.floor(state.seasonF)%4, i1 = (i0+1)%4, st = smoothstep(0,1,state.seasonF-Math.floor(state.seasonF));
  const a = SEASONS[i0], b = SEASONS[i1];
  const blendN = (k) => lerp(a[k], b[k], st);

  if (camTween) {
    camTween.t = clamp((performance.now()-camTween.start)/900,0,1);
    const e = smoothstep(0,1,camTween.t);
    camera.position.lerpVectors(camTween.from,camTween.to,e);
    controls.target.lerpVectors(camTween.tFrom,camTween.tTo,e);
    if (camTween.t>=1) camTween=null;
  }
  controls.update();

  if (fullQuality && bokehPass.enabled) {
    const ft = camera.position.distanceTo(controls.target);
    bokehPass.uniforms.focus.value += (ft-bokehPass.uniforms.focus.value)*.05;
  }
  const envKey = state.seasonF + state.timeOfDay*10;
  if (Math.abs(envKey-lastEnvSeason) > .28) {
    const eNight = Math.max(blendN('night'), 1-Math.min(1,Math.abs(state.timeOfDay-0.5)*4));
    envU.uZenith.value.copy(mixC(a.top,b.top,st,tmpC)).multiplyScalar(1.25*(1-eNight*0.92));
    envU.uHorizon.value.copy(mixC(a.horizon,b.horizon,st,tmpC)).multiplyScalar(1-eNight*0.85);
    envU.uNadir.value.copy(mixC(a.ground,b.ground,st,tmpC)).multiplyScalar(.5*(1-eNight*0.8));
    envU.uGroundColor.value.copy(mixC(a.fog,b.fog,st,tmpC)).multiplyScalar(.65*(1-eNight*0.8));
    envU.uSunColor.value.copy(mixC(a.sun,b.sun,st,tmpC)).multiplyScalar(1.6*(1-eNight*0.95));
    envU.uSunDir.value.copy(a.sunDir).lerp(b.sunDir,st).normalize();
    rebuildIBL();
    lastEnvSeason = envKey;
  }

  const camDelta = camera.position.clone().sub(state.lastCamPos);
  const camVel = new THREE.Vector2(camDelta.x,camDelta.z).multiplyScalar(1/Math.max(dt,.001)).clampLength(0,3);
  state.lastCamPos.copy(camera.position);
  const sm = new THREE.Vector2().lerpVectors(leafU.uCamVel.value,camVel,.15);
  leafU.uCamVel.value.copy(sm);
  [pPetals,pFireflies,pLeaves,pSnow].forEach(p=>p.uniforms.uCamVel.value.copy(sm));

  state.windGust = Math.max(0,state.windGust-dt*.35);
  const gust = .3+state.windGust*.9+Math.sin(T*.6)*.08;

  // sky / light
  const night = blendN('night');
  // time-of-day: 0.5 noon, 0/1 midnight, 0.25 dawn, 0.75 dusk
  const tod = state.timeOfDay;
  const todNight = 1 - Math.min(1, Math.max(0, 1 - Math.abs(tod-0.5)*4));
  // 0 at noon (tod=0.5), 1 at midnight (tod=0 or 1)
  const golden = Math.max(0, 1 - Math.abs(Math.abs(tod-0.5)-0.25)/0.18); // peaks at dawn/dusk
  const effectiveNight = Math.max(night, todNight);
  mixC(a.top,b.top,st,skyU.uZenith.value);
  mixC(a.horizon,b.horizon,st,skyU.uHorizon.value);
  mixC(a.ground,b.ground,st,skyU.uNadir.value);
  mixC(a.sun,b.sun,st,skyU.uSunColor.value);
  mixC(a.cloud,b.cloud,st,skyU.uCloudColor.value);
  mixC(a.fog,b.fog,st,skyU.uFog.value);
  // darken sky toward night; warm the horizon at golden hour
  skyU.uZenith.value.lerp(C(0x0b1430), todNight*0.9);
  skyU.uHorizon.value.lerp(C(0x22304a), todNight*0.85).lerp(C(0xff9a5c), golden*0.55);
  skyU.uNadir.value.lerp(C(0x0a1018), todNight*0.8);
  skyU.uCloudColor.value.lerp(C(0x6a5a72), todNight*0.7).lerp(C(0xffb27a), golden*0.4);
  skyU.uFog.value.lerp(C(0x2a3348), todNight*0.7);
  // sun direction drops toward the horizon at dawn/dusk
  skyU.uSunDir.value.copy(a.sunDir).lerp(b.sunDir,st).normalize();
  const elev = lerp(0.75, 0.12, Math.min(1,Math.abs(tod-0.5)*2));
  skyU.uSunDir.value.y = elev;
  skyU.uSunDir.value.normalize();
  skyU.uSunColor.value.lerp(C(0xff8a4a), golden*0.7);
  skyU.uNight.value=effectiveNight; skyU.uStarAmt.value=effectiveNight*.95;
  skyU.uCloudAmt.value=.72+effectiveNight*.1; skyU.uTime.value=T;
  skyU.uExposure.value = lerp(1.0, 0.32, effectiveNight);
  hemi.intensity=lerp(.75,.22,effectiveNight) + golden*0.08;
  sun.color.copy(skyU.uSunColor.value);
  sun.intensity=lerp(2.6,.15,effectiveNight) * (1-golden*0.25);
  sun.position.copy(skyU.uSunDir.value).multiplyScalar(18);
  fill.intensity=.18+effectiveNight*.05;
  renderer.toneMappingExposure=lerp(0.72,0.82,effectiveNight)*(1+golden*0.12);
  scene.fog.color.copy(skyU.uFog.value);
  groundU.uNear.value.copy(skyU.uFog.value).lerp(C(0x5f6f5b), 0.55);
  groundU.uFar.value.copy(skyU.uFog.value).lerp(C(0xffffff), 0.25);
  scene.fog.density=lerp(.0026,.0042,blendN('autumn'));

  // sand
  mixC(a.sand,b.sand,st,sandU.uSand.value);
  mixC(a.groove,b.groove,st,sandU.uGroove.value);
  mixC(a.moss,b.moss,st,sandU.uMoss.value);
  sandU.uSnow.value=blendN('snow'); sandU.uAutumn.value=blendN('autumn'); sandU.uTime.value=T;
  sandU.uSand.value.multiplyScalar(lerp(1,0.42,effectiveNight));
  sandU.uGroove.value.multiplyScalar(lerp(1,0.42,effectiveNight));
  sandU.uMoss.value.multiplyScalar(lerp(1,0.42,effectiveNight));
  ridgeGroup.visible = blendN('snow')<.6;

  // water
  mixC(a.waterDeep,b.waterDeep,st,waterU.uDeep.value);
  mixC(a.waterShallow,b.waterShallow,st,waterU.uShallow.value);
  mixC(a.skyWater,b.skyWater,st,waterU.uSky.value);
  waterU.uSunColor.value.copy(sun.color); waterU.uSunDir.value.copy(skyU.uSunDir.value);
  waterU.uSnow.value=blendN('snow'); waterU.uTime.value=T;
  waterU.uRipple.value=Math.max(0,waterU.uRipple.value-dt*.7);

  // leaves
  mixC(a.leafLit,b.leafLit,st,leafU.uLeafLit.value);
  mixC(a.leafShade,b.leafShade,st,leafU.uLeafShade.value);
  mixC(a.leafAccent,b.leafAccent,st,leafU.uLeafAccent.value);
  leafU.uSunColor.value.copy(sun.color); leafU.uSunDir.value.copy(skyU.uSunDir.value);
  leafU.uWind.value=gust; leafU.uTime.value=T;
  leafU.uSnow.value=blendN('snow'); leafU.uAutumn.value=blendN('autumn');
  leafU.uAmbient.value=lerp(1,.55,effectiveNight);
  blossomMat.opacity=blendN('bloom'); blossomMat.transparent=true;
  blossoms.visible=blendN('bloom')>.05;
  blossomMat.emissiveIntensity=blendN('bloom')*.25;

  // particles
  const windDir = new THREE.Vector2(Math.cos(T*.15),Math.sin(T*.15));
  [pPetals,pFireflies,pLeaves,pSnow].forEach(p=>{ p.uniforms.uTime.value=T; p.uniforms.uWindDir.value.copy(windDir); p.uniforms.uWind.value=gust; });
  pPetals.uniforms.uOpacity.value=blendN('petals')*.20;
  // fireflies emerge at dusk/night in every season (plus summer's daytime ones)
  const fireflyAmt = Math.max(blendN('fireflies')*.3, Math.max(golden*0.7, effectiveNight*0.95));
  pFireflies.uniforms.uOpacity.value=fireflyAmt;
  pLeaves.uniforms.uOpacity.value=blendN('leafFall')*.36;
  pSnow.uniforms.uOpacity.value=blendN('snowFall')*.62;

  lanternLight.material.emissiveIntensity=effectiveNight*2.2;
  lanternGlow.intensity=effectiveNight*3.0;

  const koiVisible = blendN('snow')<.5;
  koiGroup.visible=koiVisible;
  koi.forEach(k=>{
    const ang=k.phase+T*k.speed;
    k.mesh.position.set(pondX+Math.cos(ang)*k.radius, .02+Math.sin(T*.8+k.phase)*.006, pondZ+Math.sin(ang)*k.radius);
    k.mesh.rotation.y=-ang+Math.PI/2;
    k.tail.rotation.y=Math.sin(T*5+k.phase)*.35;
  });
  bambooGroup.rotation.z=Math.sin(T*.55)*gust*.012;

  grade.uniforms.uTime.value=T;
  grade.uniforms.uSaturation.value=lerp(1.04,.82,blendN('snow'));
  grade.uniforms.uVignette.value=.85;

  const day = Math.floor(mod1(state.seasonF/4)*365)+1;
  if (seasonEls.name) seasonEls.name.textContent=a.name;
  if (seasonEls.day) seasonEls.day.textContent=`第 ${day} 天`;
  if (seasonEls.marker) seasonEls.marker.style.left=`${(mod1(state.seasonF/4)*100).toFixed(1)}%`;
  frames++; fpsTimer+=dt;
  if (fpsTimer>=.5) { if (seasonEls.fps) seasonEls.fps.textContent=Math.round(frames/fpsTimer); frames=0; fpsTimer=0; }

  composer.render();
}
animate();






