import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

// ---------------------------------------------------------------------------
// Post chain (manual tonemap, full control):
//   render(linear) -> bloom -> FXAA -> final(ACES + sRGB + saturation +
//   vignette + grain + chromatic aberration)
// renderer.toneMapping must be NoToneMapping.
// ---------------------------------------------------------------------------

const FINAL_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.34 },
    uGrain: { value: 0.03 },
    uChroma: { value: 0.0012 },
    uExposure: { value: 0.95 },
    uSaturation: { value: 1.12 },
    uContrast: { value: 1.07 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChroma;
    uniform float uExposure;
    uniform float uSaturation;
    uniform float uContrast;
    varying vec2 vUv;

    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }

    vec3 aces(vec3 x){
      const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
    }
    vec3 linearToSRGB(vec3 c){
      c = clamp(c, 0.0, 1.0);
      return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
    }

    void main(){
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float d = length(center);
      vec2 ca = center * uChroma * d;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - ca).b;

      // exposure + tonemap
      col *= uExposure;
      col = aces(col);
      // saturation
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);
      // contrast
      col = (col - 0.5) * uContrast + 0.5;
      col = clamp(col, 0.0, 1.0);
      // sRGB encode
      col = linearToSRGB(col);

      // vignette
      float vig = smoothstep(0.9, 0.2, d);
      col *= mix(1.0, vig, uVignette);
      // film grain
      float g = hash(uv * uResolution + uTime * 100.0) - 0.5;
      col += g * uGrain;
      col = clamp(col, 0.0, 1.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, { quality = 'high' } = {}) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(size.x, size.y);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    const high = quality === 'high';
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), high ? 0.28 : 0.2, 0.5, 0.9);
    this.bloom.threshold = 0.9;
    this.composer.addPass(this.bloom);

    this.fxaa = new ShaderPass(FXAAShader);
    this.fxaa.uniforms.resolution.value.set(1 / (size.x * pr), 1 / (size.y * pr));
    this.composer.addPass(this.fxaa);

    this.final = new ShaderPass(FINAL_SHADER);
    this.final.uniforms.uResolution.value.set(size.x * pr, size.y * pr);
    if (!high) { this.final.uniforms.uGrain.value = 0.02; this.final.uniforms.uChroma.value = 0.0008; }
    this.final.renderToScreen = true;
    this.composer.addPass(this.final);
  }

  setCamera(cam) { this.renderPass.camera = cam; }
  setScene(s) { this.renderPass.scene = s; }

  setQuality(q) {
    const high = q === 'high';
    this.bloom.strength = high ? 0.28 : 0.2;
    this.final.uniforms.uGrain.value = high ? 0.03 : 0.02;
  }

  setExposure(e) { this.final.uniforms.uExposure.value = e; }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.composer.setSize(w, h);
    this.fxaa.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    this.final.uniforms.uResolution.value.set(w * pr, h * pr);
    this.bloom.setSize(w, h);
  }

  render(dt) { this.final.uniforms.uTime.value += dt; this.composer.render(); }
}
