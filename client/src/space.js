// Animated space backdrop: procedurally generated nebula (no image assets),
// twinkling stars with a few bright flare stars, and occasional shooting stars.

const STAR_COUNT = 110;

// --- seeded PRNG + value noise -------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseGrid(rand, size) {
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return g;
}

function sampleGrid(g, size, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let xf = x - xi;
  let yf = y - yi;
  xf = xf * xf * (3 - 2 * xf);
  yf = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % size) + size) % size;
  const y0 = ((yi % size) + size) % size;
  const x1 = (x0 + 1) % size;
  const y1 = (y0 + 1) % size;
  const v00 = g[y0 * size + x0];
  const v10 = g[y0 * size + x1];
  const v01 = g[y1 * size + x0];
  const v11 = g[y1 * size + x1];
  return v00 + (v10 - v00) * xf + (v01 - v00) * yf + (v00 - v10 - v01 + v11) * xf * yf;
}

function fbm(g, size, x, y, octaves) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += sampleGrid(g, size, x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// --- nebula: rendered once at low res, then upscaled for a cloudy look ----
function paintNebula(canvas) {
  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);
  const ctx = canvas.getContext("2d");

  const LW = 360;
  const LH = Math.max(1, Math.round((LW * h) / w));
  const off = document.createElement("canvas");
  off.width = LW;
  off.height = LH;
  const offCtx = off.getContext("2d");
  const img = offCtx.createImageData(LW, LH);
  const px = img.data;

  const rand = mulberry32(1337);
  const gridA = noiseGrid(rand, 64); // main cloud
  const gridB = noiseGrid(rand, 64); // secondary cloud

  const aspect = w / h;
  for (let y = 0; y < LH; y++) {
    for (let x = 0; x < LW; x++) {
      const u = x / LW;
      const v = y / LH;
      const nx = u * 3 * aspect;
      const ny = v * 3;

      // spatial masks so nebulae pool in regions, leaving open black space
      const maskA = Math.exp(-(((u - 0.22) ** 2) / 0.11 + ((v - 0.25) ** 2) / 0.18));
      const maskB = Math.exp(-(((u - 0.8) ** 2) / 0.1 + ((v - 0.8) ** 2) / 0.12));

      let dA = fbm(gridA, 64, nx, ny, 5);
      let dB = fbm(gridB, 64, nx * 1.4 + 9.2, ny * 1.4 + 4.7, 5);

      // wispy, high-contrast clouds
      dA = Math.pow(dA, 2.6) * maskA * 2.0;
      dB = Math.pow(dB, 2.8) * maskB * 1.6;

      // single cool blue family — subdued, near-monochrome
      const d = Math.min(1, dA + dB);
      let r = 6 + d * 26;
      let g = 9 + d * 34;
      let b = 20 + d * 78;

      // gentle vignette to sink the edges into black
      const dx = u - 0.5;
      const dy = v - 0.5;
      const vig = 1 - Math.min(0.45, (dx * dx + dy * dy) * 0.9);
      const i = (y * LW + x) * 4;
      px[i] = Math.min(255, r * vig);
      px[i + 1] = Math.min(255, g * vig);
      px[i + 2] = Math.min(255, b * vig);
      px[i + 3] = 255;
    }
  }
  offCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, w, h);
}

export function initSpace() {
  const nebula = document.querySelector("#nebula");
  const canvas = document.querySelector("#stars");
  const ctx = canvas.getContext("2d");

  let w;
  let h;
  let stars = [];
  let meteors = [];
  let nextMeteorAt = performance.now() + 4000;
  let resizeTimer = null;

  function resize() {
    w = canvas.width = window.innerWidth * window.devicePixelRatio;
    h = canvas.height = window.innerHeight * window.devicePixelRatio;
    stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (0.3 + Math.random() * 1.1) * window.devicePixelRatio,
      base: 0.35 + Math.random() * 0.55,
      speed: 0.4 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      bright: i < 7, // a few stars get diffraction spikes
    }));
    // nebula is static; regenerate at the new aspect, debounced
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => paintNebula(nebula), 200);
  }
  window.addEventListener("resize", resize);
  resize();
  paintNebula(nebula);

  function spawnMeteor(now) {
    const fromLeft = Math.random() < 0.5;
    const angle = (fromLeft ? 1 : -1) * (0.35 + Math.random() * 0.3);
    meteors.push({
      x: fromLeft ? -50 : w + 50,
      y: Math.random() * h * 0.4,
      vx: Math.cos(angle) * (fromLeft ? 1 : -1) * w * 0.9,
      vy: Math.sin(Math.abs(angle)) * w * 0.9,
      born: now,
      life: 700 + Math.random() * 400,
    });
    nextMeteorAt = now + 6000 + Math.random() * 9000;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    ctx.clearRect(0, 0, w, h);

    // stars
    for (const s of stars) {
      const alpha = s.base * (0.55 + 0.45 * Math.sin((now / 1000) * s.speed + s.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.bright) {
        // diffraction spikes
        const len = s.r * 9;
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = "#dfe8ff";
        ctx.lineWidth = 0.8 * window.devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(s.x - len, s.y);
        ctx.lineTo(s.x + len, s.y);
        ctx.moveTo(s.x, s.y - len);
        ctx.lineTo(s.x, s.y + len);
        ctx.stroke();
      }
    }

    // shooting stars
    if (now >= nextMeteorAt) spawnMeteor(now);
    meteors = meteors.filter((m) => now - m.born < m.life);
    for (const m of meteors) {
      const t = (now - m.born) / m.life;
      const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      const x = m.x + m.vx * t;
      const y = m.y + m.vy * t;
      const tail = 0.06;
      const grad = ctx.createLinearGradient(x - m.vx * tail, y - m.vy * tail, x, y);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6 * window.devicePixelRatio;
      ctx.beginPath();
      ctx.moveTo(x - m.vx * tail, y - m.vy * tail);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
}
