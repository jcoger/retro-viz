"use client";

import { useEffect, useRef } from "react";

export type PatternType = "concentric" | "radial" | "diagonal" | "noise";

export type CanvasConfig = {
  colorA: string;
  colorB: string;
  speed: number;
  density: number;
  background: string;
  pattern: PatternType;
};

type Props = {
  config: CanvasConfig;
};

// ── Concentric ────────────────────────────────────────────────────
const GAP = 1;
const DENSITY_TILE_SIZES: Record<number, number> = { 1: 48, 2: 32, 3: 16 };
const REVEAL_STAGGER = 1200;
const TILE_FADE = 500;
const BREATH_FREQ = (2 * Math.PI) / 3000;

// ── Diagonal ──────────────────────────────────────────────────────
const DIAG_SPACING = 24;
const DIAG_SPEED = 0.05;

// ── Radial ────────────────────────────────────────────────────────
const RADIAL_COUNT = 24;
const RADIAL_STAGGER = 30;
const RADIAL_GROW = 800;
const RADIAL_HOLD = 300;
const RADIAL_FADE = 600;
const RADIAL_CYCLE =
  (RADIAL_COUNT - 1) * RADIAL_STAGGER + RADIAL_GROW + RADIAL_HOLD + RADIAL_FADE;

// ── Noise ─────────────────────────────────────────────────────────
const NOISE_SCALE = 4;       // render at 1/4 resolution, scale up with smoothing
const NOISE_FREQ = 0.003;    // spatial frequency — lower = bigger blobs
const NOISE_Z_SPEED = 0.0003; // z-axis drift per ms at speed=1

// Perlin noise — module-level, seeded deterministically (initialized once)
const _noiseGrad3 = new Int8Array([
   1, 1, 0,  -1, 1, 0,   1,-1, 0,  -1,-1, 0,
   1, 0, 1,  -1, 0, 1,   1, 0,-1,  -1, 0,-1,
   0, 1, 1,   0,-1, 1,   0, 1,-1,   0,-1,-1,
]);

const _noisePerm = new Uint8Array(512);
const _noisePermMod12 = new Uint8Array(512);

(() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  // Deterministic LCG shuffle (seed=12345) so the field looks the same every load
  let s = 12345;
  const rand = () => { s = Math.imul(s, 1664525) + 1013904223; return (s >>> 0) / 4294967296; };
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) {
    _noisePerm[i] = p[i & 255];
    _noisePermMod12[i] = _noisePerm[i] % 12;
  }
})();

function _fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function perlin3(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = _fade(x), v = _fade(y), w = _fade(z);

  const A  = _noisePerm[X]     + Y;
  const AA = _noisePerm[A]     + Z;
  const AB = _noisePerm[A + 1] + Z;
  const B  = _noisePerm[X + 1] + Y;
  const BA = _noisePerm[B]     + Z;
  const BB = _noisePerm[B + 1] + Z;

  const dot = (idx: number, dx: number, dy: number, dz: number) => {
    const gi = _noisePermMod12[idx] * 3;
    return _noiseGrad3[gi] * dx + _noiseGrad3[gi + 1] * dy + _noiseGrad3[gi + 2] * dz;
  };
  const _l = (a: number, b: number, t: number) => a + t * (b - a);

  return _l(
    _l(_l(dot(AA,     x,     y,     z    ), dot(BA,     x - 1, y,     z    ), u),
       _l(dot(AB,     x,     y - 1, z    ), dot(BB,     x - 1, y - 1, z    ), u), v),
    _l(_l(dot(AA + 1, x,     y,     z - 1), dot(BA + 1, x - 1, y,     z - 1), u),
       _l(dot(AB + 1, x,     y - 1, z - 1), dot(BB + 1, x - 1, y - 1, z - 1), u), v),
    w,
  );
}

