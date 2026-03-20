"use client";

import { useEffect, useRef } from "react";

type CanvasConfig = {
  colorA: string;
  colorB: string;
  speed: number;
  density: number;
  background: string;
};

type Props = {
  config: CanvasConfig;
};

const TILE_SIZE = 32;
const GAP = 1;
const CELL = TILE_SIZE + GAP; // 33px per grid slot
const REVEAL_STAGGER = 1200;  // ms for outermost tile to begin appearing (at speed=1)
const TILE_FADE = 500;        // ms each tile takes to fade in
const BREATH_FREQ = (2 * Math.PI) / 3000; // one breath cycle per 3s at speed=1

type Tile = {
  x: number;
  y: number;
  dist: number;  // normalized 0–1, 0 = center, 1 = corner
  r: number;
  g: number;
  b: number;
  phase: number; // random breath phase offset
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

    const [rA, gA, bA] = hexToRgb(config.colorA);
    const [rB, gB, bB] = hexToRgb(config.colorB);

    const buildGrid = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cols = Math.ceil(w / CELL) + 1;
      const rows = Math.ceil(h / CELL) + 1;
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
            x: col * CELL,
            y: row * CELL,
            dist,
            r: Math.round(lerp(rA, rB, dist)),
            g: Math.round(lerp(gA, gB, dist)),
            b: Math.round(lerp(bA, bB, dist)),
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      buildGrid();
      startTime = null; // replay reveal on resize
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (ts: number) => {
      if (startTime === null) startTime = ts;
      const elapsed = (ts - startTime) * config.speed;

      ctx.fillStyle = config.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const t of tiles) {
        const tileStart = t.dist * REVEAL_STAGGER;
        const tileEnd = tileStart + TILE_FADE;

        let opacity: number;

        if (elapsed <= tileStart) {
          opacity = 0;
        } else if (elapsed < tileEnd) {
          // ease-in quad fade
          const p = (elapsed - tileStart) / TILE_FADE;
          opacity = p * p;
        } else {
          // breathing: oscillate between 0.70 and 1.0
          const breathT = elapsed - tileEnd;
          opacity = 0.85 + 0.15 * Math.sin(breathT * BREATH_FREQ + t.phase);
        }

        if (opacity <= 0) continue;

        ctx.fillStyle = `rgba(${t.r},${t.g},${t.b},${opacity.toFixed(3)})`;
        ctx.fillRect(t.x, t.y, TILE_SIZE, TILE_SIZE);
      }

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
