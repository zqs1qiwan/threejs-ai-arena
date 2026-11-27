import * as THREE from 'three';

// Global wind state shared across all wind-reactive materials.
export const Wind = {
  strength: 0.5,             // 0..1 base
  gust: 0,                   // transient gust 0..1
  direction: new THREE.Vector2(0.8, 0.6).normalize(),
  time: 0,
  // uniforms shared by reference with shaders
  uniforms: {
    uWindTime: { value: 0 },
    uWindStrength: { value: 0.5 },
    uWindDir: { value: new THREE.Vector2(0.8, 0.6) },
  },
  update(dt, base = 0.5) {
    this.time += dt;
    // gentle sinusoidal gusting + decay of triggered gust
    this.gust = Math.max(0, this.gust - dt * 0.8);
    const breeze = base * (0.7 + 0.3 * Math.sin(this.time * 0.37) + 0.15 * Math.sin(this.time * 1.13 + 1.7));
    this.strength = breeze + this.gust;
    const u = this.uniforms;
    u.uWindTime.value = this.time;
    u.uWindStrength.value = this.strength;
    u.uWindDir.value.copy(this.direction);
  },
  burst(amount = 1.0) { this.gust = Math.min(1.5, this.gust + amount); },
};
