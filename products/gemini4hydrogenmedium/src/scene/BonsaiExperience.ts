import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { createProceduralTextures } from '../utils/proceduralTextures';
import { createSkyDome } from '../shaders/skyShader';
import { SnowUniformRef } from '../shaders/snowMaterial';
import {
  computeSeasonWeights,
  LightingMood,
  sampleSeasonPalette,
  SeasonPalette,
} from '../utils/seasonState';
import { createBonsaiTree } from './bonsaiTree';
import { createBonsaiLandscape } from './bonsaiLandscape';
import { createSeasonalParticles } from './seasonalParticles';

export type CameraPresetKey = 'overview' | 'canopy' | 'lantern' | 'roots' | 'zen';

interface CameraPreset {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

const CAMERA_PRESETS: Record<CameraPresetKey, CameraPreset> = {
  overview: {
    pos: new THREE.Vector3(3.1, 1.82, 3.62),
    target: new THREE.Vector3(0.02, 0.86, 0.0),
  },
  canopy: {
    pos: new THREE.Vector3(1.22, 1.52, 1.65),
    target: new THREE.Vector3(0.05, 1.25, 0.0),
  },
  lantern: {
    pos: new THREE.Vector3(1.42, 0.85, 0.95),
    target: new THREE.Vector3(0.55, 0.54, -0.18),
  },
  roots: {
    pos: new THREE.Vector3(0.68, 0.72, 1.25),
    target: new THREE.Vector3(-0.26, 0.56, -0.04),
  },
  zen: {
    pos: new THREE.Vector3(0.05, 3.15, 1.25),
    target: new THREE.Vector3(0.05, 0.52, 0.0),
  },
};

export interface ExperienceCallbacks {
  onSeasonUpdate?: (season: number, palette: SeasonPalette) => void;
}

export class BonsaiExperience {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;

  private sunLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skyDome: ReturnType<typeof createSkyDome>;

  private snowUniform: SnowUniformRef = { uSnowAmount: { value: 0 } };
  private tree: ReturnType<typeof createBonsaiTree>;
  private landscape: ReturnType<typeof createBonsaiLandscape>;
  private particles: ReturnType<typeof createSeasonalParticles>;

  private raycaster = new THREE.Raycaster();
  private pointerDownPos = new THREE.Vector2();

  private season = 0.15; // Start in Spring
  private targetSeason: number | null = null;
  private autoPlay = true;
  private windStrength = 0.45;
  private gustBurst = 0;
  private mood: LightingMood = 'day';

  private camTween: {
    active: boolean;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
    progress: number;
  } = {
    active: false,
    startPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
  };

  private clock = new THREE.Clock();
  private elapsed = 0;
  private animId = 0;
  private callbacks: ExperienceCallbacks;

