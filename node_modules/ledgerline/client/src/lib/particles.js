import * as THREE from 'three';

/**
 * The scroll-driven particle field behind the home page.
 *
 * A faithful port of the reference implementation: one swarm of 1,400 points,
 * five target formations, morphed between them by scroll position. Point size,
 * colours, shapes, camera path and easing are kept exactly as specified —
 * notably the material carries no texture, so points render as crisp squares
 * rather than soft sprites.
 *
 * Returns a teardown function. Safe under React StrictMode's double-mount:
 * everything it creates, it disposes.
 */

const INK = 0x0a0b14;
const INDIGO = 0x6c7cff;
const CORAL = 0xff7a59;
const WHITE = 0xf4f6ff;

function easeInOut(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function createParticleField(container, { reducedMotion = false } = {}) {
  if (!container) return () => {};

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    // No WebGL: the page is still perfectly readable without the canvas.
    return () => {};
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(INK, 0.02);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Faint enclosing data-shell, purely atmospheric.
  const shellGeo = new THREE.IcosahedronGeometry(7.5, 1);
  const shellMat = new THREE.MeshBasicMaterial({
    color: INDIGO,
    wireframe: true,
    transparent: true,
    opacity: 0.06,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  scene.add(shell);

  // ---- particle swarm: 5 target formations --------------------------------
  const N = 1400;
  const indigo = new THREE.Color(INDIGO);
  const coral = new THREE.Color(CORAL);
  const white = new THREE.Color(WHITE);

  const makeArrays = () => ({ pos: new Float32Array(N * 3), col: new Float32Array(N * 3) });
  const setP = (arr, i, x, y, z) => {
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  };
  const setC = (arr, i, c) => {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  };

  // Shape 0 — chaotic cloud
  const shapeChaos = makeArrays();
  for (let i = 0; i < N; i++) {
    const dir = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();
    const r = 6.5 * Math.cbrt(Math.random());
    setP(shapeChaos.pos, i, dir.x * r, 2 + dir.y * r * 0.7, dir.z * r);
    setC(shapeChaos.col, i, coral.clone().lerp(indigo, Math.random() * 0.3));
  }

  // Shape 1 — six category clusters in a ring
  const shapeClusters = makeArrays();
  for (let i = 0; i < N; i++) {
    const cat = i % 6;
    const angle = (cat / 6) * Math.PI * 2;
    const cx = Math.cos(angle) * 4;
    const cz = Math.sin(angle) * 4;
    const cy = 1.4 + (cat % 2) * 1.4;
    const jr = 0.7 * Math.cbrt(Math.random());
    const jdir = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();
    setP(shapeClusters.pos, i, cx + jdir.x * jr, cy + jdir.y * jr, cz + jdir.z * jr);
    setC(shapeClusters.col, i, cat % 2 === 0 ? indigo : coral);
  }

  // Shape 2 — bar chart
  const shapeBars = makeArrays();
  const barX = [-6, -3.6, -1.2, 1.2, 3.6, 6];
  const barH = [2.4, 4.1, 1.6, 5.3, 3.0, 4.7];
  for (let i = 0; i < N; i++) {
    const b = i % 6;
    const jx = (Math.random() - 0.5) * 0.9;
    const jz = (Math.random() - 0.5) * 0.9;
    const y = Math.random() * barH[b];
    setP(shapeBars.pos, i, barX[b] + jx, y, jz);
    setC(shapeBars.col, i, b % 2 === 0 ? indigo : coral);
  }

  // Shape 3 — ascending trendline
  const shapeTrend = makeArrays();
  for (let i = 0; i < N; i++) {
    const t = Math.random();
    const x = -7 + t * 14;
    const y = 1 + t * 5 + Math.sin(x * 1.3) * 0.4 + (Math.random() - 0.5) * 0.5;
    const z = (Math.random() - 0.5) * 1.2;
    setP(shapeTrend.pos, i, x, y, z);
    setC(shapeTrend.col, i, indigo.clone().lerp(coral, t));
  }

  // Shape 4 — launch arrow (shaft + burst tip)
  const shapeLaunch = makeArrays();
  for (let i = 0; i < N; i++) {
    if (i < N * 0.7) {
      const t = Math.random();
      const x = -5 + t * 9;
      const y = -1 + t * 6;
      const jx = (Math.random() - 0.5) * 0.5;
      const jy = (Math.random() - 0.5) * 0.5;
      setP(shapeLaunch.pos, i, x + jx, y + jy, (Math.random() - 0.5) * 0.5);
      setC(shapeLaunch.col, i, indigo.clone().lerp(white, t * 0.6));
    } else {
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      const r = 1.3 * Math.cbrt(Math.random());
      setP(shapeLaunch.pos, i, 4 + dir.x * r, 5 + dir.y * r, dir.z * r);
      setC(shapeLaunch.col, i, white.clone().lerp(coral, Math.random() * 0.5));
    }
  }

  const shapes = [shapeChaos, shapeClusters, shapeBars, shapeTrend, shapeLaunch];
  const kfT = [0, 0.25, 0.5, 0.75, 1];

  const geo = new THREE.BufferGeometry();
  const livePos = new Float32Array(N * 3);
  const liveCol = new Float32Array(N * 3);
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(livePos, 3).setUsage(THREE.DynamicDrawUsage)
  );
  geo.setAttribute('color', new THREE.BufferAttribute(liveCol, 3).setUsage(THREE.DynamicDrawUsage));

  // No map and no alphaMap: an untextured point renders as a hard square, which
  // is the crisp look the reference has. Adding a sprite softens them to blurs.
  const material = new THREE.PointsMaterial({
    size: 0.11,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, material);
  scene.add(points);

  // ---- scroll progress (smoothed) -----------------------------------------
  let rawProgress = 0;
  let progress = 0;

  function readScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    rawProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const time = clock.getElapsedTime();
    progress += (rawProgress - progress) * (reducedMotion ? 1 : 0.08);

    // find morph segment
    let segA = 0;
    let segB = 1;
    let localT = 0;
    for (let i = 0; i < kfT.length - 1; i++) {
      if (progress >= kfT[i] && progress <= kfT[i + 1]) {
        segA = i;
        segB = i + 1;
        localT = easeInOut((progress - kfT[i]) / (kfT[i + 1] - kfT[i]));
        break;
      }
    }
    if (progress >= 1) {
      segA = 3;
      segB = 4;
      localT = 1;
    }

    const A = shapes[segA];
    const B = shapes[segB];
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      livePos[i3] = A.pos[i3] + (B.pos[i3] - A.pos[i3]) * localT;
      livePos[i3 + 1] = A.pos[i3 + 1] + (B.pos[i3 + 1] - A.pos[i3 + 1]) * localT;
      livePos[i3 + 2] = A.pos[i3 + 2] + (B.pos[i3 + 2] - A.pos[i3 + 2]) * localT;
      liveCol[i3] = A.col[i3] + (B.col[i3] - A.col[i3]) * localT;
      liveCol[i3 + 1] = A.col[i3 + 1] + (B.col[i3 + 1] - A.col[i3 + 1]) * localT;
      liveCol[i3 + 2] = A.col[i3 + 2] + (B.col[i3 + 2] - A.col[i3 + 2]) * localT;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    // slow turntable camera, with extra yaw as the story progresses
    const spin = reducedMotion ? 0 : time * 0.045;
    const angle = spin + progress * Math.PI * 1.3;
    const radius = 9.5;
    camera.position.set(Math.cos(angle) * radius, 3 + progress * 1.3, Math.sin(angle) * radius);
    camera.lookAt(0, 2.3, 0);

    shell.rotation.y += reducedMotion ? 0 : 0.0012;
    shell.rotation.x += reducedMotion ? 0 : 0.0004;

    renderer.render(scene, camera);
  });

  return function destroy() {
    renderer.setAnimationLoop(null);
    window.removeEventListener('scroll', readScroll);
    window.removeEventListener('resize', resize);
    geo.dispose();
    material.dispose();
    shellGeo.dispose();
    shellMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
