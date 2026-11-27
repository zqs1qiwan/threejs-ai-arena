// Procedural noise library (GLSL). Pure code, no textures.
export const NOISE_GLSL = /* glsl */ `
#ifndef NOISE_GLSL
#define NOISE_GLSL

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3  hash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }

// value noise
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i); float b = hash12(i+vec2(1.0,0.0));
  float c = hash12(i+vec2(0.0,1.0)); float d = hash12(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  float n000 = hash13(i);
  float n100 = hash13(i+vec3(1.0,0.0,0.0));
  float n010 = hash13(i+vec3(0.0,1.0,0.0));
  float n110 = hash13(i+vec3(1.0,1.0,0.0));
  float n001 = hash13(i+vec3(0.0,0.0,1.0));
  float n101 = hash13(i+vec3(1.0,0.0,1.0));
  float n011 = hash13(i+vec3(0.0,1.0,1.0));
  float n111 = hash13(i+vec3(1.0,1.0,1.0));
  return mix(
    mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y),
    mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y), u.z);
}

// gradient (perlin-style) noise 2D
vec2 grad2(vec2 i){
  float a = hash12(i) * 6.2831853;
  return vec2(cos(a), sin(a));
}
float pnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(grad2(i), f);
  float b = dot(grad2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0));
  float c = dot(grad2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0));
  float d = dot(grad2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y) * 0.5 + 0.5;
}

// fractal brownian motion
float fbm(vec2 p, int octaves){
  float v = 0.0; float amp = 0.5; float freq = 1.0; float norm = 0.0;
  for(int i=0;i<8;i++){
    if(i>=octaves) break;
    v += amp * vnoise(p*freq);
    norm += amp; amp *= 0.5; freq *= 2.0;
  }
  return v / max(norm, 1e-4);
}
float fbm(vec3 p, int octaves){
  float v = 0.0; float amp = 0.5; float freq = 1.0; float norm = 0.0;
  for(int i=0;i<8;i++){
    if(i>=octaves) break;
    v += amp * vnoise(p*freq);
    norm += amp; amp *= 0.5; freq *= 2.0;
  }
  return v / max(norm, 1e-4);
}

// worley / cellular noise (returns distance to closest feature point)
float worley(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float minD = 1.0;
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      vec2 r = g + o - f;
      minD = min(minD, dot(r,r));
    }
  }
  return sqrt(minD);
}

// ridged multifractal
float ridged(vec2 p, int octaves){
  float v = 0.0; float amp = 0.5; float freq = 1.0; float norm = 0.0;
  for(int i=0;i<8;i++){
    if(i>=octaves) break;
    float n = 1.0 - abs(vnoise(p*freq)*2.0 - 1.0);
    v += amp * n * n;
    norm += amp; amp *= 0.5; freq *= 2.0;
  }
  return v / max(norm, 1e-4);
}

#endif
`;
