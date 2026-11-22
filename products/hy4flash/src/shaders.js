// GLSL for ZEN SHIKI — a procedural four-season zen garden.
// Every effect is code-generated: no external images, models or HDRIs.

export const NOISE = /* glsl */ `
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float vnoise2(vec2 x){
  vec2 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm2(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*vnoise2(p); p=p*2.03+vec2(19.1,7.7); a*=.5; } return v; }
float fbm3(vec3 p){ return fbm2(p.xy+p.z*0.71)+0.5*fbm2(p.yz-p.x*0.53); }
`;

// ---------------------------------------------------------------- visible sky
export const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;
export const skyFrag = /* glsl */ `
uniform vec3 uZenith,uHorizon,uNadir,uSunColor,uMoonColor,uCloudColor,uSunDir,uFog;
uniform float uTime,uNight,uCloudAmt,uStarAmt,uExposure;
varying vec3 vDir;
${NOISE}
void main(){
  vec3 d=normalize(vDir);
  float up=d.y;
  vec3 col=mix(uHorizon,uZenith,pow(clamp(up,0.,1.),0.42));
  col=mix(uNadir,col,smoothstep(-0.25,0.02,up));

  // stars (night only)
  if(uStarAmt>0.001 && up>-0.02){
    vec2 sp=d.xz/(abs(d.y)+0.3);
    float st=hash21(floor(sp*150.));
    float tw=0.6+0.4*sin(uTime*2.0+st*90.);
    col+=vec3(0.9,0.94,1.0)*smoothstep(0.992,0.9994,st)*tw*uStarAmt*2.2*smoothstep(-0.02,0.25,up);
  }

  vec3 sd=normalize(uSunDir);
  float sdv=max(dot(d,sd),0.);
  float disc=smoothstep(0.9984,0.9996,sdv);
  float halo=pow(sdv,24.)*0.5+pow(sdv,5.)*0.14;
  col+=uSunColor*(disc*2.2+halo)*(1.0-uNight*0.8);

  // moon
  vec3 md=normalize(vec3(-sd.x*0.6,0.72,-sd.z*0.6));
  float mdv=max(dot(d,md),0.);
  col+=uMoonColor*(smoothstep(0.998,0.9995,mdv)*1.4+pow(mdv,30.)*0.4)*uNight;

  // ---- layered volumetric-style clouds ----
  vec2 cuv = d.xz / max(0.14, abs(up)+0.26);
  // low, soft cumulus bank near the horizon
  float low = fbm2(cuv*1.15 + vec2(uTime*0.004,uTime*0.002));
  low += 0.5*fbm2(cuv*2.6 - vec2(uTime*0.006,0.0));
  float lowMask = smoothstep(0.52,0.78,low)
    * smoothstep(-0.03,0.12,up) * (1.0-smoothstep(0.36,0.72,up));
  // high, thin wispy cirrus stretched across the sky
  vec2 wuv = vec2(atan(d.z,d.x)*2.2, up*6.0);
  float cirrus = fbm2(wuv*1.6 + vec2(uTime*0.003,0.0));
  cirrus = smoothstep(0.58,0.82,cirrus) * smoothstep(0.05,0.3,up) * (1.0-smoothstep(0.75,1.0,up));
  col = mix(col, uCloudColor, lowMask*uCloudAmt);
  col = mix(col, uCloudColor*1.06, cirrus*uCloudAmt*0.5);
  // warm sun-side horizon glow with subtle cool counter-light
  float sunSide = max(dot(normalize(d.xz), normalize(uSunDir.xz)), 0.0);
  col += uSunColor * pow(sunSide,3.0) * (1.0-smoothstep(0.0,0.4,up)) * 0.16 * (1.0-uNight);
  gl_FragColor=vec4(col*uExposure,1.0);
}
`;

