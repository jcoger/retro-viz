"use client";

import { useRef, useEffect, useMemo } from "react";
import type { Theme } from "@/lib/themes";

type Props = {
  volume: number;   // 0–1, updated every frame by parent
  label: string;
  theme: Theme;
};

// ── Constants ─────────────────────────────────────────────────────
const BEAT_THRESHOLD = 0.15;   // volume must exceed rolling avg by this to trigger
const BEAT_COOLDOWN  = 80;     // ms minimum between flashes (prevents re-trigger on sustained loud)
const AVG_TAU        = 300;    // ms — how fast the rolling average tracks volume level
const DECAY_TAU      = 200;    // ms — brightness half-life after a flash
const DIM_THRESHOLD  = 0.05;   // brightness below this → snap to accentDim with no glow

// ── Helper ────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ── Component ─────────────────────────────────────────────────────

export default function LEDIndicator({ volume, label, theme }: Props) {
  const ledRef        = useRef<HTMLDivElement>(null);
  const rafRef        = useRef<number>(0);
  const lastTRef      = useRef<number | null>(null);
  const brightnessRef = useRef(0);
  const avgRef        = useRef(0);     // exponential rolling average of volume
  const lastBeatRef   = useRef(0);     // timestamp of last triggered flash

  // Keep a stable ref so the rAF loop always reads the latest prop
  const volumeRef   = useRef(volume);
  volumeRef.current = volume;

  // Parse accent hex once per theme change — avoids per-frame string parsing
  const [r, g, b] = useMemo(() => hexToRgb(theme.accent), [theme.accent]);

  useEffect(() => {
    const loop = (ts: number) => {
      const dt = lastTRef.current === null ? 0 : ts - lastTRef.current;
      lastTRef.current = ts;

      const v = volumeRef.current;

      // ── Rolling average (tracks overall volume level) ──────────
      if (dt > 0) {
        const kAvg  = 1 - Math.exp(-dt / AVG_TAU);
        avgRef.current += (v - avgRef.current) * kAvg;
      }

      // ── Beat detection ─────────────────────────────────────────
      // Trigger when current volume jumps above the rolling avg by BEAT_THRESHOLD,
      // with a cooldown so a sustained loud passage doesn't re-trigger every frame.
      if (
        v > avgRef.current + BEAT_THRESHOLD &&
        ts - lastBeatRef.current > BEAT_COOLDOWN
      ) {
        brightnessRef.current = 1;
        lastBeatRef.current   = ts;
      }

      // ── Exponential decay ──────────────────────────────────────
      // Instant on, slow fade — characteristic of a physical lamp.
      if (dt > 0 && brightnessRef.current > 0) {
        brightnessRef.current *= Math.exp(-dt / DECAY_TAU);
        if (brightnessRef.current < 0.01) brightnessRef.current = 0;
      }

      // ── Write to DOM (bypasses React reconciliation) ───────────
      const led = ledRef.current;
      if (led) {
        const bri = brightnessRef.current;
        if (bri > DIM_THRESHOLD) {
          led.style.background = `rgb(${r}, ${g}, ${b})`;
          led.style.boxShadow  =
            `0 0 6px rgba(${r}, ${g}, ${b}, ${bri}), ` +
            `0 0 12px rgba(${r}, ${g}, ${b}, ${bri * 0.55})`;
        } else {
          led.style.background = theme.accentDim;
          led.style.boxShadow  = "none";
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [r, g, b, theme.accentDim]);

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           5,
        userSelect:    "none",
      }}
    >

      {/* ── LED dot ───────────────────────────────────────────────── */}
      <div
        ref={ledRef}
        style={{
          width:        8,
          height:       8,
          borderRadius: "50%",
          flexShrink:   0,
          background:   theme.accentDim,  // initial state; overridden by rAF
          boxShadow:    "none",
        }}
      />

      {/* ── Label ─────────────────────────────────────────────────── */}
      <span
        style={{
          fontFamily:    theme.fontLabel,
          fontSize:      8,
          fontWeight:    700,
          letterSpacing: "0.15em",
          color:         theme.panelLabel,
          textTransform: "uppercase",
          whiteSpace:    "nowrap",
          lineHeight:    1,
        }}
      >
        {label}
      </span>

    </div>
  );
}
