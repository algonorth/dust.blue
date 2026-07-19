import*as THREE from'three';import{EffectComposer}from'three/addons/postprocessing/EffectComposer.js';import{RenderPass}from'three/addons/postprocessing/RenderPass.js';import{UnrealBloomPass}from'three/addons/postprocessing/UnrealBloomPass.js';import{OutputPass}from'three/addons/postprocessing/OutputPass.js';const canvas=document.getElementById('gl');let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});}catch(e){document.getElementById('nogl').hidden=false;throw e;}
const IS_TOUCH=matchMedia('(pointer: coarse)').matches;const IS_SMALL=innerWidth<720;const DPR=Math.min(devicePixelRatio||1,IS_TOUCH?1.5:1.75);const DUST_COUNT=(IS_TOUCH||IS_SMALL)?48000:130000;renderer.setPixelRatio(DPR);renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;const scene=new THREE.Scene();scene.background=new THREE.Color(0x030308);const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,0.1,900);camera.position.set(0,4,66);function track(keys){return(p)=>{if(p<=keys[0][0])return keys[0][1];for(let i=0;i<keys.length-1;i++){const[p0,v0]=keys[i],[p1,v1]=keys[i+1];if(p<=p1){const t=(p-p0)/(p1-p0);const s=t*t*(3-2*t);return v0+(v1-v0)*s;}}
return keys[keys.length-1][1];};}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));const lerp=(a,b,t)=>a+(b-a)*t;let frameK=1,portK=0;function applyViewport(){camera.aspect=innerWidth/innerHeight;const wide=clamp(Math.pow(1.45/camera.aspect,0.5),1,1.42);camera.fov=46*wide;frameK=clamp(camera.aspect/1.45,0.38,1);portK=clamp(1-camera.aspect/1.45,0,0.7);camera.updateProjectionMatrix();}
applyViewport();const dustGeo=new THREE.BufferGeometry();{const cloud=new Float32Array(DUST_COUNT*3);const disk=new Float32Array(DUST_COUNT*3);const shell=new Float32Array(DUST_COUNT*3);const seed=new Float32Array(DUST_COUNT*4);const NCLUMP=26;const clumps=[];for(let i=0;i<NCLUMP;i++){const a=(i/NCLUMP)*Math.PI*2*2.4+Math.random()*0.9;clumps.push({x:Math.cos(a)*(10+Math.random()*34)*(Math.random()>0.5?1:-0.8),y:(Math.random()-0.5)*42,z:(Math.random()-0.5)*46,r:4+Math.random()*11,});}
const gauss=()=>(Math.random()+Math.random()+Math.random()-1.5)*0.8;for(let i=0;i<DUST_COUNT;i++){if(Math.random()<0.82){const c=clumps[(Math.random()*NCLUMP)|0];cloud[i*3]=c.x+gauss()*c.r;cloud[i*3+1]=c.y+gauss()*c.r*0.8;cloud[i*3+2]=c.z+gauss()*c.r;}else{cloud[i*3]=(Math.random()-0.5)*110;cloud[i*3+1]=(Math.random()-0.5)*60;cloud[i*3+2]=(Math.random()-0.5)*80;}
const rr=1.6+30*Math.pow(Math.random(),1.6);const arm=Math.random()<0.62?(Math.random()<0.5?0:Math.PI):Math.random()*Math.PI*2;const ang=arm+rr*0.16+(Math.random()-0.5)*1.1;disk[i*3]=Math.cos(ang)*rr;disk[i*3+1]=(Math.random()-0.5)*(0.4+rr*0.09)*(Math.random()<0.08?4:1);disk[i*3+2]=Math.sin(ang)*rr;const u=Math.random()*2-1,ph=Math.random()*Math.PI*2;const sxy=Math.sqrt(1-u*u);const layerPick=Math.random();const layer=layerPick<0.4?0.52:layerPick<0.75?0.78:1.0;const pinch=1.0+Math.abs(u)*0.55;const fil=1.0+0.16*Math.sin(ph*5.0+u*7.0)+0.07*Math.sin(ph*11.0-u*13.0);shell[i*3]=sxy*Math.cos(ph)*layer*fil;shell[i*3+1]=u*layer*pinch*fil;shell[i*3+2]=sxy*Math.sin(ph)*layer*fil;seed[i*4]=Math.random()*Math.PI*2;seed[i*4+1]=0.5+Math.random();seed[i*4+2]=0.4+Math.pow(Math.random(),2.2)*1.8;seed[i*4+3]=layerPick;}
dustGeo.setAttribute('aCloud',new THREE.BufferAttribute(cloud,3));dustGeo.setAttribute('aDisk',new THREE.BufferAttribute(disk,3));dustGeo.setAttribute('aShell',new THREE.BufferAttribute(shell,3));dustGeo.setAttribute('aSeed',new THREE.BufferAttribute(seed,4));dustGeo.setAttribute('position',new THREE.BufferAttribute(cloud.slice(),3));}
const dustUniforms={uTime:{value:0},uWCloud:{value:1},uWDisk:{value:0},uWShell:{value:0},uShellR:{value:6},uHomeRot:{value:0},uWBH:{value:0},uBHPos:{value:new THREE.Vector3(0,0,-400)},uConsume:{value:0},uSpinPhase:{value:0},uTurb:{value:1.6},uAlpha:{value:0.9},uHeat:{value:0},uSize:{value:DPR*(IS_SMALL?56:76)},uMouse:{value:new THREE.Vector3(999,999,0)},uMouseF:{value:-2.2},uColA:{value:new THREE.Color(0x2a3550)},uColB:{value:new THREE.Color(0x6b7fb0)},uShell1:{value:new THREE.Color(0x53eccd)},uShell2:{value:new THREE.Color(0xff6f91)},uShell3:{value:new THREE.Color(0xffc46b)},};const dustMat=new THREE.ShaderMaterial({uniforms:dustUniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,vertexShader:`
    attribute vec3 aCloud;
    attribute vec3 aDisk;
    attribute vec3 aShell;
    attribute vec4 aSeed;
    uniform float uTime, uWCloud, uWDisk, uWShell, uShellR, uConsume, uSpinPhase, uTurb, uSize, uMouseF, uHeat, uWBH, uHomeRot;
    uniform vec3 uMouse, uBHPos;
    varying float vAlpha, vHeat, vHue, vBillow, vDop;

    void main() {
      float ph = aSeed.x;
      float spd = aSeed.y;
      // ~7% of grains are huge soft gas billows — cheap volumetrics
      float billow = step(0.93, fract(ph * 3.9717));
      vBillow = billow;

      // — cloud: slow breathing drift
      vec3 pc = aCloud;
      pc.x += sin(uTime * 0.11 * spd + ph) * uTurb;
      pc.y += sin(uTime * 0.13 * spd + ph * 1.7) * uTurb * 0.8;
      pc.z += cos(uTime * 0.09 * spd + ph * 2.3) * uTurb;

      // — disk: differential rotation, scroll spins it up, ignition pulls it in
      float r = length(aDisk.xz) * mix(1.0, 0.22, uConsume);
      float ang = atan(aDisk.z, aDisk.x)
                + (uTime * 0.03 + uSpinPhase) * (9.0 / (r + 2.0))
                + uConsume * 2.2;
      vec3 pd = vec3(cos(ang) * r, aDisk.y * mix(1.0, 0.35, uConsume), sin(ang) * r);
      pd.y += sin(uTime * 0.6 * spd + ph) * 0.12;

      // — nebula shell: expanding, shimmering
      float sr = uShellR * (1.0 + (spd - 1.0) * 0.13);
      vec3 ps = aShell * sr;
      ps += vec3(sin(uTime * 0.3 + ph), cos(uTime * 0.26 + ph * 1.3), sin(uTime * 0.22 + ph * 2.1)) * 0.35;

      // — black-hole accretion fringe: the disk distribution reborn, huge,
      //   shearing around the hole. grains lap it on keplerian clocks,
      //   paced to the disk shader's shear so the two layers read as one.
      float rb = length(aDisk.xz) * 2.9 + 13.0;
      float angB = atan(aDisk.z, aDisk.x) + uTime * (32.0 / pow(rb, 1.5));
      // inner grains settle into the disk plane and become part of it;
      // the far fringe stays a loose halo
      float hug = 1.0 - smoothstep(15.0, 44.0, rb);
      vec3 pb = uBHPos + vec3(cos(angB) * rb, aDisk.y * mix(1.4, 0.3, hug), sin(angB) * rb);
      // same relativistic beaming as the disk: approaching side brightens
      float dop = 1.0 + 0.72 * sin(angB) / sqrt(rb * 0.155);
      vDop = mix(1.0, clamp(dop, 0.55, 1.6), uWBH);

      // home slowly rotates about the origin — but ONLY home. rotating the
      // black-hole fringe (offset 400 units) would fling it sideways.
      vec3 home = pc * uWCloud + pd * uWDisk + ps * uWShell;
      float cR = cos(uHomeRot), sR = sin(uHomeRot);
      home.xz = vec2(home.x * cR + home.z * sR, home.z * cR - home.x * sR);
      vec3 pos = home + pb * uWBH;

      // — cursor: gravity before ignition, radiation pressure after
      vec3 dm = pos - uMouse;
      float md = length(dm);
      float f = uMouseF * exp(-md * md / 140.0);
      vec3 swirl = normalize(cross(vec3(0.0, 0.0, 1.0), dm + 0.001));
      pos += (normalize(dm + 0.001) * f + swirl * f * 0.7);

      // gravitational lensing: the disk is flat, but light from grains
      // behind the hole bends around it — same physics that lifts the
      // raymarched disk's far side into the arcs. Displace the apparent
      // position outward (Einstein-lens mapping) so far-side dust sweeps
      // up and over the shadow instead of sliding flat across it.
      float occl = 1.0;
      if (uWBH > 0.01) {
        vec3 toBH = uBHPos - cameraPosition;
        float dBH = length(toBH);
        vec3 nBH = toBH / dBH;
        vec3 toP = pos - cameraPosition;
        float tproj = dot(toP, nBH);
        vec3 perp = toP - nBH * tproj;
        float bimp = max(length(perp), 0.001);
        float behind = smoothstep(0.0, 36.0, tproj - dBH); // 26.0 is how quickly the climb starts. 
        float eR2 = 230.0 * behind * uWBH; // 230.0 is the height of the climb // Einstein radius^2, world units^2
        float bLens = 0.5 * (bimp + sqrt(bimp * bimp + 4.0 * eR2));
        pos = cameraPosition + nBH * tproj + perp * (bLens / bimp);
        // grains whose bent light still skims the photon sphere are lost
        float shadowed = smoothstep(dBH * 0.92, dBH * 1.03, tproj) * (1.0 - smoothstep(5.8, 8.8, bLens)); // 5.8, 8.8 are how much dust the shadow eats. 
        occl = 1.0 - shadowed * uWBH;
      }

      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mv;
      float dist = max(0.1, -mv.z);
      // shells render crisper; billows render huge and soft
      float sizeMul = mix(1.0, 0.75, uWShell) * mix(1.0, mix(11.0, 3.0, uWShell), billow);
      sizeMul *= mix(1.0, 0.55, uWBH);                    // fringe grains stay fine mist
      // mid-morph the swarm is far away — swell the grains so the flight reads
      float flight = uWBH * (1.0 - uWBH) * 4.0;
      sizeMul *= 1.0 + flight * 1.4;
      float maxPx = mix(mix(26.0, 12.0, uWBH), 150.0, billow);
      gl_PointSize = clamp(uSize * aSeed.z * sizeMul / dist, 0.6, maxPx);

      // heat by proximity to core (disk phase) — or to the event horizon
      vHeat = uHeat * exp(-r * 0.22) * uWDisk;
      vHeat = max(vHeat, uWBH * exp(-(rb - 13.0) * 0.05) * 1.2);
      vHue = aSeed.w;
      // fade the far cloud haze slightly, keep clumps dense
      vAlpha = (0.55 + 0.45 * sin(ph + uTime * 0.4 * spd)) * occl;
    }
  `,fragmentShader:`
    precision highp float;
    uniform vec3 uColA, uColB, uShell1, uShell2, uShell3;
    uniform float uAlpha, uWShell;
    varying float vAlpha, vHeat, vHue, vBillow, vDop;

    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float fall = smoothstep(0.5, 0.05, d);
      float core = smoothstep(0.18, 0.0, d) * 0.7 * (1.0 - vBillow);

      vec3 dust = mix(uColA, uColB, vHue);
      dust = mix(dust, vec3(1.0, 0.72, 0.42), vHeat);          // hot inner disk
      vec3 shellCol = (vHue < 0.4 ? uShell1 : (vHue < 0.75 ? uShell2 : uShell3)) * 1.35;
      vec3 col = mix(dust, shellCol, uWShell);

      // billows: broad, faint, pure gas — no hot core.
      // near a hot core they thin out into a dark dust lane instead of glowing
      float grainA = (fall * 0.55 + core) * vAlpha;
      float billowA = pow(smoothstep(0.5, 0.0, d), 1.6) * 0.085 * (0.5 + vAlpha) * (1.0 - vHeat * 0.8);
      float a = mix(grainA, billowA, vBillow) * uAlpha;
      gl_FragColor = vec4(col * (1.0 + vHeat * 2.0 * (1.0 - vBillow) + core) * vDop, a * clamp(vDop, 0.7, 1.2));
    }
  `,});const dust=new THREE.Points(dustGeo,dustMat);dust.frustumCulled=false;dust.renderOrder=5;scene.add(dust);const starGeo=new THREE.BufferGeometry();{const N=2600;const pos=new Float32Array(N*3);const s=new Float32Array(N*2);for(let i=0;i<N;i++){const u=Math.random()*2-1,ph=Math.random()*Math.PI*2;const sxy=Math.sqrt(1-u*u),R=380+Math.random()*120;pos[i*3]=sxy*Math.cos(ph)*R;pos[i*3+1]=u*R;pos[i*3+2]=sxy*Math.sin(ph)*R;s[i*2]=Math.random();s[i*2+1]=0.4+Math.pow(Math.random(),3)*2.2;}
starGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));starGeo.setAttribute('aS',new THREE.BufferAttribute(s,2));}
const starUniforms={uTime:{value:0},uDPR:{value:DPR}};const stars=new THREE.Points(starGeo,new THREE.ShaderMaterial({uniforms:starUniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`
    attribute vec2 aS;
    uniform float uTime, uDPR;
    varying float vTw, vWarm;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      vTw = 0.55 + 0.45 * sin(uTime * (0.4 + aS.x) + aS.x * 40.0);
      vWarm = fract(aS.x * 7.31);
      gl_PointSize = aS.y * uDPR * 2.0;
    }
  `,fragmentShader:`
    precision highp float;
    varying float vTw, vWarm;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d) * vTw * 0.85;
      vec3 col = mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.85, 0.7), step(0.75, vWarm));
      gl_FragColor = vec4(col, a);
    }
  `,}));scene.add(stars);const starUni={uTime:{value:0},uTemp:{value:0.45},uLum:{value:1.6},uWobble:{value:0.0},uSpots:{value:0.6},};const starMat=new THREE.ShaderMaterial({uniforms:starUni,vertexShader:`
    uniform float uTime, uWobble;
    varying vec3 vN, vP;

    float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float vnoise(vec3 p){
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z);
    }

    void main() {
      vN = normalize(normalMatrix * normal);
      float bump = vnoise(normal * 3.0 + uTime * 0.15) - 0.5;
      vec3 p = position * (1.0 + bump * uWobble);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vP = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }
  `,fragmentShader:`
    precision highp float;
    uniform float uTime, uTemp, uLum, uSpots;
    varying vec3 vN, vP;

    float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float vnoise(vec3 p){
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z);
    }
    float fbm(vec3 p){
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.13 + 7.7; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 n = normalize(vN);
      vec3 view = normalize(-vP);
      float nv = clamp(dot(n, view), 0.0, 1.0);

      // convective granulation, slowly boiling
      vec3 q = n * 5.0;
      float g1 = fbm(q + vec3(0.0, uTime * 0.05, uTime * 0.03));
      float g2 = fbm(q * 2.6 - vec3(uTime * 0.04, 0.0, uTime * 0.06) + g1 * 1.4);
      float gran = g1 * 0.6 + g2 * 0.4;

      // temperature ramp
      vec3 hot  = vec3(0.82, 0.88, 1.05);
      vec3 sun  = vec3(1.05, 0.78, 0.42);
      vec3 red  = vec3(1.0, 0.22, 0.06);
      vec3 base = uTemp < 0.5 ? mix(hot, sun, uTemp * 2.0) : mix(sun, red, (uTemp - 0.5) * 2.0);

      vec3 col = base * (0.55 + gran * 0.9);
      // bright cells crackle
      col += base * smoothstep(0.62, 0.78, g2) * 0.5;
      // sunspots at low frequency, only when magnetically active
      float spot = smoothstep(0.32, 0.18, fbm(n * 2.2 + 3.1)) * uSpots;
      col *= 1.0 - spot * 0.55;

      // limb darkening + hot fresnel rim
      col *= 0.35 + 0.65 * pow(nv, 0.55);
      col += base * pow(1.0 - nv, 2.6) * 1.6;

      gl_FragColor = vec4(col * uLum, 1.0);
    }
  `,});const star=new THREE.Mesh(new THREE.SphereGeometry(1,96,96),starMat);star.scale.setScalar(0.001);scene.add(star);const coronaUni={uTime:{value:0},uColor:{value:new THREE.Color(0xffc46b)},uOpacity:{value:0},uInner:{value:0},};const corona=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:coronaUni,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,vertexShader:`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,fragmentShader:`
      precision highp float;
      uniform float uTime, uOpacity, uInner;
      uniform vec3 uColor;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        if (r > 1.0) discard;
        float ang = atan(c.y, c.x);
        float streaks = n2(vec2(ang * 2.4, r * 3.0 - uTime * 0.12)) * 0.5
                      + n2(vec2(ang * 5.1 + 9.0, r * 6.0 - uTime * 0.2)) * 0.5;
        float glow = pow(1.0 - r, 3.2);
        float a = glow * (0.4 + streaks * 0.55) * uOpacity;
        a *= smoothstep(uInner * 0.5, uInner * 1.08, r); // don't paint over the star's face
        gl_FragColor = vec4(uColor * (0.85 + glow * 0.6), a);
      }
    `,}));corona.renderOrder=3;scene.add(corona);const PLANETS=[{orbit:3.3,size:0.10,speed:0.50,col:new THREE.Color(0x9c8f82),phase:0.4},{orbit:4.9,size:0.16,speed:0.33,col:new THREE.Color(0x6f8ea8),phase:2.6},{orbit:11.6,size:0.13,speed:0.16,col:new THREE.Color(0xc7b6a0),phase:4.6},];const planetGroup=new THREE.Group();scene.add(planetGroup);for(const pl of PLANETS){const uni={uCol:{value:pl.col},uAlpha:{value:0}};const m=new THREE.Mesh(new THREE.SphereGeometry(pl.size,24,24),new THREE.ShaderMaterial({uniforms:uni,transparent:true,depthWrite:false,vertexShader:`
        varying vec3 vN, vW;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,fragmentShader:`
        precision highp float;
        uniform vec3 uCol; uniform float uAlpha;
        varying vec3 vN, vW;
        void main() {
          // lit by the star at origin
          float l = max(dot(normalize(vN), normalize(-vW)), 0.0);
          vec3 col = uCol * (0.12 + l * 1.3);
          gl_FragColor = vec4(col, uAlpha);
        }
      `,}));const ringPts=[];for(let i=0;i<=128;i++){const a=(i/128)*Math.PI*2;ringPts.push(new THREE.Vector3(Math.cos(a)*pl.orbit,0,Math.sin(a)*pl.orbit));}
const ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts),new THREE.LineBasicMaterial({color:0xefe9dc,transparent:true,opacity:0}));pl.mesh=m;pl.uni=uni;pl.ring=ring;pl.r=pl.orbit;pl.swallow=0;planetGroup.add(m,ring);}
const BH_POS=new THREE.Vector3(0,0,-400);const BH_STEPS=IS_TOUCH?56:110;const bhUni={uTime:{value:0},uFade:{value:0},uExpo:{value:1},uCamPos:{value:new THREE.Vector3()},uCenter:{value:BH_POS},};const bh=new THREE.Mesh(new THREE.PlaneGeometry(116,116),new THREE.ShaderMaterial({uniforms:bhUni,transparent:true,depthWrite:false,depthTest:false,vertexShader:`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,fragmentShader:`
      precision highp float;
      uniform float uTime, uFade, uExpo;
      uniform vec3 uCamPos, uCenter;
      varying vec3 vWorld;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 4; i++) { v += a * n2(p); p = rot * p * 2.17 + 11.3; a *= 0.5; }
        return v;
      }

      // emission of the thin disk at radius rr (in rs units) and azimuth ang.
      // noise is sampled on circles in the domain — vec2(cos, sin) — so the
      // pattern tiles seamlessly in azimuth (no seam at ang = ±π) and the
      // lattice never aligns with circles of constant radius (no terracing)
      vec3 diskColor(float rr, float ang, out float aa) {
        // keplerian shear: inner bands lap the outer ones
        float w = 4.4 / pow(rr, 1.15);
        float a1 = ang - uTime * w * 0.56;
        float a2 = ang - uTime * w * 0.53;
        float wob = fbm(vec2(rr * 0.55 + 1.7 * cos(a1 + 2.1), 1.7 * sin(a1 + 2.1))) * 2.3;
        float band  = fbm(vec2(rr * 2.6 + wob + 2.5 * cos(a1), 2.5 * sin(a1)));
        float band2 = fbm(vec2(rr * 7.0 + 31.0 + 4.0 * cos(a2), 4.0 * sin(a2) + wob));
        float streak = band * 0.65 + band2 * 0.35;
        float heat = clamp(1.7 / (rr - 1.5), 0.0, 2.4);
        vec3 cHot = vec3(1.45, 1.25, 1.0);
        vec3 cMid = vec3(1.35, 0.72, 0.28);
        vec3 cOut = vec3(0.85, 0.32, 0.09);
        vec3 col = mix(cOut, cMid, clamp(heat * 0.7, 0.0, 1.0));
        col = mix(col, cHot, clamp(heat - 0.8, 0.0, 1.0));
        float edgeIn = smoothstep(2.85, 3.4, rr);
        // long dim outer skirt — reaches out under the particle fringe
        float edgeOut = 1.0 - smoothstep(6.5, 12.2, rr);
        edgeOut *= edgeOut;
        aa = edgeIn * edgeOut * (0.4 + streak * 0.85);
        // relativistic beaming: the approaching side burns brighter
        float dop = 1.0 + 0.72 * sin(ang) / sqrt(rr * 0.34);
        col *= dop;
        aa *= clamp(dop, 0.5, 1.7);
        return col * (0.55 + heat) * aa;
      }

      void main() {
        const float RS = 2.2;                    // event horizon radius, world units
        vec3 ro = (uCamPos - uCenter) / RS;
        vec3 rd = normalize(vWorld - uCamPos);

        // impact parameter: rays that pass far away are untouched
        float b = length(cross(rd, ro));
        if (b > 24.0) { gl_FragColor = vec4(0.0); return; }

        // fast-forward to just outside the strong-field region
        float tca = -dot(ro, rd);
        vec3 pos = ro + rd * max(tca - 20.0, 0.0);
        vec3 vel = rd;
        vec3 hv = cross(pos, vel);
        float h2 = dot(hv, hv);

        vec3 col = vec3(0.0);
        float alpha = 0.0;
        bool captured = false;
        float py = pos.y;

        for (int i = 0; i < ${BH_STEPS}; i++) {
          float r = length(pos);
          if (r < 1.03) { captured = true; break; }
          if (r > 42.0 && dot(pos, vel) > 0.0) break;
          float dt = clamp(r * 0.14, 0.06, 0.9);
          if (r < 8.0) dt *= 0.5;
          vel += -1.5 * h2 * pos / pow(r, 5.0) * dt;   // photon bending
          pos += vel * dt;
          // thin-disk crossing (allows multiple lensed images per ray)
          if (pos.y * py < 0.0) {
            float f = py / (py - pos.y);
            vec3 hit = pos - vel * dt * (1.0 - f);
            float rr = length(hit.xz);
            if (rr > 2.85 && rr < 12.4) {
              float aa;
              vec3 cc = diskColor(rr, atan(hit.z, hit.x), aa);
              col += cc * (1.0 - alpha);
              alpha += aa * (1.0 - alpha);
              if (alpha > 0.98) break;
            }
          }
          py = pos.y;
        }
        if (captured) alpha = 1.0;                 // the shadow swallows the sky
        gl_FragColor = vec4(col * uExpo * uFade, alpha * uFade);
      }
    `,}));bh.position.copy(BH_POS);bh.renderOrder=4;bh.visible=false;scene.add(bh);const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.6,0.7,0.22);composer.addPass(bloom);composer.addPass(new OutputPass());const P_END=1420/1200;const T={camZ:track([[0,66],[0.10,58],[0.24,40],[0.34,26],[0.385,22],[0.44,20],[0.52,21],[0.62,36],[0.70,50],[0.78,58],[0.86,46],[0.93,56],[0.98,64],[1.02,-80],[1.08,-338],[1.115,-364],[1.14,-120],[1.17,46],[1.1833,58]]),camZPort:track([[0.40,0],[0.46,8],[0.55,8],[0.62,0]]),camY:track([[0,4],[0.24,7],[0.34,3],[0.385,1.2],[0.52,0.9],[0.62,4],[0.70,7],[0.78,9],[0.86,1.4],[0.96,5],[1.02,4],[1.08,4.4],[1.115,4.8],[1.15,4],[1.1833,6]]),lookX:track([[0.40,0],[0.44,-6.5],[0.56,-6.5],[0.61,7.5],[0.68,8],[0.71,4],[0.745,-6],[0.78,-6],[0.82,3.5],[0.88,3.5],[0.93,0],[0.99,0],[1.03,-14],[1.09,-8],[1.115,-3.5],[1.14,0]]),lookY:track([[1.02,0],[1.09,-3],[1.115,-3.8],[1.14,0]]),lookZ:track([[0.98,0],[1.03,-400],[1.125,-400],[1.15,0]]),camRoll:track([[0.995,0],[1.04,-0.34],[1.125,-0.46],[1.155,0]]),bhOp:track([[0.985,0],[1.02,1],[1.135,1],[1.165,0]]),wBH:track([[0.99,0],[1.03,1],[1.145,1],[1.175,0]]),camX:track([[1.10,0],[1.14,10],[1.16,30],[1.1833,0]]),follow:track([[1.13,0],[1.15,1],[1.175,1],[1.1833,0]]),wCloud:track([[0,1],[0.20,1],[0.32,0]]),wDisk:track([[0.20,0],[0.30,1],[0.40,1],[0.50,0]]),wShell:track([[0.66,0],[0.745,1],[0.99,1],[1.04,0],[1.145,0],[1.175,1]]),shellR:track([[0.66,4],[0.74,11],[0.86,17],[1,27]]),consume:track([[0.30,0],[0.40,0.4],[0.50,0.95]]),spinPhase:track([[0.20,0],[0.34,5.5],[0.50,9]]),turb:track([[0,1.7],[0.24,2.6],[0.34,1.1],[0.5,0.7],[0.74,1.3],[1,1.0]]),dustAlpha:track([[0,0.85],[0.30,1],[0.44,0.5],[0.50,0.1],[0.64,0.06],[0.70,0.5],[0.76,0.95],[0.86,0.65],[1.0,0.35],[1.04,0.55],[1.15,0.5],[1.175,0.5],[1.1833,0.42]]),heat:track([[0.22,0],[0.32,0.55],[0.385,1],[0.5,1]]),mouseF:track([[0,-2.8],[0.30,-3.4],[0.375,-3.6],[0.39,2.8],[0.60,2.2],[0.74,3.2],[1,1.6]]),starR:track([[0.35,0.001],[0.385,1.5],[0.42,2.0],[0.56,2.1],[0.66,9],[0.72,8.2],[0.78,3.0],[0.825,0.4],[0.86,0.3],[1,0.28]]),starTemp:track([[0.35,0.3],[0.42,0.45],[0.56,0.5],[0.64,0.9],[0.72,1],[0.78,0.72],[0.825,0.08],[1,0.02]]),starLum:track([[0.35,3.0],[0.40,3.2],[0.48,1.3],[0.58,0.7],[0.62,0.42],[0.72,0.38],[0.78,0.9],[0.825,2.4],[0.9,1.9],[1,1.5]]),wobble:track([[0.5,0.015],[0.60,0.08],[0.68,0.18],[0.74,0.22],[0.78,0.1],[0.83,0]]),spots:track([[0.42,0.7],[0.6,0.4],[0.72,0.1],[0.83,0]]),coronaScale:track([[0.24,0.1],[0.30,1.4],[0.36,2.4],[0.40,4.6],[0.5,5.0],[0.66,20],[0.72,18],[0.78,7.5],[0.825,1.7],[1,1.6]]),coronaOp:track([[0.22,0],[0.28,0.25],[0.34,0.45],[0.375,0.5],[0.40,0.55],[0.52,0.32],[0.68,0.28],[0.78,0.25],[0.83,0.55],[0.92,0.32],[1,0.22]]),bloomS:track([[0,0.55],[0.30,0.7],[0.36,0.85],[0.378,1.1],[0.388,3.0],[0.43,0.8],[0.58,0.45],[0.62,0.25],[0.72,0.28],[0.79,0.7],[0.83,1.5],[0.9,1.0],[1.0,0.7],[1.05,0.9],[1.115,0.65],[1.15,0.8],[1.1833,0.6]]),planetA:track([[0.42,0],[0.485,1]]),age:track([[0,-1.25e6],[0.11,-9.6e5],[0.24,-1.4e5],[0.36,-900],[0.385,0],[0.44,3.1e8],[0.56,9.8e9],[0.66,1.19e10],[0.745,1.202e10],[0.83,1.2103e10],[1,1.34e10]]),};const PAL=[{p:0.00,a:0x2c3560,b:0x86a0dc},{p:0.22,a:0x32406e,b:0x9db2e8},{p:0.38,a:0x4a3a52,b:0xd9a06a},{p:0.55,a:0x3a2f3e,b:0xb98a6a},{p:0.72,a:0x274a52,b:0x7adfd0},{p:1.00,a:0x1e3440,b:0x58b8ac},{p:1.05,a:0x4a2c14,b:0xd08a48},{p:1.145,a:0x4a2c14,b:0xd08a48},{p:1.175,a:0x1e3440,b:0x58b8ac},];const _ca=new THREE.Color(),_cb=new THREE.Color(),_c2a=new THREE.Color(),_c2b=new THREE.Color();function dustPalette(p){let i=0;while(i<PAL.length-2&&p>PAL[i+1].p)i++;const t=clamp((p-PAL[i].p)/(PAL[i+1].p-PAL[i].p),0,1);const s=t*t*(3-2*t);_ca.setHex(PAL[i].a);_c2a.setHex(PAL[i+1].a);_cb.setHex(PAL[i].b);_c2b.setHex(PAL[i+1].b);dustUniforms.uColA.value.lerpColors(_ca,_c2a,s);dustUniforms.uColB.value.lerpColors(_cb,_c2b,s);}
const CORONA_HOT=new THREE.Color(0xcfe0ff),CORONA_SUN=new THREE.Color(0xffc46b),CORONA_RED=new THREE.Color(0xff6a3d);function coronaColor(temp){if(temp<0.5)coronaUni.uColor.value.lerpColors(CORONA_HOT,CORONA_SUN,temp*2);else coronaUni.uColor.value.lerpColors(CORONA_SUN,CORONA_RED,(temp-0.5)*2);}
const CHAPTERS=[{p:0.00,num:'00',name:'OVERTURE'},{p:0.085,num:'01',name:'THE CLOUD'},{p:0.20,num:'02',name:'THE COLLAPSE'},{p:0.335,num:'03',name:'IGNITION'},{p:0.425,num:'04',name:'MAIN SEQUENCE'},{p:0.575,num:'05',name:'RED GIANT'},{p:0.695,num:'06',name:'THE SHEDDING'},{p:0.795,num:'07',name:'WHITE DWARF'},{p:0.985,num:'08',name:'THE OTHER ENDING'},{p:1.135,num:'∞',name:'EPILOGUE'},];const chapterNumEl=document.getElementById('chapter-num');const chapterNameEl=document.getElementById('chapter-name');const ageEl=document.getElementById('age-value');const tlFill=document.getElementById('tl-fill');const flashEl=document.getElementById('flash');const tickEls=[];{const ticks=document.getElementById('tl-ticks');for(const ch of CHAPTERS){const el=document.createElement('div');el.className='tl-tick';el.style.top=`${(ch.p / P_END) * 100}%`;ticks.appendChild(el);tickEls.push(el);}}
let currentChapter=-1;function updateHUD(p){let ci=0;for(let i=0;i<CHAPTERS.length;i++)if(p>=CHAPTERS[i].p)ci=i;if(ci!==currentChapter){currentChapter=ci;chapterNumEl.textContent=CHAPTERS[ci].num;chapterNameEl.textContent=CHAPTERS[ci].name;tickEls.forEach((el,i)=>el.classList.toggle('active',i===ci));}
tlFill.style.height=`${(clamp(p / P_END, 0, 1) * 100).toFixed(2)}%`;const age=T.age(p);let label;if(age<0)label=`T − ${Math.round(-age).toLocaleString('en-US')} YR`;else if(age<1e6)label=`T + ${Math.round(age).toLocaleString('en-US')} YR`;else if(age<1e9)label=`T + ${(age / 1e6).toFixed(1)} MILLION YR`;else label=`T + ${(age / 1e9).toFixed(2)} BILLION YR`;if(p>0.985&&p<1.15)label='CLOCKS DISAGREE HERE';ageEl.textContent=label;}
const sections=[...document.querySelectorAll('.ch')].map((el)=>{const top=parseFloat(el.dataset.top);el.style.top=`${top}vh`;return{el,p:top/1200};});function updateSections(pRaw){for(const s of sections){const d=pRaw-s.p;const win=s.p===0?0.075:0.062;const vis=d>-win&&d<win;const passed=d>=win;if(vis!==s.el.classList.contains('visible'))s.el.classList.toggle('visible',vis);if(passed!==s.el.classList.contains('passed'))s.el.classList.toggle('passed',passed);}}
if(IS_TOUCH){for(const hint of document.querySelectorAll('.hint')){for(const node of hint.childNodes){if(node.nodeType===Node.TEXT_NODE){node.nodeValue=node.nodeValue.replace('YOUR CURSOR','YOUR FINGER');}}}}
let pRaw=0,p=0,scrollVel=0;const scrollSpace=document.getElementById('scroll-space');let pxPerVh=innerHeight/100;function measureVh(){const h=scrollSpace.offsetHeight/1520;if(h>0)pxPerVh=h;}
function readScroll(){const denom=pxPerVh*1200;pRaw=denom>0?clamp(scrollY/denom,0,P_END):0;}
measureVh();addEventListener('scroll',readScroll,{passive:true});readScroll();const mouseNDC=new THREE.Vector2(0,0);const mouseTarget=new THREE.Vector2(0,0);const mouseWorld=new THREE.Vector3(999,999,0);const raycaster=new THREE.Raycaster();const zPlane=new THREE.Plane(new THREE.Vector3(0,0,1),0);let mouseActive=false;addEventListener('pointermove',(e)=>{mouseTarget.set((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1);mouseActive=true;},{passive:true});addEventListener('pointerleave',()=>{mouseActive=false;});addEventListener('touchmove',(e)=>{const t=e.touches[0];if(t){mouseTarget.set((t.clientX/innerWidth)*2-1,-(t.clientY/innerHeight)*2+1);mouseActive=true;}},{passive:true});addEventListener('touchend',()=>{mouseActive=false;});const clock=new THREE.Clock();let lastP=0;let flashT=0,lastRawFlash=0;function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),0.05);const t=clock.elapsedTime;p+=(pRaw-p)*Math.min(1,dt*4.5);scrollVel=lerp(scrollVel,Math.abs(p-lastP)/Math.max(dt,1e-4),0.12);lastP=p;mouseNDC.lerp(mouseTarget,Math.min(1,dt*5));const introK=1-Math.pow(Math.min(t/4,1),0.7);const cz=T.camZ(p)+introK*9+T.camZPort(p)*portK;const lx=T.lookX(p)*frameK;camera.position.x=lx*0.3+T.camX(p)+mouseNDC.x*(2.2+cz*0.05)+Math.sin(t*0.05)*0.8;camera.position.y=T.camY(p)+mouseNDC.y*(1.4+cz*0.03);let czF=cz,lzF=T.lookZ(p);const fw=T.follow(p);if(fw>0){const wb=T.wBH(p),ws=T.wShell(p);const swarmZ=-400*(wb/(wb+ws+0.001));czF=lerp(czF,swarmZ+55,fw);lzF=lerp(lzF,swarmZ*1.15,fw);}
camera.position.z=czF;camera.lookAt(lx,T.lookY(p),lzF);const roll=T.camRoll(p);if(roll!==0)camera.rotateZ(roll);if(mouseActive){raycaster.setFromCamera(mouseNDC,camera);const hit=raycaster.ray.intersectPlane(zPlane,mouseWorld);if(!hit)mouseWorld.set(999,999,0);}else{mouseWorld.set(999,999,0);}
dustUniforms.uMouse.value.lerp(mouseWorld,Math.min(1,dt*6));dustUniforms.uTime.value=t;dustUniforms.uWCloud.value=T.wCloud(p);dustUniforms.uWDisk.value=T.wDisk(p);dustUniforms.uWShell.value=T.wShell(p);dustUniforms.uShellR.value=T.shellR(p);dustUniforms.uConsume.value=T.consume(p);dustUniforms.uSpinPhase.value=T.spinPhase(p);dustUniforms.uTurb.value=T.turb(p)+Math.min(scrollVel*14,2.2);dustUniforms.uAlpha.value=T.dustAlpha(p);dustUniforms.uHeat.value=T.heat(p);dustUniforms.uMouseF.value=T.mouseF(p);dustUniforms.uWBH.value=T.wBH(p);dustUniforms.uHomeRot.value=t*0.004+p*0.35;dustPalette(p);const sr=T.starR(p);star.scale.setScalar(sr);star.visible=sr>0.01;starUni.uTime.value=t;starUni.uTemp.value=T.starTemp(p);starUni.uLum.value=T.starLum(p);starUni.uWobble.value=T.wobble(p);starUni.uSpots.value=T.spots(p);star.rotation.y=t*0.02;coronaUni.uTime.value=t;coronaUni.uOpacity.value=T.coronaOp(p);coronaUni.uInner.value=sr/Math.max(T.coronaScale(p),0.01);coronaColor(T.starTemp(p));corona.scale.setScalar(Math.max(T.coronaScale(p),0.01));corona.quaternion.copy(camera.quaternion);corona.visible=coronaUni.uOpacity.value>0.01;const pa=T.planetA(p);planetGroup.visible=pa>0.01;for(const pl of PLANETS){const engulf=clamp((sr*1.05-pl.orbit*0.78)/(pl.orbit*0.3),0,1);pl.swallow=Math.max(pl.swallow,engulf);if(p<0.4)pl.swallow=0;const alive=1-pl.swallow;pl.r=pl.orbit*(1-pl.swallow*0.85);const a=pl.phase+t*pl.speed*(1+pl.swallow*3);pl.mesh.position.set(Math.cos(a)*pl.r,0,Math.sin(a)*pl.r);pl.mesh.scale.setScalar(Math.max(alive,0.001));pl.uni.uAlpha.value=pa*alive;pl.ring.material.opacity=pa*alive*0.13;pl.ring.scale.setScalar(pl.r/pl.orbit);}
starUniforms.uTime.value=t;stars.rotation.y=t*0.002;const IGNITE_P=0.388;if(lastRawFlash<IGNITE_P&&pRaw>=IGNITE_P)flashT=1;else if(lastRawFlash>IGNITE_P&&pRaw<=IGNITE_P)flashT=Math.max(flashT,0.45);lastRawFlash=pRaw;flashT=Math.max(0,flashT-dt*(flashT>0.6?0.9:1.6));flashEl.style.opacity=(flashT*flashT*0.95).toFixed(3);const bhF=T.bhOp(p);bh.visible=bhF>0.01;if(bh.visible){bhUni.uTime.value=t;bhUni.uFade.value=bhF;bhUni.uCamPos.value.copy(camera.position);bhUni.uExpo.value=clamp(camera.position.distanceTo(BH_POS)/80,0.42,1);bh.quaternion.copy(camera.quaternion);}
bloom.strength=T.bloomS(p)+Math.min(scrollVel*1.2,0.35);updateHUD(p);updateSections(pRaw);composer.render();}
addEventListener('resize',()=>{applyViewport();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);measureVh();readScroll();});if(history.scrollRestoration)history.scrollRestoration='manual';scrollTo(0,0);requestAnimationFrame(()=>{document.querySelector('.ch-title').classList.add('visible');});frame();window.__tby={starUni,coronaUni,bloom,corona,star,dustUniforms,renderer,bh,bhUni};