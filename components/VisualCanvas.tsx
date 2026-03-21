"use client";

import { useEffect, useRef } from "react";
import type { Theme } from "@/lib/themes";

// ── Types ─────────────────────────────────────────────────────────

export type VisualMode = "oscilloscope" | "spectrum" | "radar" | "stars";

// Frequency band slices for each oscilloscope beam
const BEAM_BANDS: [number, number][] = [
  [0,   255], // beam 1 — full range
  [0,    63], // beam 2 — bass
  [64,  127], // beam 3 — mid
  [128, 255], // beam 4 — treble
];

type Props = {
  frequencyData:  Uint8Array<ArrayBuffer>;
  timeDomainData: Uint8Array<ArrayBuffer>;
  beamCount:  1 | 2 | 4;
  beamSpread: number;   // 0–1
  sensitivity: number;  // 0–1 — scales drawn amplitude
  speed:       number;  // 0–1 — multiplies elapsed animation time
  zoom:        number;  // 0–1 — ctx.scale factor around center
  mode:        VisualMode;
  scanlines:   boolean; // overrides theme.scanlines
  theme:       Theme;
};

// ── Helpers ───────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function beamCenterY(b: number, N: number, h: number, spread: number): number {
  if (N === 1) return h / 2;
  const fraction = b / (N - 1);
  const spreadY  = h * 0.1 + fraction * h * 0.8;
  return h / 2 + (spreadY - h / 2) * spread;
}

function beamAmplitude(h: number, N: number, spread: number): number {
  const base = (h / 2) * 0.30;
  if (N <= 1) return base;
  const gap = (h * 0.8) / (N - 1);
  return base + (gap * 0.40 - base) * spread;
}

// ── Component ─────────────────────────────────────────────────────