  constructor(canvas: HTMLCanvasElement, callbacks: ExperienceCallbacks = {}) {
    this.callbacks = callbacks;

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    // 2. Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#cfd8e0', 0.042);

    // 3. Camera & OrbitControls
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 120);
    // Slightly pull back on narrow mobile portrait screens so full bonsai fits comfortably
    const initialDistScale = aspect < 0.8 ? 1.38 : 1.0;
    this.camera.position.copy(CAMERA_PRESETS.overview.pos).multiplyScalar(initialDistScale);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(CAMERA_PRESETS.overview.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 0.95;
    this.controls.maxDistance = 6.2;
    this.controls.maxPolarAngle = Math.PI * 0.485; // Prevent dipping below plinth
    this.controls.minPolarAngle = 0.15;
    this.controls.enablePan = false;
    this.controls.update();

    // 4. Procedural PMREM Environment Map (Zero external HDRI!)
    this.buildProceduralEnvironment();

    // 5. Sky & Lighting
    this.skyDome = createSkyDome();
    this.scene.add(this.skyDome.mesh);

    this.hemiLight = new THREE.HemisphereLight('#d6e6f5', '#3d342d', 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff2df', 2.4);
    this.sunLight.position.set(3.2, 4.4, 2.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 14;
    const d = 2.2;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.015;
    this.scene.add(this.sunLight);

    // Subtle cool rim/fill light for sculptural silhouette
    this.fillLight = new THREE.DirectionalLight('#9ec4e8', 0.65);
    this.fillLight.position.set(-3.0, 2.2, -2.5);
    this.scene.add(this.fillLight);

    // 6. Procedural Textures, Landscape, Hero Bonsai & Particles
    const textures = createProceduralTextures();
    this.landscape = createBonsaiLandscape(textures, this.snowUniform);
    this.scene.add(this.landscape.group);

    this.tree = createBonsaiTree(textures, this.snowUniform);
    this.scene.add(this.tree.group);

    this.particles = createSeasonalParticles(textures, this.tree.foliagePositions);
    this.scene.add(this.particles.group);

    // 7. Post-Processing (RenderPass + Subtle Bloom + ACES OutputPass)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.22, // subtle, never blown out
      0.5,
      1.15
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // 8. Events
    window.addEventListener('resize', this.handleResize);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);

    this.animate();
  }

  private buildProceduralEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(10, 24, 16);
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vec3 d = normalize(vPos);
          vec3 sky = mix(vec3(0.42, 0.48, 0.56), vec3(0.85, 0.88, 0.92), clamp(d.y * 0.5 + 0.5, 0.0, 1.0));
          // Soft studio softbox highlights for ceramic & water reflections
          float box1 = smoothstep(0.65, 0.95, dot(d, normalize(vec3(0.6, 0.7, 0.4))));
          float box2 = smoothstep(0.7, 0.95, dot(d, normalize(vec3(-0.7, 0.4, -0.5))));
          sky += vec3(1.0, 0.95, 0.88) * box1 * 1.1;
          sky += vec3(0.65, 0.8, 1.0) * box2 * 0.65;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));

    const rt = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.78;