// ── Shared helpers ────────────────────────────────────────────────
type Tile = {
  x: number;
  y: number;
  dist: number;
  r: number;
  g: number;
  b: number;
  phase: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// ── Component ─────────────────────────────────────────────────────
export default function MotionCanvas({ config }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let startTime: number | null = null;
    let tiles: Tile[] = [];

    // Noise offscreen surface — rebuilt on resize, reused every frame
    let offCanvas: HTMLCanvasElement | null = null;
    let offCtx: CanvasRenderingContext2D | null = null;
    let noiseData: ImageData | null = null;

    const [rA, gA, bA] = hexToRgb(config.colorA);
    const [rB, gB, bB] = hexToRgb(config.colorB);

    const tileSize = DENSITY_TILE_SIZES[config.density] ?? 32;
    const cellSize = tileSize + GAP;

    const buildGrid = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cols = Math.ceil(w / cellSize) + 1;
      const rows = Math.ceil(h / cellSize) + 1;
      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;
      const maxDist = Math.sqrt(cx * cx + cy * cy);

      tiles = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const dx = col - cx;
          const dy = row - cy;
          const dist = maxDist > 0 ? Math.sqrt(dx * dx + dy * dy) / maxDist : 0;
          tiles.push({
            x: col * cellSize,
            y: row * cellSize,
            dist,
            r: Math.round(lerp(rA, rB, dist)),
            g: Math.round(lerp(gA, gB, dist)),
            b: Math.round(lerp(bA, bB, dist)),
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    const buildNoiseCanvas = () => {
      offCanvas = document.createElement("canvas");
      offCanvas.width  = Math.ceil(canvas.width  / NOISE_SCALE);
      offCanvas.height = Math.ceil(canvas.height / NOISE_SCALE);
      offCtx = offCanvas.getContext("2d");
      // Pre-allocate ImageData once per resize — reused every frame
      if (offCtx) noiseData = offCtx.createImageData(offCanvas.width, offCanvas.height);
    };

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      buildGrid();
      buildNoiseCanvas();
      startTime = null;
    };

    resize();
    window.addEventListener("resize", resize);

    // ── Draw: concentric grid ─────────────────────────────────────
    const drawConcentric = (elapsed: number) => {
      for (const t of tiles) {
        const tileStart = t.dist * REVEAL_STAGGER;
        const tileEnd   = tileStart + TILE_FADE;

        let opacity: number;
        if (elapsed <= tileStart) {
          opacity = 0;
        } else if (elapsed < tileEnd) {
          const p = (elapsed - tileStart) / TILE_FADE;
          opacity = p * p;
        } else {
          const breathT = elapsed - tileEnd;
          opacity = 0.85 + 0.15 * Math.sin(breathT * BREATH_FREQ + t.phase);
        }

        if (opacity <= 0) continue;
        ctx.fillStyle = `rgba(${t.r},${t.g},${t.b},${opacity.toFixed(3)})`;
        ctx.fillRect(t.x, t.y, tileSize, tileSize);
      }
    };

    // ── Draw: radial burst ────────────────────────────────────────
    const drawRadial = (elapsed: number) => {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const maxLen = Math.hypot(cx, cy);
      const cycleT = elapsed % RADIAL_CYCLE;

      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";

      for (let i = 0; i < RADIAL_COUNT; i++) {
        const angle     = (i * (360 / RADIAL_COUNT) * Math.PI) / 180;
        const lineDelay = i * RADIAL_STAGGER;
        const linePhase = cycleT - lineDelay;

        let currentLen: number;
        let opacity: number;

        if (linePhase <= 0) {
          continue;
        } else if (linePhase < RADIAL_GROW) {
          currentLen = maxLen * easeOutCubic(linePhase / RADIAL_GROW);
          opacity = 1;
        } else if (linePhase < RADIAL_GROW + RADIAL_HOLD) {
          currentLen = maxLen;
          opacity = 1;
        } else if (linePhase < RADIAL_GROW + RADIAL_HOLD + RADIAL_FADE) {
          currentLen = maxLen;
          opacity = 1 - (linePhase - RADIAL_GROW - RADIAL_HOLD) / RADIAL_FADE;
        } else {
          continue;
        }

        if (opacity <= 0 || currentLen <= 0) continue;

        const ex   = cx + Math.cos(angle) * maxLen;
        const ey   = cy + Math.sin(angle) * maxLen;
        const grad = ctx.createLinearGradient(cx, cy, ex, ey);
        grad.addColorStop(0, `rgb(${rA},${gA},${bA})`);
        grad.addColorStop(1, `rgb(${rB},${gB},${bB})`);

        ctx.globalAlpha = opacity;
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * currentLen, cy + Math.sin(angle) * currentLen);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    // ── Draw: diagonal scanline ───────────────────────────────────
    const drawDiagonal = (elapsed: number) => {
      const W = canvas.width;
      const H = canvas.height;
      const totalSpan = W + H;
      const offset = (elapsed * DIAG_SPEED) % DIAG_SPACING;
      const ext    = totalSpan;

      ctx.lineWidth = 1.5;
      ctx.lineCap   = "square";

      const iStart = -Math.ceil(H / DIAG_SPACING) - 1;
      const iEnd   =  Math.ceil(W / DIAG_SPACING) + 1;

      for (let i = iStart; i <= iEnd; i++) {
        const k = i * DIAG_SPACING + offset;
        const t = Math.max(0, Math.min(1, (k + H) / totalSpan));
        const r = Math.round(lerp(rA, rB, t));
        const g = Math.round(lerp(gA, gB, t));
        const b = Math.round(lerp(bA, bB, t));

        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(k - ext, -ext);
        ctx.lineTo(k + ext,  ext);
        ctx.stroke();
      }
    };

    // ── Draw: Perlin noise field ──────────────────────────────────
    const drawNoise = (elapsed: number) => {
      if (!offCtx || !offCanvas || !noiseData) return;

      const nW   = offCanvas.width;
      const nH   = offCanvas.height;
      const data = noiseData.data;
      // z drifts slowly — already scaled by config.speed via elapsed
      const z = elapsed * NOISE_Z_SPEED;

      for (let py = 0; py < nH; py++) {
        for (let px = 0; px < nW; px++) {
          const nx = px * NOISE_SCALE * NOISE_FREQ;
          const ny = py * NOISE_SCALE * NOISE_FREQ;

          // perlin3 returns roughly [-0.7, 0.7]; scale to [0, 1]
          const t = Math.max(0, Math.min(1, perlin3(nx, ny, z) * 0.72 + 0.5));

          const idx = (py * nW + px) * 4;
          data[idx    ] = (rA + (rB - rA) * t) | 0;
          data[idx + 1] = (gA + (gB - gA) * t) | 0;
          data[idx + 2] = (bA + (bB - bA) * t) | 0;
          data[idx + 3] = 255;
        }
      }

      offCtx.putImageData(noiseData, 0, 0);

      // Scale up to full canvas — imageSmoothingEnabled (default true) gives
      // the soft blur that makes Perlin blobs look organic rather than pixelated
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
    };

    // ── Main loop ─────────────────────────────────────────────────
    const draw = (ts: number) => {
      if (startTime === null) startTime = ts;
      const elapsed = (ts - startTime) * config.speed;

      if (config.background === "transparent") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = config.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if      (config.pattern === "concentric") drawConcentric(elapsed);
      else if (config.pattern === "radial")     drawRadial(elapsed);
      else if (config.pattern === "diagonal")   drawDiagonal(elapsed);
      else if (config.pattern === "noise")      drawNoise(elapsed);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
