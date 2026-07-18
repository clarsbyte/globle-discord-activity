import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as d3 from "d3";
import earthUrl from "./assets/earth.jpg?url";

// Equirectangular overlay canvas: Blue Marble base + guessed countries drawn
// with d3, then used as the sphere's texture. SphereGeometry UVs are
// equirectangular, so 2D drawing maps 1:1 onto the globe.
const TEX_W = 4096;
const TEX_H = 2048;
const WIN_COLOR = "#2ac42b";
const CAMERA_DIST = 2.9;

// Cold -> hot gradient: pure white when very far, through pale yellow and
// orange, into red for the hottest guesses
const heatColor = d3
  .scaleSequentialSqrt(
    d3.interpolateRgbBasis(["#ffffff", "#fff5eb", "#fee391", "#fe9929", "#e34a33", "#b30000"])
  )
  .domain([0, 1]);

let renderer;
let scene;
let camera;
let controls;
let sphere;
let texture;
let overlayCtx;
let countries = [];
let guesses = [];
let answerName = null;
let won = false;
let tween = null;
let earthImg = null;

function drawOverlay() {
  overlayCtx.clearRect(0, 0, TEX_W, TEX_H);
  if (earthImg) overlayCtx.drawImage(earthImg, 0, 0, TEX_W, TEX_H);

  const projection = d3
    .geoEquirectangular()
    .translate([TEX_W / 2, TEX_H / 2])
    .scale(TEX_W / (2 * Math.PI));
  const path = d3.geoPath(projection, overlayCtx);

  for (const g of guesses) {
    const name = g.feature.properties.NAME;
    overlayCtx.beginPath();
    path(g.feature);
    overlayCtx.globalAlpha = 0.85;
    overlayCtx.fillStyle =
      won && name === answerName ? WIN_COLOR : heatColor(g.proximity);
    overlayCtx.fill();
    overlayCtx.globalAlpha = 1;
    overlayCtx.strokeStyle = "rgba(0,0,0,0.45)";
    overlayCtx.lineWidth = 3;
    overlayCtx.stroke();
  }
  texture.needsUpdate = true;
}

// Camera-position math: for a point at (lng, lat) to face the viewer, the
// camera sits at Spherical(radius, phi = 90° - lat, theta = lng + 90°).
function sphericalFor(lng, lat) {
  return {
    phi: THREE.MathUtils.degToRad(90 - lat),
    theta: THREE.MathUtils.degToRad(lng + 90),
  };
}

export function initGlobe(container, countryFeatures) {
  countries = countryFeatures;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  // Start facing Europe/Africa
  const start = sphericalFor(10, 18);
  camera.position.setFromSpherical(
    new THREE.Spherical(CAMERA_DIST, start.phi, start.theta)
  );

  // globe.gl-style rotation (same controls the original Globle uses):
  // damping = inertia, clamped poles, no zoom/pan
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.minDistance = 1.5;
  controls.maxDistance = 5;
  controls.zoomSpeed = 0.8;
  controls.enablePan = false;
  controls.rotateSpeed = 0.5;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = THREE.MathUtils.degToRad(15);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(165);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
    tween = null;
  });

  const overlay = document.createElement("canvas");
  overlay.width = TEX_W;
  overlay.height = TEX_H;
  overlayCtx = overlay.getContext("2d");

  texture = new THREE.CanvasTexture(overlay);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 96),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  scene.add(sphere);

  earthImg = new Image();
  earthImg.onload = () => drawOverlay();
  earthImg.src = earthUrl;

  function resize() {
    const size = container.clientWidth || 300;
    renderer.setSize(size, size);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  drawOverlay();

  (function loop() {
    requestAnimationFrame(loop);
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.t0) / tween.duration);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      camera.position.setFromSpherical(
        new THREE.Spherical(
          tween.radius,
          tween.fromPhi + tween.deltaPhi * e,
          tween.fromTheta + tween.deltaTheta * e
        )
      );
      if (t >= 1) {
        tween = null;
        controls.enabled = true;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  })();
}

// Paint all guessed countries by proximity; reveal answer in green on win
export function updateGlobe(nextGuesses, answer, isWon) {
  guesses = nextGuesses;
  answerName = answer ? answer.properties.NAME : null;
  won = isWon;
  drawOverlay();
}

export function resetGlobe() {
  guesses = [];
  answerName = null;
  won = false;
  tween = null;
  controls.autoRotate = true;
  drawOverlay();
}

// Smoothly orbit the camera so the given country faces the viewer
export function spinTo(feature) {
  const [lng, lat] = d3.geoCentroid(feature);
  const clampedLat = Math.max(-70, Math.min(70, lat));
  const target = sphericalFor(lng, clampedLat);

  const current = new THREE.Spherical().setFromVector3(camera.position);
  // shortest path around the sphere
  const deltaTheta =
    THREE.MathUtils.degToRad(
      ((((THREE.MathUtils.radToDeg(target.theta - current.theta)) % 360) + 540) % 360) - 180
    );

  controls.autoRotate = false;
  controls.enabled = false;
  tween = {
    radius: current.radius, // keep the user's zoom level
    fromPhi: current.phi,
    deltaPhi: target.phi - current.phi,
    fromTheta: current.theta,
    deltaTheta,
    t0: performance.now(),
    duration: 750,
  };
}
