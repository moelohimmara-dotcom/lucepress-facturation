export async function startPlanetScene(canvas: HTMLCanvasElement): Promise<() => void> {
  const THREE = await import("three");
  const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
  const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
  const { ShaderPass } = await import("three/examples/jsm/postprocessing/ShaderPass.js");
  const { GammaCorrectionShader } = await import("three/examples/jsm/shaders/GammaCorrectionShader.js");
  const { CopyShader } = await import("three/examples/jsm/shaders/CopyShader.js");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
  const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

  const CONFIG = {
    rimColor: "#c1faff", rimPower: 2.4, nightLights: 10, terrainDepth: 0.33, terrainShade: 1.3,
    oceanGlint: 0.45, oceanDeep: 0.12, oceanFlow: 3, oceanFlowSpeed: 0.8, oceanFlowScale: 2.1,
    glowColor: "#3a6cff", glowIntensity: 3.35, planetRadius: 1.95, spin: 0.03, initRotation: 2.07,
    tilt: 0.37, autoRotate: 0,
    cloud1Height: 1.005, cloud1Opacity: 0.6, cloud1Spin: 0.06,
    cloud2Height: 1.03, cloud2Opacity: 0.5, cloud2Spin: 0.14,
    cloud3Height: 1.075, cloud3Opacity: 0.5, cloud3Spin: 0.1,
    bgColor: "#040a1e", flameColor: "#3a6cff", flameColor2: "#c1faff", flameAmt: 0.15,
    atmoColor: "#9fc4ff", atmoCount: 320, atmoSize: 22, atmoSpeed: 0.8,
    starColor: "#cfe0ff", starCount: 1400, starSize: 1.6, starFlicker: 1,
    markerColor: "#ffd27a", markerCount: 60, markerSize: 16, markerSpeed: 0.5,
  } as const;
  const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 };

  const Lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const hexToVec3 = (hex: string) => {
    const c = new THREE.Color(hex);
    return new THREE.Vector3(c.r, c.g, c.b);
  };
  const smoothstep = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const sample = (stops: { p: number; v: number }[], p: number) => {
    if (p <= stops[0].p) return stops[0].v;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (p >= a.p && p <= b.p) return Lerp(a.v, b.v, smoothstep(0, 1, (p - a.p) / (b.p - a.p)));
    }
    return stops[stops.length - 1].v;
  };

  const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGL1Renderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 8);
  camera.layers.enable(LAYERS.TORUS_SCENE);
  camera.layers.enable(LAYERS.BLOOM_SCENE);
  camera.layers.enable(LAYERS.ENTIRE_SCENE);
  scene.add(camera);

  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  ambient.layers.set(LAYERS.ENTIRE_SCENE);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(0, 10, 2);
  directional.layers.set(LAYERS.ENTIRE_SCENE);
  scene.add(directional);

  const FinalPass = {
    uniforms: {
      iTime: { value: 0 }, tDiffuse: { value: null }, torusTexture: { value: null }, bloomTexture: { value: null }, haloTexture: { value: null },
      uBg: { value: hexToVec3(CONFIG.bgColor) }, uFlameA: { value: hexToVec3(CONFIG.flameColor) },
      uFlameB: { value: hexToVec3(CONFIG.flameColor2) }, uFlameAmt: { value: CONFIG.flameAmt },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float iTime; uniform sampler2D tDiffuse; uniform sampler2D bloomTexture; uniform sampler2D torusTexture; uniform sampler2D haloTexture;
      uniform vec3 uBg; uniform vec3 uFlameA; uniform vec3 uFlameB; uniform float uFlameAmt;
      varying vec2 vUv;
      vec3 warp3d(vec3 pos, float t){ float curv=.8,a=1.9,b=0.7; pos*=2.;
        pos.x+=curv*sin(t+a*pos.y)+t*b; pos.y+=curv*cos(t+a*pos.x);
        pos.y+=curv*sin(t+a*pos.z)+t*b; pos.z+=curv*cos(t+a*pos.y);
        pos.z+=curv*sin(t+a*pos.x)+t*b; pos.x+=curv*cos(t+a*pos.z);
        return 0.5+0.5*cos(pos.xyz+vec3(1,2,4)); }
      void main(){
        vec2 uv = 2.*vUv - 1.;
        vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime*1.5), vec3(1.5));
        vec3 flame = 1.5*uFlameA*w.x; flame*=w.y; flame += uFlameB*w.z;
        flame *= smoothstep(0.25, 1., abs(uv.y));
        float md = smoothstep(-0.7, 1., -uv.y*uv.x); flame *= md*md;
        vec3 bg = uBg * (1.0 - 0.4 * length(uv));
        vec3 halo = texture2D(haloTexture, vUv).xyz;
        gl_FragColor = vec4(bg + flame*uFlameAmt + texture2D(bloomTexture, vUv).xyz + texture2D(torusTexture, vUv).xyz + texture2D(tDiffuse, vUv).xyz + halo, 1.);
      }`,
  };

  const w = () => window.innerWidth;
  const h = () => window.innerHeight;

  const torusComposer = new EffectComposer(renderer);
  torusComposer.renderToScreen = false;
  torusComposer.addPass(new RenderPass(scene, camera));
  torusComposer.addPass(new ShaderPass(GammaCorrectionShader));
  torusComposer.addPass(new UnrealBloomPass(new THREE.Vector2(w(), h()), 0.22, 0.2, 0));
  torusComposer.addPass(new ShaderPass(CopyShader));

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(w(), h()), 0.5, 0.6, 0));
  bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  const finalPass = new ShaderPass(FinalPass as any);
  finalPass.uniforms.bloomTexture.value = (bloomComposer as any).renderTarget1.texture;
  finalPass.uniforms.torusTexture.value = (torusComposer as any).renderTarget1.texture;
  finalComposer.addPass(finalPass);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.enabled = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = CONFIG.autoRotate;
  controls.minDistance = 3.5;
  controls.maxDistance = 16;
  controls.target.set(0, 0, 0);

  const STOPS_X = [{ p: 0, v: 0 }, { p: 0.32, v: -3.1 }, { p: 0.64, v: 3.2 }, { p: 1, v: 0 }];
  const STOPS_Y = [{ p: 0, v: -4.5 }, { p: 0.32, v: 0.55 }, { p: 0.64, v: 0.45 }, { p: 1, v: 0.15 }];
  const STOPS_S = [{ p: 0, v: 2.15 }, { p: 0.32, v: 1.0 }, { p: 0.64, v: 0.92 }, { p: 1, v: 1.12 }];

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);
  const planetGroup = new THREE.Group();
  planetGroup.rotation.z = CONFIG.tilt;
  worldGroup.add(planetGroup);
  const cloudGroup = new THREE.Group();
  cloudGroup.rotation.z = CONFIG.tilt;
  cloudGroup.visible = false;
  worldGroup.add(cloudGroup);

  worldGroup.position.set(STOPS_X[0].v, STOPS_Y[0].v, 0);
  worldGroup.scale.setScalar(STOPS_S[0].v);

  const planetTime = { v: 0 };
  const cloudTime = { v: 0 };
  const starTime = { v: 0 };
  const markerTime = { v: 0 };

  const glowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uGlow: { value: hexToVec3(CONFIG.glowColor) }, uIntensity: { value: CONFIG.glowIntensity } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uGlow; uniform float uIntensity; varying vec2 vUv;
        void main(){
          float d = length(vUv - 0.5) * 2.0;
          float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
          gl_FragColor = vec4(uGlow * a * uIntensity, a);
        }`,
    }),
  );
  glowMesh.scale.setScalar(CONFIG.planetRadius * 2.3);
  worldGroup.add(glowMesh);

  const ambientPoints = new THREE.Points(
    (function () {
      const g = new THREE.BufferGeometry();
      const positions = new Float32Array(CONFIG.atmoCount * 3);
      const sizes = new Float32Array(CONFIG.atmoCount);
      const seeds = new Float32Array(CONFIG.atmoCount);
      for (let i = 0; i < CONFIG.atmoCount; i++) {
        positions[i * 3] = Math.random() * 2 - 1;
        positions[i * 3 + 1] = Math.random() * 2 - 1;
        positions[i * 3 + 2] = Math.random() * 2 - 1;
        sizes[i] = CONFIG.atmoSize * (0.4 + Math.random());
        seeds[i] = Math.random();
      }
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
      g.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
      return g;
    })(),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uRes: { value: new THREE.Vector2(w(), h()) }, uColor: { value: hexToVec3(CONFIG.atmoColor) },
      },
      vertexShader: `
        attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
        varying float vA;
        vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
          p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
          p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
          return cos(p+vec3(1,2,4)); }
        void main(){
          vec3 v = position*4.0 + warp(position, uTime)*1.2;
          vec4 mv = modelViewMatrix * vec4(v, 1.0);
          float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
          vA = farF * nearF;
          gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying float vA;
        void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
          float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.55); }`,
    }),
  );
  scene.add(ambientPoints);

  const starPoints = new THREE.Points(
    (function () {
      const g = new THREE.BufferGeometry();
      const positions = new Float32Array(CONFIG.starCount * 3);
      const seeds = new Float32Array(CONFIG.starCount);
      const brights = new Float32Array(CONFIG.starCount);
      for (let i = 0; i < CONFIG.starCount; i++) {
        const u = Math.random(), v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = 90;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        seeds[i] = Math.random();
        brights[i] = 0.35 + Math.random() * 0.65;
      }
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
      g.setAttribute("bright", new THREE.BufferAttribute(brights, 1));
      return g;
    })(),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, frustumCulled: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: CONFIG.starSize }, uFlicker: { value: CONFIG.starFlicker },
        uColor: { value: hexToVec3(CONFIG.starColor) }, uRes: { value: new THREE.Vector2(w(), h()) },
      },
      vertexShader: `
        attribute float seed; attribute float bright;
        uniform float uTime; uniform float uSize; uniform float uFlicker; uniform vec2 uRes;
        varying float vTw;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float tw = 0.6 + 0.4 * sin(uTime * uFlicker + seed);
          vTw = bright * tw;
          gl_PointSize = max(uSize * uRes.y / 900.0 * (90.0 / max(-mv.z, 1.0)), 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying float vTw;
        void main(){
          vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
          float core = smoothstep(0.5, 0.0, l);
          gl_FragColor = vec4(uColor, core * vTw);
        }`,
    }),
  );
  scene.add(starPoints);

  const ASSET_BASE = "https://api.getlayers.ai/storage/v1/object/public/public/assets/ascend-d9857ad1f2";
  const PLANET_GLB = `${ASSET_BASE}/planet.glb`;
  const PLANET_LIGHTS_GLB = `${ASSET_BASE}/planet-lights.glb`;
  const PLANET_CLOUDS_PNG = `${ASSET_BASE}/planet-clouds.png`;

  let entryT = 0;
  let planetLoaded = false;
  let spinPhase = 0;
  let curP = 0;
  let curX = STOPS_X[0].v;
  let curY = STOPS_Y[0].v;
  let curS = STOPS_S[0].v;
  const ENTRY_DUR = 1.9;
  const ENTRY_START_Y = -6.5;

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
  loader.setDRACOLoader(draco);

  let nightTex: any = null;

  loader.load(
    PLANET_LIGHTS_GLB,
    (gltf: any) => {
      gltf.scene.traverse((child: any) => {
        if (child.isMesh && child.material && child.material.map) {
          nightTex = child.material.map;
        }
      });
      loader.load(PLANET_GLB, (g2: any) => {
        let planetMesh: any = null;
        g2.scene.traverse((child: any) => {
          if (child.isMesh && !planetMesh) planetMesh = child;
        });
        if (!planetMesh) return;
        planetMesh.geometry.computeBoundingSphere();
        const bs = (planetMesh.geometry as any).boundingSphere;
        if (bs) planetMesh.scale.setScalar(CONFIG.planetRadius / bs.radius);
        const mat = (planetMesh.material as any).clone();
        mat.metalness = 0;
        mat.roughness = 1;
        mat.envMapIntensity = 0;
        mat.onBeforeCompile = (shader: any) => {
          shader.uniforms.time = { value: 0 };
          shader.uniforms.noiseScale = { value: 30 };
          shader.uniforms.speedX = { value: 1.5 };
          shader.uniforms.speedY = { value: 2.0 };
          shader.uniforms.speedZ = { value: 2.5 };
          shader.uniforms.rimColor = { value: hexToVec3(CONFIG.rimColor) };
          shader.uniforms.rimPower = { value: CONFIG.rimPower };
          shader.uniforms.nightBlendTexture = { value: nightTex };
          shader.uniforms.nightLights = { value: CONFIG.nightLights };
          shader.uniforms.terrainDepth = { value: CONFIG.terrainDepth };
          shader.uniforms.terrainShade = { value: CONFIG.terrainShade };
          shader.uniforms.oceanGlint = { value: CONFIG.oceanGlint };
          shader.uniforms.oceanDeep = { value: CONFIG.oceanDeep };
          shader.uniforms.oceanFlow = { value: CONFIG.oceanFlow };
          shader.uniforms.oceanFlowSpeed = { value: CONFIG.oceanFlowSpeed };
          shader.uniforms.oceanFlowScale = { value: CONFIG.oceanFlowScale };
          const planetUniforms = shader.uniforms;
          const planetTimeRef = planetTime;
          const raf = () => {
            planetUniforms.time.value = planetTimeRef.v;
            requestAnimationFrame(raf);
          };
          raf();
          shader.vertexShader = `varying vec2 vCustomUv;\n` + shader.vertexShader.replace("void main(){", "void main(){\nvCustomUv = uv;");
          shader.fragmentShader =
            `uniform float time; uniform float noiseScale; uniform float speedX; uniform float speedY; uniform float speedZ;
            uniform vec3 rimColor; uniform float rimPower; uniform sampler2D nightBlendTexture; uniform float nightLights;
            uniform float terrainDepth; uniform float terrainShade; uniform float oceanGlint; uniform float oceanDeep;
            uniform float oceanFlow; uniform float oceanFlowSpeed; uniform float oceanFlowScale;
            varying vec2 vCustomUv;\n` +
            SNOISE + `\n` +
            shader.fragmentShader.replace(
              "#include <dithering_fragment>",
              `#include <dithering_fragment>
vec3 normalizedNormal = normalize(vNormal);
vec3 viewDir = normalize(vViewPosition);
float rim = 1.0 - max(dot(viewDir, normalizedNormal), 0.0);
rim = pow(rim, rimPower); rim = pow(rim, 1.5); rim *= 0.7;
vec3 currentColor = gl_FragColor.rgb;
float blueDom = currentColor.b - max(currentColor.r, currentColor.g);
float waterMask = clamp(smoothstep(-0.005, 0.03, blueDom), 0.0, 1.0);
float shimmer = snoise(vec3(vCustomUv.x * noiseScale + time * speedX, vCustomUv.y * noiseScale - time * speedY, time * speedZ));
gl_FragColor.rgb += waterMask * shimmer * 0.025;
float fT = time * oceanFlowSpeed * 4.0;
float fS = 4.0 * oceanFlowScale;
float warp = snoise(vec3(vCustomUv.x * fS - fT * 0.5, vCustomUv.y * fS + fT * 0.4, fT * 0.5));
float flow = snoise(vec3(vCustomUv.x * fS * 2.0 + fT * 0.6 + warp, vCustomUv.y * fS * 2.0 - fT * 0.5, fT * 0.7));
flow = warp * 0.6 + flow * 0.4;
gl_FragColor.rgb += waterMask * flow * 0.12 * oceanFlow;
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.01, 0.06, 0.16), waterMask * oceanDeep);
vec3 finalColor = mix(gl_FragColor.rgb, rimColor, rim);
gl_FragColor = vec4(finalColor, 1.0);
vec3 surfPos = -vViewPosition;
float terrH = dot(texture2D(map, vCustomUv).rgb, vec3(0.299, 0.587, 0.114));
vec3 sigX = dFdx(surfPos), sigY = dFdy(surfPos);
vec3 vR1 = cross(sigY, normalizedNormal), vR2 = cross(normalizedNormal, sigX);
float fDet = dot(sigX, vR1);
vec3 vGrad = sign(fDet) * (dFdx(terrH) * vR1 + dFdy(terrH) * vR2);
vec3 bumpedNormal = normalize(abs(fDet) * normalizedNormal - terrainDepth * vGrad);
vec3 shadeNormal = mix(bumpedNormal, normalizedNormal, waterMask);
vec3 cityLights = texture2D(nightBlendTexture, vCustomUv).rgb * gl_FragColor.rgb * nightLights;
vec3 viewSunDir = normalize(vec3(-0.9, 0.18, 0.4));
float ndl = dot(normalizedNormal, viewSunDir);
float dayAmt = smoothstep(-0.05, 0.35, ndl);
float relief = dot(shadeNormal, viewSunDir) - ndl;
gl_FragColor.rgb *= clamp(1.0 + relief * terrainShade * dayAmt, 0.55, 1.6);
float nightFactor  = smoothstep(0.18, -0.30, ndl);
float lightsFactor = smoothstep(0.30, -0.35, ndl);
gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.08, nightFactor);
gl_FragColor.rgb += cityLights * lightsFactor;
vec3 halfDir = normalize(viewSunDir + viewDir);
float ripple = snoise(vec3(vCustomUv * 240.0, time * 4.0));
float ndh = max(dot(normalizedNormal, halfDir) + ripple * 0.02, 0.0);
float glint = pow(ndh, 140.0);
gl_FragColor.rgb += glint * waterMask * dayAmt * oceanGlint * vec3(1.0, 0.97, 0.88);`,
            );
        };
        planetMesh.material = mat;
        planetGroup.add(planetMesh);

        const geo = planetMesh.geometry as any;
        const pos = geo.attributes.position as any;
        const uvAttr = geo.attributes.uv as any;
        const idx = geo.index;
        const triCount = idx ? idx.count / 3 : pos.count / 3;
        const areas: number[] = [];
        let totalArea = 0;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let t = 0; t < triCount; t++) {
          const i0 = idx ? idx.getX(t * 3) : t * 3;
          const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
          const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
          const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;
          areas.push(area);
          totalArea += area;
        }
        const baseTex = (mat as any).map as any;
        let baseImg: HTMLImageElement | null = null;
        if (baseTex && baseTex.image) baseImg = baseTex.image as HTMLImageElement;
        const markers: number[] = [];
        const markerSeeds: number[] = [];
        const tempCanvas = document.createElement("canvas");
        let tempCtx: CanvasRenderingContext2D | null = null;
        if (baseImg && baseImg.complete && baseImg.naturalWidth) {
          tempCanvas.width = baseImg.naturalWidth;
          tempCanvas.height = baseImg.naturalHeight;
          tempCtx = tempCanvas.getContext("2d");
          if (tempCtx) {
            try { tempCtx.drawImage(baseImg, 0, 0); } catch { tempCtx = null; }
          }
        }
        let placed = 0;
        let guard = 0;
        while (placed < CONFIG.markerCount && guard < CONFIG.markerCount * 200) {
          guard++;
          let r = Math.random() * totalArea;
          let tri = 0;
          for (let k = 0; k < areas.length; k++) { r -= areas[k]; if (r <= 0) { tri = k; break; } }
          const i0 = idx ? idx.getX(tri * 3) : tri * 3;
          const i1 = idx ? idx.getX(tri * 3 + 1) : tri * 3 + 1;
          const i2 = idx ? idx.getX(tri * 3 + 2) : tri * 3 + 2;
          const u = Math.random(), v = Math.random();
          const baryU = u + v > 1 ? 1 - u : u;
          const baryV = u + v > 1 ? 1 - v : v;
          const baryW = 1 - baryU - baryV;
          const uvX = uvAttr.getX(i0) * baryU + uvAttr.getX(i1) * baryV + uvAttr.getX(i2) * baryW;
          const uvY = uvAttr.getY(i0) * baryU + uvAttr.getY(i1) * baryV + uvAttr.getY(i2) * baryW;
          if (tempCtx) {
            const px = Math.floor(uvX * tempCanvas.width);
            const py = Math.floor((1 - uvY) * tempCanvas.height);
            const data = tempCtx.getImageData(px, py, 1, 1).data;
            const cr = data[0], cg = data[1], cb = data[2];
            if (cb > cr + 6 && cb > cg + 6) continue;
          }
          a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
          const wp = new THREE.Vector3().addScaledVector(a, baryU).addScaledVector(b, baryV).addScaledVector(c, baryW).multiplyScalar(CONFIG.planetRadius / (bs ? bs.radius : 1)).multiplyScalar(1.012);
          markers.push(wp.x, wp.y, wp.z);
          markerSeeds.push(Math.random());
          placed++;
        }
        const markerGeo = new THREE.BufferGeometry();
        markerGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(markers), 3));
        markerGeo.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(markerSeeds), 1));
        const markerPoints = new THREE.Points(
          markerGeo,
          new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
            uniforms: {
              uTime: { value: 0 }, uColor: { value: hexToVec3(CONFIG.markerColor) }, uSize: { value: CONFIG.markerSize },
              uSpeed: { value: CONFIG.markerSpeed }, uRes: { value: new THREE.Vector2(w(), h()) },
            },
            vertexShader: `
              attribute float seed; uniform float uSize; uniform vec2 uRes;
              varying float vSeed; varying float vFade;
              void main(){
                vSeed = seed;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vec3 vn = normalize(normalMatrix * normalize(position));
                vec3 vd = normalize(-mv.xyz);
                vFade = smoothstep(0.15, 0.5, dot(vn, vd));
                gl_PointSize = max(uSize * uRes.y / 900.0 * (7.0 / max(-mv.z, 1.0)), 2.0);
                gl_Position = projectionMatrix * mv;
              }`,
            fragmentShader: `
              uniform vec3 uColor; uniform float uTime; uniform float uSpeed;
              varying float vSeed; varying float vFade;
              void main(){
                if (vFade <= 0.001) discard;
                vec2 p = gl_PointCoord - 0.5;
                float d = length(p) * 2.0;
                if (d > 1.0) discard;
                float core = smoothstep(0.30, 0.0, d) * 1.2;
                float ph = fract(uTime * uSpeed + vSeed);
                float ring = smoothstep(0.07, 0.0, abs(d - ph)) * (1.0 - ph);
                gl_FragColor = vec4(uColor, clamp(core + ring, 0.0, 1.0) * vFade);
              }`,
          }),
        );
        markerPoints.onBeforeRender = () => {
          (markerPoints.material as any).uniforms.uTime.value = markerTime.v;
        };
        planetMesh.add(markerPoints);

        cloudGroup.visible = true;
        if (!reduceMotion) {
          planetLoaded = true;
        } else {
          planetLoaded = true;
          entryT = 1;
        }
      });
    },
  );

  new THREE.TextureLoader().load(PLANET_CLOUDS_PNG, (tex: any) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    const layers = [
      { hKey: "cloud1Height", oKey: "cloud1Opacity", sKey: "cloud1Spin", ry: 0.0, phase: 0.0 },
      { hKey: "cloud2Height", oKey: "cloud2Opacity", sKey: "cloud2Spin", ry: 2.2, phase: 13.0 },
      { hKey: "cloud3Height", oKey: "cloud3Opacity", sKey: "cloud3Spin", ry: 4.3, phase: 27.0 },
    ] as const;
    layers.forEach((layer) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(CONFIG.planetRadius * (CONFIG as any)[layer.hKey], 64, 64),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      mesh.rotation.y = layer.ry;
      mesh.renderOrder = 2;
      mesh.material.onBeforeCompile = (shader: any) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.noiseScale = { value: 20 };
        shader.uniforms.uSpeedX = { value: 1 };
        shader.uniforms.uSpeedY = { value: 2 };
        shader.uniforms.uSpeedZ = { value: 2 };
        shader.uniforms.uOpacity = { value: (CONFIG as any)[layer.oKey] };
        shader.uniforms.uPhase = { value: layer.phase };
        const cUniforms = shader.uniforms;
        const cloudTimeRef = cloudTime;
        const raf = () => {
          cUniforms.uTime.value = cloudTimeRef.v;
          requestAnimationFrame(raf);
        };
        raf();
        shader.vertexShader = `varying vec2 vCloudUv;\n` + shader.vertexShader.replace("void main(){", "void main(){\nvCloudUv = uv;");
        shader.fragmentShader =
          `uniform float uTime; uniform float noiseScale; uniform float uSpeedX; uniform float uSpeedY; uniform float uSpeedZ; uniform float uOpacity; uniform float uPhase;
          varying vec2 vCloudUv;\n` +
          SNOISE + `\n` +
          shader.fragmentShader.replace(
            "#include <dithering_fragment>",
            `#include <dithering_fragment>
gl_FragColor.rgb = vec3(1.0);
float cloudNoise = snoise(vec3(vCloudUv.x * noiseScale + uTime * uSpeedX + uPhase, vCloudUv.y * noiseScale - uTime * uSpeedY + uPhase, uTime * uSpeedZ + uPhase));
float cloudNdv = max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
float cloudEdge = pow(1.0 - cloudNdv, 3.0);
float cloudMod = mix(cloudNoise, 1.0, cloudEdge);
float cloudNdl = dot(normalize(vNormal), normalize(vec3(-0.9, 0.18, 0.4)));
float cloudDay = 1.0 - smoothstep(0.30, -0.30, cloudNdl) * 0.9;
gl_FragColor.a *= cloudMod * uOpacity * cloudDay;`,
          );
      };
      (mesh as any)._spinKey = layer.sKey;
      cloudGroup.add(mesh);
    });
  });

  ambientPoints.onBeforeRender = () => {
    (ambientPoints.material as any).uniforms.uTime.value = performance.now() * CONFIG.atmoSpeed * 8;
    ambientPoints.position.copy(camera.position);
    finalPass.uniforms.iTime.value = performance.now() * CONFIG.atmoSpeed * 8;
  };
  starPoints.onBeforeRender = () => {
    (starPoints.material as any).uniforms.uTime.value = starTime.v;
  };

  let running = true;
  let last = performance.now();
  const loop = () => {
    if (!running) return;
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05);

    planetTime.v += dt / 12;
    cloudTime.v += dt / 20;
    starTime.v += dt;
    markerTime.v += dt;

    if (planetLoaded && entryT < 1 && !reduceMotion) entryT += dt / ENTRY_DUR;
    if (entryT > 1) entryT = 1;
    const entryY = reduceMotion ? 0 : (1 - Math.pow(1 - Math.min(entryT, 1), 3)) * ENTRY_START_Y;

    const scrollHeight = document.documentElement.scrollHeight;
    const innerHeight = window.innerHeight;
    const pTarget = clamp(window.scrollY / (scrollHeight - innerHeight), 0, 1);
    curP += (pTarget - curP) * Math.min(1, dt * 4.5);
    const sideScale = clamp(innerWidth / 1200, 0.5, 1);
    const tx = sample(STOPS_X, curP) * sideScale;
    const ty = sample(STOPS_Y, curP);
    const ts = sample(STOPS_S, curP);
    curX += (tx - curX) * Math.min(1, dt * 3.2);
    curY += (ty - curY) * Math.min(1, dt * 3.2);
    curS += (ts - curS) * Math.min(1, dt * 3.2);
    worldGroup.position.set(curX, curY + entryY, 0);
    worldGroup.scale.setScalar(curS);

    spinPhase += dt * CONFIG.spin;
    planetGroup.rotation.y = CONFIG.initRotation + spinPhase + curP * Math.PI * 1.6;

    cloudGroup.children.forEach((child: any) => {
      child.rotation.y += dt * Number((CONFIG as any)[(child as any)._spinKey]);
    });

    controls.update();
    glowMesh.quaternion.copy(camera.quaternion);

    camera.layers.set(LAYERS.TORUS_SCENE);
    torusComposer.render();
    camera.layers.set(LAYERS.BLOOM_SCENE);
    bloomComposer.render();
    camera.layers.set(LAYERS.ENTIRE_SCENE);
    finalComposer.render();

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const onResize = () => {
    camera.aspect = w() / h();
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w(), h());
    torusComposer.setPixelRatio(window.devicePixelRatio);
    torusComposer.setSize(w(), h());
    bloomComposer.setPixelRatio(window.devicePixelRatio);
    bloomComposer.setSize(w(), h());
    finalComposer.setPixelRatio(window.devicePixelRatio);
    finalComposer.setSize(w(), h());
    (ambientPoints.material as any).uniforms.uRes.value.set(w(), h());
    (starPoints.material as any).uniforms.uRes.value.set(w(), h());
    scene.traverse((obj: any) => {
      if (obj.material && obj.material.uniforms && obj.material.uniforms.uRes) {
        obj.material.uniforms.uRes.value.set(w(), h());
      }
    });
  };
  window.addEventListener("resize", onResize);
  onResize();

  return () => {
    running = false;
    window.removeEventListener("resize", onResize);
    renderer.dispose();
    scene.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose?.());
        else obj.material.dispose?.();
      }
    });
  };
}
