import * as THREE from "three";

import { BACKDROP, CANOPY, CAT, CLOUD, FIT, FOCUS, type Rect } from "./config";

/**
 * A flat painted scene rendered through WebGL.
 *
 * WebGL earns its place here for one reason: the canopy is deformed per-vertex,
 * so leaves at the hanging tips lag behind leaves at the anchor. A CSS
 * transform can only move an element rigidly, which reads as a stiff sheet.
 * The clouds and the cat ride along only because one render loop is cheaper
 * than running CSS animation and WebGL side by side.
 *
 * The camera is orthographic: this is 2D compositing, not a 3D scene.
 */

export type SceneHandle = { destroy: () => void };

function loadTexture(loader: THREE.TextureLoader, url: string) {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Painted cutouts have soft edges; linear filtering keeps them soft rather
  // than crunching them at non-integer scales.
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

const canopyVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;

    // uv.y is 1 at the branch anchor (top) and 0 at the hanging tips, so droop
    // scales displacement from nothing at the anchor to full at the tips.
    float droop = 1.0 - uv.y;

    // Two incommensurate frequencies so the loop never visibly repeats, plus a
    // phase offset along x so a gust travels across the canopy instead of
    // moving every leaf in lockstep.
    float gust =
      sin(uTime * 0.9 + p.x * 2.5) * 0.60 +
      sin(uTime * 1.7 + p.x * 4.1) * 0.25;

    p.x += gust * droop * uAmp;
    p.y += cos(uTime * 1.1 + p.x * 3.0) * droop * uAmp * 0.35;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const catVertex = /* glsl */ `
  uniform float uTime;
  uniform float uBreath;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;

    // Swell from the belly upward: the underside stays planted on the desk
    // while the back rises, which is what breathing actually looks like.
    float rise = uv.y;
    p.y += sin(uTime * 0.85) * uBreath * rise;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const backdropFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  varying vec2 vUv;

  void main() {
    // The plane always fills the viewport; the painting occupies a sub-rect of
    // it. Sampling outside that rect is clamped, so the outermost column of the
    // image stretches out to the frame edge.
    vec2 uv = (vUv - 0.5) * uUvScale + 0.5 + uUvOffset;
    gl_FragColor = texture2D(uMap, clamp(uv, 0.0, 1.0));
  }
`;

const texturedFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.01) discard;
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
  }
`;

const cloudFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uLift;
  varying vec2 vUv;

  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.01) discard;

    // Lift weighted by darkness, so the grey undersides brighten while the
    // sunlit tops stay put. A flat mix toward white would blow the highlights
    // and flatten the cloud into a blob.
    float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    c.rgb = mix(c.rgb, vec3(1.0), uLift * (1.0 - luma));

    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
  }
`;