    envGeo.dispose();
    envMat.dispose();
    pmrem.dispose();
  }

  private handleResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos.set(e.clientX, e.clientY);
  };

  private handlePointerUp = (e: PointerEvent) => {
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist > 6) return; // Ignore orbit drags

    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    // Check pond click -> water ripple
    const waterHits = this.raycaster.intersectObject(this.landscape.waterMesh, false);
    if (waterHits.length > 0) {
      const pt = waterHits[0].point;
      this.landscape.waterUniforms.uRippleOrigin.value.set(pt.x, pt.z);
      this.landscape.waterUniforms.uRippleTime.value = this.elapsed;
      return;
    }

    // Check lantern click -> toggle light
    const lanternHits = this.raycaster.intersectObject(this.landscape.lanternGroup, true);
    if (lanternHits.length > 0) {
      this.landscape.setLanternLit(!this.landscape.isLanternLit());
      return;
    }

    // Check bonsai tree click -> gust of wind + petals
    const treeHits = this.raycaster.intersectObject(this.tree.group, true);
    if (treeHits.length > 0) {
      this.triggerGust();
    }
  };

  public setSeason(s: number, smooth = true) {
    if (smooth) {
      this.targetSeason = ((s % 4) + 4) % 4;
    } else {
      this.season = ((s % 4) + 4) % 4;
      this.targetSeason = null;
    }
  }

  public getSeason(): number {
    return this.season;
  }

  public setAutoPlay(playing: boolean) {
    this.autoPlay = playing;
  }

  public setWind(w: number) {
    this.windStrength = w;
  }

  public setMood(m: LightingMood) {
    this.mood = m;
  }

  public triggerGust() {
    this.gustBurst = 1.0;
    const weights = computeSeasonWeights(this.season);
    this.particles.triggerGust(weights);
  }

  public setCameraPreset(key: CameraPresetKey) {
    const preset = CAMERA_PRESETS[key];
    const aspect = window.innerWidth / window.innerHeight;
    const scale = key === 'overview' && aspect < 0.8 ? 1.38 : 1.0;

    this.camTween.startPos.copy(this.camera.position);
    this.camTween.startTarget.copy(this.controls.target);
    this.camTween.endPos.copy(preset.pos).multiplyScalar(scale);
    this.camTween.endTarget.copy(preset.target);
    this.camTween.progress = 0;
    this.camTween.active = true;
  }

  private animate = () => {
    this.animId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    // 1. Season progression
    if (this.targetSeason !== null) {
      let diff = this.targetSeason - this.season;
      if (diff > 2) diff -= 4;
      if (diff < -2) diff += 4;
      this.season = (this.season + diff * Math.min(1, dt * 4.5) + 4) % 4;
      if (Math.abs(diff) < 0.004) {
        this.season = this.targetSeason;
        this.targetSeason = null;
      }
    } else if (this.autoPlay) {
      this.season = (this.season + dt * 0.085) % 4;
    }

    // Decay gust burst
    this.gustBurst = Math.max(0, this.gustBurst - dt * 0.85);

    // 2. Camera tween
    if (this.camTween.active) {
      this.camTween.progress = Math.min(1, this.camTween.progress + dt * 1.8);
      const t = this.camTween.progress;
      const ease = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(this.camTween.startPos, this.camTween.endPos, ease);
      this.controls.target.lerpVectors(this.camTween.startTarget, this.camTween.endTarget, ease);
      if (t >= 1) this.camTween.active = false;
    }
    this.controls.update();

    // 3. Seasonal Palette & Weights
    const weights = computeSeasonWeights(this.season);
    const palette = sampleSeasonPalette(this.season, this.mood);
    this.snowUniform.uSnowAmount.value = weights.snowAmount;

    const isNight = this.mood === 'night';
    const isGolden = this.mood === 'golden';

    // Update Sky & Fog
    this.skyDome.uniforms.uTopColor.value.copy(palette.skyTop);
    this.skyDome.uniforms.uHorizonColor.value.copy(palette.skyHorizon);
    this.skyDome.uniforms.uSunColor.value.copy(palette.sunColor);
    this.skyDome.uniforms.uTime.value = this.elapsed;
    this.skyDome.uniforms.uNightFactor.value = isNight ? 1.0 : 0.0;

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(palette.fogColor);
    }

    // Update Lights
    this.sunLight.color.copy(palette.sunColor);
    this.hemiLight.color.copy(palette.ambientColor);
    if (isNight) {
      this.sunLight.intensity = 0.72;
      this.sunLight.position.set(-2.5, 4.2, -2.0);
      this.hemiLight.intensity = 0.42;
      this.bloomPass.strength = 0.42;
      this.scene.environmentIntensity = 0.35;
    } else if (isGolden) {
      this.sunLight.intensity = 2.6;
      this.sunLight.position.set(4.2, 2.2, 2.4);
      this.hemiLight.intensity = 0.65;
      this.bloomPass.strength = 0.3;
      this.scene.environmentIntensity = 0.75;
    } else {
      this.sunLight.intensity = 2.35 - weights.winter * 0.45;
      this.sunLight.position.set(3.2, 4.4, 2.6);
      this.hemiLight.intensity = 0.78;
      this.bloomPass.strength = 0.24;
      this.scene.environmentIntensity = 0.78;
    }
    this.skyDome.uniforms.uSunDir.value.copy(this.sunLight.position).normalize();
    this.landscape.waterUniforms.uSunDir.value.copy(this.sunLight.position).normalize();

    // 4. Update Tree, Landscape & Particles
    this.tree.update(this.elapsed, this.windStrength, this.gustBurst, weights, palette);
    this.landscape.update(this.elapsed, weights, palette, isNight);
    this.particles.update(dt, this.elapsed, this.windStrength, this.gustBurst, weights, isNight);

    // 5. Notify UI
    this.callbacks.onSeasonUpdate?.(this.season, palette);

    // 6. Render
    this.composer.render();
  };

  public dispose() {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