// ---------------------------------------------------------------- HDR environment for IBL
export const envVert = /* glsl */ `
varying vec3 vDir;
void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;
export const envFrag = /* glsl */ `
uniform vec3 uZenith,uHorizon,uNadir,uGroundColor,uSunColor,uSunDir;
varying vec3 vDir;
void main(){
  vec3 d=normalize(vDir); float up=d.y;
  vec3 c=mix(uHorizon,uZenith,pow(clamp(up,0.,1.),0.4));
  c=mix(uGroundColor,c,smoothstep(-0.18,0.03,up));
  c=mix(c,uNadir,smoothstep(-0.05,-0.7,up));
  float sd=max(dot(d,normalize(uSunDir)),0.);
  c+=uSunColor*(smoothstep(0.9982,0.9996,sd)*16.0 + pow(sd,32.)*0.9 + pow(sd,6.)*0.25);
  gl_FragColor=vec4(c,1.0);
}
`;

// ---------------------------------------------------------------- raked sand (injected into PBR material)
export const sandInject = /* glsl */ `
uniform vec3 uSand,uGroove,uMoss,uSnowColor,uLeafLitter;
uniform vec3 uRocks[8]; uniform int uRockCount; uniform vec2 uTree;
uniform float uSnow,uAutumn,uTime,uRakeFreq;
varying vec3 vSandWorld;
${NOISE}
vec3 sandColor(vec2 p){
  float r=length(p);
  float grain=vnoise2(p*52.)*0.5+vnoise2(p*140.)*0.3+vnoise2(p*320.)*0.2;
  vec3 col=uSand*(0.88+grain*0.24);
  float td=distance(p,uTree);
  float groove=0.,wsum=0.;
  for(int i=0;i<9;i++){
    vec3 rk; float d;
    if(i==8){ rk=vec3(uTree,1.0); d=td; }
    else { if(i>=uRockCount) break; rk=uRocks[i]; d=distance(p,rk.xy); }
    float infl=1.0-smoothstep(rk.z*0.7,rk.z*4.6,d);
    groove+=sin(d*uRakeFreq*2.1-0.6)*infl; wsum+=infl;
  }
  // irregular rake spacing: warp the phase with layered noise so lines aren't perfectly periodic
  float warp = vnoise2(p*0.9)*1.6 + vnoise2(p*2.3)*0.5;
  float field = sin(p.y*uRakeFreq + warp + sin(p.x*0.7)*0.55);
  float g=mix(field,groove/max(wsum,0.0001),clamp(wsum*1.35,0.,1.));
  float dark=smoothstep(0.22,-0.72,g), ridge=smoothstep(0.24,0.86,g);
  col=mix(col,uGroove,dark*0.78);
  col+=uSand*ridge*0.22;
  // fine stochastic grain over the whole sand to kill banding/moire
  float micro = vnoise2(p*90.0+vec2(13.7,7.1))-0.5;
  col *= 1.0 + micro*0.055;
  // moss around tree and rocks
  float moss=1.0-smoothstep(0.8,1.7,td+vnoise2(p*2.2)*0.4);
  for(int i=0;i<8;i++){ if(i>=uRockCount) break; vec3 rk=uRocks[i];
    moss=max(moss,(1.0-smoothstep(rk.z*0.75,rk.z*1.5,distance(p,rk.xy)))*0.68); }
  col=mix(col,uMoss*(0.8+grain*0.4),moss*0.82);
  // autumn leaf litter
  float litter=smoothstep(0.76,0.93,vnoise2(p*3.3+vec2(4.7)))*(1.0-moss);
  col=mix(col,uLeafLitter*(0.75+grain*0.5),litter*uAutumn*0.85);
  // contact occlusion: rocks, tree canopy and trunk base → props sit in the sand
  float contact=0.0;
  for(int i=0;i<8;i++){ if(i>=uRockCount) break; vec3 rk=uRocks[i];
    float cd=distance(p,rk.xy);
    contact=max(contact,1.0-smoothstep(rk.z*0.8,rk.z*2.1,cd));
  }
  // broad, soft shadow cast under the tree canopy + tighter trunk contact
  contact=max(contact,(1.0-smoothstep(0.6,2.4,td))*0.62);
  col*=1.0-contact*0.42;
  // snow blanket with faint grooves showing through
  float snowM=smoothstep(0.32,0.74,vnoise2(p*2.5));
  col=mix(col,uSnowColor*(0.9+grain*0.12),uSnow*(0.58+snowM*0.4));
  col*=1.0-(1.0-smoothstep(0.5,2.6,td))*0.10;
  col*=smoothstep(6.25,5.2,r)*0.88+0.12;
  return col;
}
// groove height field (for normal relief) — same waveform used for colour
float sandRelief(vec2 p){
  float warp = vnoise2(p*0.9)*1.6 + vnoise2(p*2.3)*0.5;
  float field = sin(p.y*uRakeFreq + warp + sin(p.x*0.7)*0.55);
  float td=distance(p,uTree);
  float groove=0.,wsum=0.;
  for(int i=0;i<9;i++){
    vec3 rk; float d;
    if(i==8){ rk=vec3(uTree,1.0); d=td; }
    else { if(i>=uRockCount) break; rk=uRocks[i]; d=distance(p,rk.xy); }
    float infl=1.0-smoothstep(rk.z*0.7,rk.z*4.6,d);
    groove+=sin(d*uRakeFreq*2.1-0.6)*infl; wsum+=infl;
  }
  return mix(field,groove/max(wsum,0.0001),clamp(wsum*1.35,0.,1.));
}
`;

// ---------------------------------------------------------------- water with env reflection
export const waterVert = /* glsl */ `
uniform float uTime;
varying vec2 vUv; varying vec3 vWorld;
void main(){
  vUv=uv;
  vec4 w=modelMatrix*vec4(position,1.0);
  // tiny geometric ripple displacement (local XZ plane lies in world XZ after rotation)
  w.y += sin(w.x*7.0+uTime*1.3)*cos(w.z*6.0-uTime*1.1)*0.006;
  vWorld=w.xyz;
  gl_Position=projectionMatrix*viewMatrix*w;
}
`;
export const waterFrag = /* glsl */ `
uniform vec3 uDeep,uShallow,uSky,uSunColor,uSunDir,uSnowColor;
uniform float uTime,uOpacity,uSnow,uRipple;
uniform samplerCube uEnv;
varying vec2 vUv; varying vec3 vWorld;
${NOISE}
void main(){
  vec2 p=vUv*2.0-1.0; float r=length(p);
  if(r>1.0) discard;
  float edge=smoothstep(1.0,0.85,r);
  vec2 q=p*3.0;
  float w1=fbm2(q+vec2(uTime*0.10,uTime*0.075));
  float w2=fbm2(q*2.2-vec2(uTime*0.14,uTime*0.06));
  float rip=mix(w1,w2,0.45);
  rip+=sin(r*30.0-uTime*4.0)*exp(-r*2.2)*uRipple*0.24;
  rip+=sin(p.x*22.0+uTime*1.2)*sin(p.y*18.0-uTime*0.9)*0.05;
  float e=0.014;
  float hx=fbm2((q+vec2(e,0.))+vec2(uTime*.10,uTime*.075))-fbm2((q-vec2(e,0.))+vec2(uTime*.10,uTime*.075));
  float hy=fbm2((q+vec2(0.,e))-vec2(uTime*.14,uTime*.06))-fbm2((q-vec2(0.,e))-vec2(uTime*.14,uTime*.06));
  vec3 n=normalize(vec3(-hx*8.,1.,-hy*8.));
  vec3 V=normalize(cameraPosition-vWorld);
  vec3 R=reflect(-V,n);
  vec3 env=textureCube(uEnv,R).rgb;
  vec3 reflection = env;
  float fres=0.16+0.78*pow(1.0-max(dot(n,V),0.0),4.0);
  // shallow-water depth gradient: darker near the stone rim, lighter/shallower centre
  float depth = smoothstep(0.15, 0.98, r);   // 0 centre → 1 edge
  vec3 body=mix(uShallow,uDeep,depth*0.85+0.1);
  // animated caustic ribbons on the pond bed (subtle, breaks up flat colour)
  float caustic = fbm2(q*2.6 + vec2(uTime*0.06,-uTime*0.05) + w1*1.4);
  caustic = pow(max(0.0,1.0-abs(caustic-0.5)*3.2),3.0);
  body += uSunColor * caustic * (1.0-depth) * 0.16 * (1.0-uSnow);
  vec3 col=mix(body,reflection,fres*(1.0-uSnow));
  // meniscus highlight where water meets the stones
  col += uSky * smoothstep(0.86,1.0,r)*0.18*(1.0-uSnow);
  vec3 H=normalize(normalize(uSunDir)+V);
  // broad sheen + tight glint: readable highlight across the small pond
  float ndh=max(dot(n,H),0.0);
  col+=uSunColor*pow(ndh,28.0)*0.35*edge*(1.0-uSnow);
  col+=uSunColor*pow(ndh,90.0)*1.4*edge*(1.0-uSnow);
  float ice=fbm2(q*3.4+vec2(9.))*0.5+0.5;
  col=mix(col,uSnowColor*(0.84+ice*0.22),uSnow*0.92);
  col+=vec3(1.0)*smoothstep(0.012,0.0,abs(sin(p.x*9.+p.y*7.+ice*3.))-0.985)*uSnow*0.25;
  gl_FragColor=vec4(col,uOpacity*edge);
}
`;

// ---------------------------------------------------------------- particles
export const particleVert = /* glsl */ `
attribute float aSeed,aSize;
uniform float uTime,uPixelRatio,uMode,uRange,uBaseY,uFall,uWind;
uniform vec2 uWindDir,uCamVel;
varying float vSeed; varying float vFade;
void main(){
  vec3 p=position; float s=aSeed,t=uTime;
  vec2 wd=normalize(uWindDir+vec2(1e-4));
  if(uMode<0.5){        // petals
    p.y=mod(position.y-t*(0.32+s*0.3)*uFall,uRange)+uBaseY;
    p.x+=sin(t*0.8+s*6.283)*1.2+wd.x*uWind*(0.6+s*0.8);
    p.z+=cos(t*0.62+s*5.0)*1.0+wd.y*uWind*(0.6+s*0.8);
  } else if(uMode<1.5){ // fireflies
    p.x+=sin(t*0.5+s*6.283)*1.4+wd.x*uWind*0.3;
    p.y+=sin(t*0.7+s*3.0)*0.55;
    p.z+=cos(t*0.45+s*4.0)*1.4+wd.y*uWind*0.3;
  } else if(uMode<2.5){ // autumn leaves
    p.y=mod(position.y-t*(0.4+s*0.35)*uFall,uRange)+uBaseY;
    p.x+=sin(t*0.9+s*6.283)*1.5+wd.x*uWind*(0.8+s);
    p.z+=cos(t*0.7+s*4.0)*1.2+wd.y*uWind*(0.8+s);
  } else {              // snow
    p.y=mod(position.y-t*(0.28+s*0.36)*uFall,uRange)+uBaseY;
    p.x+=sin(t*0.45+s*6.283)*0.9+wd.x*uWind*(0.5+s*0.7);
    p.z+=cos(t*0.38+s*5.0)*0.9+wd.y*uWind*(0.5+s*0.7);
  }
  p.x-=uCamVel.x*(0.18+s*0.22); p.z-=uCamVel.y*(0.18+s*0.22);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  float tw=(uMode>0.5&&uMode<1.5)?(0.55+0.45*sin(t*3.0+s*30.0)):1.0;
  gl_PointSize=clamp(aSize*uPixelRatio*(48.0/max(1.0,-mv.z))*tw, 1.0, 26.0);
  vSeed=s;
  vFade=clamp((uRange-(p.y-uBaseY))/0.6,0.0,1.0)*clamp((p.y-uBaseY)/0.4,0.0,1.0);
  gl_Position=projectionMatrix*mv;
}
`;
export const particleFrag = /* glsl */ `
uniform vec3 uColor; uniform float uMode,uOpacity;
varying float vSeed,vFade;
void main(){
  vec2 c=gl_PointCoord-0.5; float d=length(c); float a;
  if(uMode<0.5){ // cherry petal: teardrop with a notched tip
    vec2 pc=c*vec2(1.25,1.0);
    float ang=atan(pc.y,pc.x);
    float rr=0.36+0.07*sin(ang*2.0)-0.05*smoothstep(0.7,1.0,pc.y); // notch at top
    a=1.0-smoothstep(rr-0.12,rr,length(pc));
    // faint central crease for form
    a*=1.0-0.15*smoothstep(0.05,0.0,abs(pc.x))*smoothstep(0.1,0.4,pc.y);
  }
  else if(uMode<1.5){ a=smoothstep(0.5,0.0,d); }
  else if(uMode<2.5){ float rr=0.3+0.05*cos(atan(c.y,c.x)*2.0); a=1.0-smoothstep(rr-0.06,rr,d); }
  else { a=smoothstep(0.5,0.1,d); }
  if(a<0.01) discard;
  vec3 col=uColor*(0.82+vSeed*0.36);
  if(uMode>0.5&&uMode<1.5) col+=vec3(0.5,0.45,0.1)*smoothstep(0.3,0.0,d);
  gl_FragColor=vec4(col,a*uOpacity*vFade);
}
`;

// ---------------------------------------------------------------- film grade
export const gradeShader = {
  uniforms: {
    tDiffuse:{value:null}, uTime:{value:0}, uVignette:{value:0.72},
    uGrain:{value:0.016}, uSaturation:{value:1.10}, uContrast:{value:1.10},
    uAberration:{value:0.35}, uTemperature:{value:0.0},
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime,uVignette,uGrain,uSaturation,uContrast,uAberration,uTemperature;
    varying vec2 vUv;
    ${NOISE}
    void main(){
      vec2 uv=vUv, dc=uv-0.5; float r2=dot(dc,dc);
      float ab=uAberration*0.002*r2;
      vec3 col;
      col.r=texture2D(tDiffuse,uv+dc*ab).r;
      col.g=texture2D(tDiffuse,uv).g;
      col.b=texture2D(tDiffuse,uv-dc*ab).b;

      // --- linear-space filmic grade (runs BEFORE OutputPass tone mapping) ---
      float l=dot(col,vec3(0.2126,0.7152,0.0722));
      // contrast as a multiplier around a middle-grey pivot (correct in linear HDR)
      col = max(col, 0.0) * uContrast;
      // saturation with luminance preserved
      l=dot(col,vec3(0.2126,0.7152,0.0722));
      col=mix(vec3(l),col,uSaturation);

      // cinematic split-tone: cool the shadows, warm the highlights
      float shadow = 1.0 - smoothstep(0.0, 0.35, l);
      float high   = smoothstep(0.28, 0.9, l);
      col *= mix(vec3(1.0), vec3(0.86,0.95,1.10), shadow*0.5);
      col *= mix(vec3(1.0), vec3(1.08,1.02,0.90), high*0.45);
      col += vec3(uTemperature*0.02,0.0,-uTemperature*0.02);

      // soft vignette and fine grain
      col*=1.0-smoothstep(0.12,0.78,r2)*uVignette;
      float g=hash21(uv*vec2(1920.,1080.)+fract(uTime)*137.)-0.5;
      col+=g*uGrain;
      gl_FragColor=vec4(max(col,0.0),1.0);
    }
  `,
};