export function createScene(container: HTMLElement): SceneHandle {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.z = 10;

  // Textures load asynchronously. Without the manager the reduced-motion path
  // draws its single frame before any texture arrives and stays black forever,
  // since there is no loop to draw a later one.
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  const clock = new THREE.Clock();

  // --- backdrop ------------------------------------------------------------
  const backdropUniforms = {
    uMap: { value: loadTexture(loader, BACKDROP.src) },
    uUvScale: { value: new THREE.Vector2(1, 1) },
    uUvOffset: { value: new THREE.Vector2(0, 0) },
  };
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms: backdropUniforms,
      vertexShader: backdropVertex,
      fragmentShader: backdropFragment,
      depthWrite: false,
    }),
  );
  scene.add(backdrop);

  // --- canopy --------------------------------------------------------------
  // Segmented geometry: the wind is a vertex displacement, so the mesh can only
  // bend as finely as it is divided.
  const canopyUniforms = {
    uMap: { value: loadTexture(loader, CANOPY.src) },
    uTime: { value: 0 },
    uAmp: { value: 0 },
    uOpacity: { value: 1 },
  };
  const canopy = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: canopyUniforms,
      vertexShader: canopyVertex,
      fragmentShader: texturedFragment,
      transparent: true,
      depthWrite: false,
    }),
  );
  canopy.position.z = 2;
  scene.add(canopy);

  // --- cat -----------------------------------------------------------------
  const catUniforms = {
    uMap: { value: loadTexture(loader, CAT.src) },
    uTime: { value: 0 },
    uBreath: { value: 0 },
    uOpacity: { value: 1 },
  };
  const cat = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, 8, 8),
    new THREE.ShaderMaterial({
      uniforms: catUniforms,
      vertexShader: catVertex,
      fragmentShader: texturedFragment,
      transparent: true,
      depthWrite: false,
    }),
  );
  cat.position.z = 1.5;
  scene.add(cat);

  // --- clouds --------------------------------------------------------------
  // One cloud texture instanced several times. Each gets its own width, height
  // and speed, so a single sprite reads as a sky full of weather.
  const cloudUniforms = {
    uMap: { value: loadTexture(loader, CLOUD.src) },
    uOpacity: { value: 0.9 },
    uLift: { value: CLOUD.lift },
  };
  const clouds = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms: cloudUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: cloudFragment,
      transparent: true,
      depthWrite: false,
    }),
    CLOUD.count,
  );
  clouds.position.z = 1;
  scene.add(clouds);

  const cloudAspect = CLOUD.w / CLOUD.h;
  const cloudState = Array.from({ length: CLOUD.count }, (_, i) => ({
    x: (i / CLOUD.count) * 2.6 - 1.3,
    y: CLOUD.minY + (((i * 7) % 5) / 5) * 0.46,
    // World-space width, varied widely so they read as weather at different
    // distances rather than one sprite repeated.
    width: 0.34 + ((i * 37) % 11) / 22,
    // World units per second. The sky is ~2.9 units wide at the wrap points,
    // so this is a crossing every 2.5-3 minutes: weather you notice only if you
    // stop and watch for it.
    speed: 0.016 + ((i * 53) % 7) / 1500,
  }));

  // --- layout --------------------------------------------------------------
  // World units: the camera spans -1..1 vertically and -aspect..aspect
  // horizontally, so the backdrop is sized to COVER that box.
  let cover = { w: 2, h: 2 };
  /** World-space shift applied to every backdrop-anchored layer. */
  let panX = 0;
  let panY = 0;

  /** Map a backdrop pixel rect into world space, so a cutout lands exactly
   *  where it was painted however the backdrop is scaled or cropped. */
  function rectToWorld(r: Rect) {
    return {
      w: ((r.r - r.l) / BACKDROP.w) * cover.w,
      h: ((r.b - r.t) / BACKDROP.h) * cover.h,
      cx: (((r.l + r.r) / 2 / BACKDROP.w) - 0.5) * cover.w + panX,
      cy: -(((r.t + r.b) / 2 / BACKDROP.h) - 0.5) * cover.h + panY,
    };
  }

  function place(mesh: THREE.Mesh, r: Rect) {
    const p = rectToWorld(r);
    mesh.scale.set(p.w, p.h, 1);
    mesh.position.setX(p.cx);
    mesh.position.setY(p.cy);
  }

  const scratch = {
    m: new THREE.Matrix4(),
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
  };

  function writeCloudMatrices() {
    cloudState.forEach((s, i) => {
      scratch.pos.set(s.x * cover.w * 0.5, s.y + panY, 0);
      scratch.scale.set(s.width, s.width / cloudAspect, 1);
      scratch.m.compose(scratch.pos, scratch.quat, scratch.scale);
      clouds.setMatrixAt(i, scratch.m);
    });
    clouds.instanceMatrix.needsUpdate = true;
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;

    // updateStyle must stay on. With it off three.js sizes the drawing buffer
    // to w * devicePixelRatio but never writes canvas.style, and a canvas with
    // no CSS size lays out at its attribute size -- so on any display above
    // 100% scaling the canvas renders that much larger than the window and the
    // right and bottom of the scene are clipped away.
    renderer.setSize(w, h);

    const aspect = w / h;
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();

    // Largest scale-down that still keeps every margin within the cap.
    // s >= (1 - maxMargin) * coverScale satisfies the cap; containScale shows
    // the whole painting. Take whichever is larger.
    const containScale = Math.min(w / BACKDROP.w, h / BACKDROP.h);
    const coverScale = Math.max(w / BACKDROP.w, h / BACKDROP.h);
    const scale = Math.max(containScale, (1 - FIT.maxMargin) * coverScale);

    // World units: viewport height spans 2.
    const perPx = 2 / h;
    cover = { w: BACKDROP.w * scale * perPx, h: BACKDROP.h * scale * perPx };

    const planeW = aspect * 2;
    const planeH = 2;

    const focusX =
      aspect < FOCUS.x.threshold ? FOCUS.x.narrow : FOCUS.x.wide;

    // Clamp so a pan can never drag past what actually overflows. When the
    // painting is smaller than the frame there is nothing to pan.
    const slackX = Math.max(0, (cover.w - planeW) / 2);
    const slackY = Math.max(0, (cover.h - planeH) / 2);
    const clamp = (v: number, limit: number) =>
      Math.max(-limit, Math.min(limit, v));

    panX = clamp((0.5 - focusX) * cover.w, slackX);
    panY = clamp((FOCUS.y - 0.5) * cover.h, slackY);

    // The plane covers the viewport; UVs place the painting inside it.
    backdrop.scale.set(planeW, planeH, 1);
    backdrop.position.set(0, 0, 0);
    backdropUniforms.uUvScale.value.set(planeW / cover.w, planeH / cover.h);
    backdropUniforms.uUvOffset.value.set(-panX / cover.w, -panY / cover.h);

    place(canopy, CANOPY.rect);
    place(cat, CAT.rect);

    canopyUniforms.uAmp.value = reduceMotion ? 0 : CANOPY.sway;
    catUniforms.uBreath.value = reduceMotion ? 0 : CAT.breath;

    writeCloudMatrices();
  }

  function renderOnce() {
    renderer.render(scene, camera);
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (reduceMotion) renderOnce();
  });
  ro.observe(container);
  resize();

  // --- loop ----------------------------------------------------------------
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    // getDelta() first: getElapsedTime() calls it internally and resets the
    // clock, so asking in the other order hands back a delta of ~0 and nothing
    // that integrates over time (the clouds) ever moves.
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    canopyUniforms.uTime.value = t;
    catUniforms.uTime.value = t;

    cloudState.forEach((s) => {
      s.x += s.speed * dt;
      if (s.x > 1.45) s.x = -1.45; // wrap once fully off the right edge
    });
    writeCloudMatrices();

    renderOnce();
  }

  if (reduceMotion) {
    // Present but completely static: draw once, after the art has arrived.
    manager.onLoad = renderOnce;
    renderOnce();
  } else {
    frame();
  }

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      backdrop.geometry.dispose();
      canopy.geometry.dispose();
      cat.geometry.dispose();
      clouds.geometry.dispose();
      renderer.domElement.remove();
    },
  };
}
