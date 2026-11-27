import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SeasonClock } from '../core/SeasonClock.js';
import { SEASON_NAMES, SEASON_NAMES_EN } from '../core/seasons.js';
import { Wind } from './wind.js';
import { Sky } from './Sky.js';
import { Ground } from './Ground.js';
import { Bonsai } from './Bonsai.js';
import { Pot } from './Pot.js';
import { FallingParticles, Fireflies } from './Particles.js';
import { createPetalGeometry, createMapleLeafGeometry } from './leaf.js';
import { addContactShadow } from './ContactShadow.js';
import { PostFX } from '../fx/PostFX.js';

// ---------------------------------------------------------------------------
// App: renderer, scene, lighting, seasons, interaction, loop.
// ---------------------------------------------------------------------------

function isMobile() {
  if (typeof navigator === 'undefined') return false;
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  const small = Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 820;
  return coarse && small;
}

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobile = isMobile();
    this.quality = this.mobile ? 'low' : 'high';
    this.clock = new THREE.Timer();
    this.time = 0;
    this.potBounce = 0;
    this.treeShake = 0;
    this._listeners = {};

    this.initRenderer();
    this.initScene();
    this.initLights();
    this.initWorld();
    this.initParticles();
    this.initControls();
    this.initPost();
    this.applySeason(true);
    this.bindEvents();
    this.setSize();
  }

  on(ev, fn) { (this._listeners[ev] ||= []).push(fn); }
  emit(ev, data) { for (const fn of this._listeners[ev] || []) fn(data); }

  initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: !this.mobile, alpha: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x0b1020, 1);
    this.renderer = renderer;
    this.maxPixelRatio = this.mobile ? 1.5 : 2;
  }

  initScene() {
    this.scene = new THREE.Scene();
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.05, 800);
    this.camera.position.set(6.0, 3.2, 8.4);
    this.camTarget = new THREE.Vector3(0, 2.1, 0);
  }

  initLights() {
    // hemisphere ambient
    this.hemi = new THREE.HemisphereLight(new THREE.Color(0.7, 0.8, 0.95), new THREE.Color(0.3, 0.32, 0.28), 0.5);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.ambient);

    // sun
    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.castShadow = true;
    const sh = this.mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sh, sh);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 60;
    const s = this.mobile ? 5 : 6.5;
    this.sun.shadow.camera.left = -s; this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s; this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.sunTarget = new THREE.Object3D();
    this.sunTarget.position.set(0, 1.4, 0);
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun);

    // soft fill from opposite side
    this.fill = new THREE.DirectionalLight(0xbcd0ff, 0.35);
    this.fill.position.set(-5, 4, -4);
    this.scene.add(this.fill);
    // rim
    this.rim = new THREE.DirectionalLight(0xfff0d8, 0.25);
    this.rim.position.set(-3, 5, -6);
    this.scene.add(this.rim);

    this.scene.fog = new THREE.FogExp2(0xcccccc, 0.01);
  }

  initWorld() {
    this.sky = new Sky(this.scene);
    this.ground = new Ground(this.scene, { size: 80, segments: this.mobile ? 80 : 140 });
    this.pot = new Pot(this.scene, {});
    this.bonsai = new Bonsai(this.scene, { seed: 2024, height: 3.1, perAnchor: this.mobile ? 12 : 22 });
    // pot group at origin on ground
    this.pot.group.position.set(0, 0, 0);
    this.bonsai.group.position.set(0, this.pot.soilY + 0.02, 0);
    this.bonsai.group.scale.setScalar(0.85);
    // procedural contact shadows: under pot/saucer + tree base
    this.contactPot = addContactShadow(this.scene, { radius: 2.4, opacity: 0.5, y: 0.005 });
    this.contactTree = addContactShadow(this.scene, { radius: 1.5, opacity: 0.30, y: this.pot.soilY + 0.03 });
  }

  initParticles() {
    const box = this.mobile ? 12 : 16;
    // spring petals
    this.petals = new FallingParticles(this.scene, {
      count: this.mobile ? 90 : 150, boxSize: 9, boxTop: 5.5,
      fallSpeed: 0.5, sway: 0.5, sizeMin: 0.09, sizeMax: 0.16, tumble: 1.4,
      color: 0xffc6d9, color2: 0xfff0f4, opacity: 0.72, seed: 11, geometry: createPetalGeometry(),
    });
    // autumn leaves
    this.fallingLeaves = new FallingParticles(this.scene, {
      count: this.mobile ? 110 : 200, boxSize: 9, boxTop: 5.5,
      fallSpeed: 0.42, sway: 0.55, sizeMin: 0.16, sizeMax: 0.30, tumble: 1.1,
      color: 0xd96a2b, color2: 0xc23a1e, opacity: 0.95, seed: 23, geometry: createMapleLeafGeometry({ size: 0.5 }),
    });
    // snow
    this.snow = new FallingParticles(this.scene, {
      count: this.mobile ? 400 : 800, boxSize: box, boxTop: 7,
      fallSpeed: 0.9, sway: 0.25, sizeMin: 0.05, sizeMax: 0.12, tumble: 0.4,
      color: 0xffffff, color2: 0xf0f4ff, opacity: 0.9, seed: 37, geometry: new THREE.CircleGeometry(0.5, 6),
    });
    this.fireflies = new Fireflies(this.scene, this.mobile ? 60 : 140, 7);
  }

  initControls() {
    const c = new OrbitControls(this.camera, this.canvas);
    c.target.set(0, 1.8, 0);
    c.enableDamping = true; c.dampingFactor = 0.07;
    c.minDistance = 2.2; c.maxDistance = 22;
    c.minPolarAngle = 0.25; c.maxPolarAngle = Math.PI * 0.495;
    c.autoRotate = !this.mobile; c.autoRotateSpeed = 0.18;
    c.enablePan = false;
    c.zoomSpeed = this.mobile ? 0.8 : 1.0;
    c.rotateSpeed = this.mobile ? 0.6 : 0.9;
    // touch
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls = c;
    c.update();
  }

  initPost() {
    this.post = new PostFX(this.renderer, this.scene, this.camera, { quality: this.quality });
  }

  setQuality(q) {
    this.quality = q;
    this.post.setQuality(q);
  }

  // ---- seasonal apply ----
  applySeason(force = false) {
    const p = this.seasonClock ? this.seasonClock.current : null;
    if (!p) return;
    this.currentPalette = p;

    // sky + sun
    const sunDir = this.computeSunDir(p);
    const moonDir = new THREE.Vector3(-sunDir.x, Math.abs(sunDir.y) * 0.4 + 0.3, -sunDir.z).normalize();
    this.sky.setSeason(p, sunDir, moonDir);

    // fog
    this.scene.fog.color.copy(p.fogColor);
    this.scene.fog.density = p.fogDensity * 0.32;

    // lights
    const night = Math.max(p.nightFactor, sunDir.y < -0.02 ? 0.6 : 0.0);
    this.sun.color.copy(p.sunColor);
    this.sun.intensity = p.sunIntensity * (1.0 - night * 0.8);
    this.sun.position.copy(sunDir).multiplyScalar(30).add(this.sunTarget.position);
    this.hemi.color.copy(p.ambientSky);
    this.hemi.groundColor.copy(p.ambientGround);
    this.hemi.intensity = p.ambientIntensity * 0.85;
    this.ambient.intensity = 0.14 + night * 0.12;
    this.fill.intensity = 0.24 * (1.0 - night * 0.5);
    this.rim.intensity = 0.25;
    if (this.post) this.post.setExposure(0.95 - night * 0.25);

    // world
    this.ground.setSeason(p);
    this.pot.setSeason(p);
    this.bonsai.setSeason(p);

    // particles
    const snowAmt = p.snowAmount * p.snowfall;
    this.petals.setVisible(p.petalsFalling > 0.02);
    this.petals.setCountFraction(p.petalsFalling);
    this.petals.setColor(p.petalColor, p.petalColor2);
    this.fallingLeaves.setVisible(p.fallingLeaves > 0.02);
    this.fallingLeaves.setCountFraction(p.fallingLeaves);
    this.fallingLeaves.setColor(p.leafColor, p.leafColor3);
    this.snow.setVisible(snowAmt > 0.02);
    this.snow.setCountFraction(Math.max(0.2, snowAmt));
    this.fireflies.setOpacity(p.fireflies * 0.9);

    // wind
    this._windBase = p.windBase;
  }

  computeSunDir(p) {
    // slow orbit for moving shadows; elevation from season
    const elev = THREE.MathUtils.degToRad(p.sunElevation);
    const azBase = THREE.MathUtils.degToRad(p.sunAzimuth);
    const orbit = this.time * 0.02; // slow
    const az = azBase + orbit;
    const y = Math.sin(elev);
    const r = Math.cos(elev);
    return new THREE.Vector3(Math.sin(az) * r, y, Math.cos(az) * r).normalize();
  }

  // ---- events ----
  bindEvents() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._down = null;

    const onDown = (e) => { this._down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e) => {
      if (!this._down) return;
      const dx = e.clientX - this._down.x, dy = e.clientY - this._down.y;
      const dt = performance.now() - this._down.t;
      this._down = null;
      if (Math.hypot(dx, dy) > 6 || dt > 400) return; // it was a drag
      this.handleTap(e.clientX, e.clientY);
    };
    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointerup', onUp);

    window.addEventListener('resize', this._onResize = () => this.setSize());
    // keyboard shortcuts
    window.addEventListener('keydown', this._onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === ' ') { e.preventDefault(); this.seasonClock.togglePlaying(); }
      else if (e.key === '1') this.seasonClock.goToSeason(0);
      else if (e.key === '2') this.seasonClock.goToSeason(1);
      else if (e.key === '3') this.seasonClock.goToSeason(2);
      else if (e.key === '4') this.seasonClock.goToSeason(3);
      else if (e.key.toLowerCase() === 'r') this.resetCamera();
      else if (e.key.toLowerCase() === 'a') { this.controls.autoRotate = !this.controls.autoRotate; }
    });
  }

  handleTap(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.bonsai.group, true);
    if (hits.length) {
      Wind.burst(1.1);
      this.treeShake = 1.0;
      this.emit('treeTap', hits[0].point);
    } else {
      const potHits = this.raycaster.intersectObject(this.pot.group, true);
      if (potHits.length) { this.potBounce = 1.0; this.emit('potTap'); }
    }
  }

  resetCamera() {
    this.camera.position.set(6.0, 3.2, 8.4);
    this.controls.target.set(0, 1.8, 0);
    this.controls.update();
  }

  setSize() {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    // responsive re-evaluation of mobile/quality tier
    const nowMobile = isMobile();
    if (nowMobile !== this.mobile) {
      this.mobile = nowMobile;
      this.maxPixelRatio = this.mobile ? 1.5 : 2;
      this.quality = this.mobile ? 'low' : this.quality;
      if (this.post) this.post.setQuality(this.quality);
      if (this.controls) { this.controls.rotateSpeed = this.mobile ? 0.6 : 0.9; this.controls.zoomSpeed = this.mobile ? 0.8 : 1.0; }
    }
    const pr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize(w, h);
  }

  // ---- loop ----
  start() {
    this.seasonClock = new SeasonClock();
    this.seasonClock.duration = this.mobile ? 26 : 24;
    this.applySeason(true);
    this.clock.update();
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      this.clock.update();
      const dt = Math.min(0.05, this.clock.getDelta() || 0.016);
      this.time += dt;
      this.frame(dt);
    };
    this._raf = requestAnimationFrame(tick);
  }

  frame(dt) {
    this.seasonClock.update(dt);
    Wind.update(dt, this._windBase ?? 0.5);
    this.applySeason();

    // pot bounce + tree shake
    this.potBounce = Math.max(0, this.potBounce - dt * 3);
    this.treeShake = Math.max(0, this.treeShake - dt * 2.2);
    const b = this.potBounce;
    this.pot.group.scale.set(1 + 0.03 * Math.sin(b * Math.PI * 3) * b, 1 - 0.05 * Math.sin(b * Math.PI * 2) * b, 1 + 0.03 * Math.sin(b * Math.PI * 3) * b);
    this.bonsai.group.rotation.z = Math.sin(this.time * 22) * 0.02 * this.treeShake;

    // particles
    this.petals.update(dt);
    this.fallingLeaves.update(dt);
    this.snow.update(dt);
    this.fireflies.update(dt);
    this.sky.update(dt);

    this.controls.update();
    this.post.render(dt);

    // expose info for probe
    window.appInfo = {
      season: this.seasonClock.index,
      seasonName: SEASON_NAMES[this.seasonClock.index],
      seasonNameEn: SEASON_NAMES_EN[this.seasonClock.index],
      phase: +this.seasonClock.phase.toFixed(3),
      speed: this.seasonClock.speed,
      playing: this.seasonClock.playing,
      fps: this._fps,
      leafCount: this.bonsai.leafCount,
      camera: [this.camera.position.x, this.camera.position.y, this.camera.position.z].map((v) => +v.toFixed(2)),
      quality: this.quality,
      mobile: this.mobile,
    };
    // fps
    this._frames = (this._frames || 0) + 1;
    const now = performance.now();
    if (!this._fpsT) this._fpsT = now;
    if (now - this._fpsT >= 500) { this._fps = Math.round(this._frames * 1000 / (now - this._fpsT)); this._frames = 0; this._fpsT = now; }
  }
}