export default function VisualCanvas({
  frequencyData,
  timeDomainData,
  beamCount,
  beamSpread,
  sensitivity,
  speed,
  zoom,
  mode,
  scanlines,
  theme,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  // Refs for frequently-changing props — read in the rAF loop without restarting the effect
  const sensitivityRef = useRef(sensitivity);
  const speedRef       = useRef(speed);
  const zoomRef        = useRef(zoom);
  const modeRef        = useRef(mode);
  const scanlinesRef   = useRef(scanlines);

  // Updated every render so the rAF loop always sees the latest value
  sensitivityRef.current = sensitivity;
  speedRef.current       = speed;
  zoomRef.current        = zoom;
  modeRef.current        = mode;
  scanlinesRef.current   = scanlines;

  // Persistent animation state (survives mode switches)
  const elapsedRef = useRef(0);
  const prevTsRef  = useRef<number | null>(null);
  // Stars: seeded on canvas resize, re-used across frames
  const starsRef   = useRef<{ x: number; y: number; z: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const [bgR, bgG, bgB] = hexToRgb(theme.screenBg);

    const resize = () => {
      canvas.width  = window.visualViewport?.width  ?? window.innerWidth;
      canvas.height = window.visualViewport?.height ?? window.innerHeight;
      // Re-seed star field whenever canvas size changes
      starsRef.current = Array.from({ length: 220 }, () => ({
        x: (Math.random() - 0.5) * canvas.width,
        y: (Math.random() - 0.5) * canvas.height,
        z: Math.random() * canvas.width,
      }));
    };

    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);

    // ── Main rAF loop ─────────────────────────────────────────────
    const draw = (ts: number) => {
      const dt = prevTsRef.current === null ? 0 : ts - prevTsRef.current;
      prevTsRef.current = ts;

      const w    = canvas.width;
      const h    = canvas.height;
      const sens = sensitivityRef.current;
      const zm   = zoomRef.current;

      // Advance elapsed time, speed-scaled
      // speed=0.5 → real-time, 0 → nearly paused, 1 → 2× speed
      elapsedRef.current += dt * (speedRef.current * 2);

      // ── Phosphor trail ─────────────────────────────────────────
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle   = `rgb(${bgR}, ${bgG}, ${bgB})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      // ── Zoom transform ──────────────────────────────────────────
      // zm=0 → 0.5×, zm=0.5 → 1.0×, zm=1 → 1.5×
      const zoomScale = 0.5 + zm * 1.0;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-w / 2, -h / 2);

      // ── Mode dispatch ───────────────────────────────────────────
      switch (modeRef.current) {

        // ── Oscilloscope ──────────────────────────────────────────
        case "oscilloscope": {
          const amp = beamAmplitude(h, beamCount, beamSpread) * (sens * 2);
          ctx.shadowColor = theme.accent;
          ctx.shadowBlur  = 8;
          ctx.lineWidth   = 1.5;
          ctx.lineCap     = "round";
          ctx.lineJoin    = "round";

          for (let b = 0; b < beamCount; b++) {
            const [bandStart, bandEnd] = BEAM_BANDS[b];
            const bandLen  = bandEnd - bandStart + 1;
            const centerY  = beamCenterY(b, beamCount, h, beamSpread);
            ctx.globalAlpha = b === 0 ? 1.0 : 0.7;
            ctx.strokeStyle = theme.accent;
            ctx.beginPath();

            const STEPS = 256;
            for (let i = 0; i < STEPS; i++) {
              const x      = (i / (STEPS - 1)) * w;
              const srcIdx = bandStart + Math.round((i / (STEPS - 1)) * (bandLen - 1));
              const raw    = timeDomainData[srcIdx] ?? 128;
              const sample = raw / 128.0 - 1.0;
              const y      = centerY + sample * amp;
              if (i === 0) ctx.moveTo(x, y);
              else         ctx.lineTo(x, y);
            }
            ctx.stroke();
          }

          ctx.globalAlpha = 1;
          ctx.shadowBlur  = 0;
          break;
        }

        // ── Spectrum ──────────────────────────────────────────────
        case "spectrum": {
          const BAR_COUNT = 64;
          const barW      = w / BAR_COUNT;
          const gap       = Math.max(1, barW * 0.15);

          ctx.shadowColor = theme.accent;
          ctx.shadowBlur  = 6;

          for (let i = 0; i < BAR_COUNT; i++) {
            const bStart = Math.floor((i / BAR_COUNT) * frequencyData.length);
            const bEnd   = Math.floor(((i + 1) / BAR_COUNT) * frequencyData.length);
            let   sum    = 0;
            for (let j = bStart; j < bEnd; j++) sum += frequencyData[j];
            const avg  = sum / Math.max(1, bEnd - bStart);

            const barH = (avg / 255) * h * 0.85 * (sens * 2);
            const x    = i * barW + gap / 2;

            ctx.fillStyle   = avg > 200 ? theme.meterDanger : theme.accent;
            ctx.globalAlpha = 0.88;
            ctx.fillRect(x, h - barH, barW - gap, barH);

            // Peak cap
            ctx.globalAlpha = 0.50;
            ctx.fillRect(x, h - barH - 2, barW - gap, 2);
          }

          ctx.globalAlpha = 1;
          ctx.shadowBlur  = 0;
          break;
        }

        // ── Radar ─────────────────────────────────────────────────
        case "radar": {
          const cx  = w / 2;
          const cy  = h / 2;
          const rad = Math.min(w, h) * 0.42;

          ctx.lineWidth   = 1;
          ctx.strokeStyle = theme.accent;
          ctx.shadowBlur  = 0;

          // Concentric range rings
          for (let r = 1; r <= 4; r++) {
            ctx.globalAlpha = 0.12;
            ctx.beginPath();
            ctx.arc(cx, cy, (rad / 4) * r, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Crosshairs
          ctx.globalAlpha = 0.12;
          ctx.beginPath();
          ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy);
          ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad);
          ctx.stroke();

          // Sweep line + fading trail
          const sweepAngle = (elapsedRef.current / 1500) % (Math.PI * 2);
          const TRAIL = 32;
          for (let t = TRAIL; t >= 0; t--) {
            const tAngle = sweepAngle - t * 0.05;
            ctx.globalAlpha = (1 - t / TRAIL) * 0.65;
            ctx.lineWidth   = t === 0 ? 1.5 : 0.8;
            ctx.shadowBlur  = t === 0 ? 8 : 0;
            ctx.shadowColor = theme.accent;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + rad * Math.cos(tAngle), cy + rad * Math.sin(tAngle));
            ctx.stroke();
          }

          // Frequency blips near the sweep line
          ctx.shadowColor = theme.accent;
          ctx.shadowBlur  = 4;
          ctx.fillStyle   = theme.accent;
          for (let i = 0; i < 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            const diff  = Math.abs(((angle - sweepAngle) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
            if (diff > 0.28) continue;

            const mag   = (frequencyData[Math.floor((i / 64) * frequencyData.length)] ?? 0) / 255;
            const blipR = rad * 0.12 + rad * 0.82 * mag * (sens * 2);
            ctx.globalAlpha = 0.85 * (1 - diff / 0.28);
            ctx.beginPath();
            ctx.arc(cx + blipR * Math.cos(angle), cy + blipR * Math.sin(angle), 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalAlpha = 1;
          ctx.shadowBlur  = 0;
          break;
        }

        // ── Stars ─────────────────────────────────────────────────
        case "stars": {
          const stars  = starsRef.current;
          const cx     = w / 2;
          const cy     = h / 2;

          // Average volume drives warp speed
          let volSum = 0;
          for (let i = 0; i < frequencyData.length; i++) volSum += frequencyData[i];
          const avgVol  = volSum / frequencyData.length / 255;
          const warpSpd = 0.04 + sens * 0.25 + avgVol * 0.6;

          ctx.shadowColor = theme.accent;

          for (const star of stars) {
            star.z -= warpSpd * speedRef.current * 80;
            if (star.z <= 0) {
              star.z = w;
              star.x = (Math.random() - 0.5) * w;
              star.y = (Math.random() - 0.5) * h;
            }

            const px  = (star.x / star.z) * w * 0.5 + cx;
            const py  = (star.y / star.z) * h * 0.5 + cy;
            const sz  = Math.max(0.3, (1 - star.z / w) * 3.5);
            const bri = 1 - star.z / w;

            ctx.globalAlpha = Math.min(1, bri * 1.5);
            ctx.shadowBlur  = sz * 3;
            ctx.fillStyle   = theme.accent;
            ctx.beginPath();
            ctx.arc(px, py, sz, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalAlpha = 1;
          ctx.shadowBlur  = 0;
          break;
        }
      }

      ctx.restore(); // end zoom transform

      // ── Scanlines (drawn outside zoom so they tile the full canvas) ──
      if (scanlinesRef.current) {
        ctx.globalAlpha = theme.scanlinesOpacity;
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth   = 1;
        ctx.shadowBlur  = 0;
        ctx.beginPath();
        for (let y = 0.5; y < h; y += 3) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  // frequencyData, timeDomainData, sensitivity, speed, zoom, mode, scanlines
  // are all read via mutable refs — no effect restart needed when they change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beamCount, beamSpread, theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
