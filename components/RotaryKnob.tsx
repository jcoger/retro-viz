"use client";

import { useState, useId } from "react";
import type { Theme } from "@/lib/themes";

type Props = {
  value: number;               // 0–1
  onChange: (v: number) => void;
  label: string;
  theme: Theme;
  readout?: string;            // override the default 0–100 display
};

// ── Constants ─────────────────────────────────────────────────────
const SENSITIVITY = 0.005;    // value units per px of vertical drag (200px = full range)
const SWEEP_DEG   = 270;      // total rotational arc
const START_DEG   = -135;     // 7 o'clock at value=0, 5 o'clock at value=1

const CX = 24;
const CY = 24;
const R  = 22;                // outer ring radius
const TICK_OUTER = 5;         // px from SVG edge (inner end of tick from top)
const TICK_INNER = 14;        // px from SVG edge (outer end of tick from top)

// ── Component ─────────────────────────────────────────────────────

export default function RotaryKnob({ value, onChange, label, theme, readout }: Props) {
  const uid      = useId();
  const gradId   = `${uid}-g`;
  const [pressed, setPressed] = useState(false);

  const rotation  = START_DEG + value * SWEEP_DEG;
  const displayed = readout ?? String(Math.round(value * 100));

  // ── Mouse drag ────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setPressed(true);

    const y0 = e.clientY;
    const v0 = value;

    const onMove = (ev: MouseEvent) => {
      // drag up (+delta) → increase value
      const delta = y0 - ev.clientY;
      onChange(Math.max(0, Math.min(1, v0 + delta * SENSITIVITY)));
    };
    const onUp = () => {
      setPressed(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  // ── Touch drag ────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();   // prevent scroll stealing

    const y0 = e.touches[0].clientY;
    const v0 = value;
    setPressed(true);

    const onMove = (ev: TouchEvent) => {
      const delta = y0 - ev.touches[0].clientY;
      onChange(Math.max(0, Math.min(1, v0 + delta * SENSITIVITY)));
    };
    const onEnd = () => {
      setPressed(false);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend",  onEnd);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend",  onEnd);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        userSelect: "none",
      }}
    >

      {/* ── Readout ─────────────────────────────────────────── */}
      <span
        style={{
          fontFamily:    theme.fontDisplay,
          fontSize:      9,
          letterSpacing: "0.10em",
          color:         theme.textSecondary,
          minWidth:      28,
          textAlign:     "center",
          lineHeight:    1,
        }}
      >
        {displayed}
      </span>

      {/* ── Knob ────────────────────────────────────────────── */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          width:       48,
          height:      48,
          cursor:      "ns-resize",
          touchAction: "none",
          transform:   pressed ? "scale(0.97)" : "scale(1)",
          transition:  "transform 0.08s ease",
        }}
      >
        <svg
          width={48}
          height={48}
          style={{ display: "block", overflow: "visible" }}
          role="slider"
          aria-label={label}
          aria-valuenow={Math.round(value * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <defs>
            {/*
              Centered radial gradient — dark at center, slightly lighter rim.
              Reads as a concave dish: the face of a physical knob.
            */}
            <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={theme.panelShadow}    />
              <stop offset="62%"  stopColor={theme.panelBg}        />
              <stop offset="100%" stopColor={theme.panelHighlight} />
            </radialGradient>
          </defs>

          {/* Body — filled with gradient */}
          <circle cx={CX} cy={CY} r={R} fill={`url(#${gradId})`} />

          {/* Outer accent ring */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={theme.accent}
            strokeWidth={1}
            strokeOpacity={0.35}
          />

          {/* Inner groove — subtle depth ring */}
          <circle
            cx={CX} cy={CY} r={18.5}
            fill="none"
            stroke={theme.panelHighlight}
            strokeWidth={0.5}
            strokeOpacity={0.55}
          />

          {/*
            Tick mark — 1.5px, accent color.
            The line is drawn pointing "up" (12 o'clock) in SVG coordinates,
            then the group is rotated to the value position.
            START_DEG=−135 puts value=0 at 7 o'clock;
            rotating 270° total puts value=1 at 5 o'clock.
          */}
          <g transform={`rotate(${rotation}, ${CX}, ${CY})`}>
            <line
              x1={CX} y1={TICK_OUTER}
              x2={CX} y2={TICK_INNER}
              stroke={theme.accent}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </g>

          {/* Centre pip — anchors the tick visually */}
          <circle cx={CX} cy={CY} r={2.5} fill={theme.panelShadow} />

        </svg>
      </div>

      {/* ── Label ───────────────────────────────────────────── */}
      <span
        style={{
          fontFamily:    theme.fontLabel,
          fontSize:      8,
          fontWeight:    700,
          letterSpacing: "0.15em",
          color:         theme.panelLabel,
          textTransform: "uppercase",
          textAlign:     "center",
          whiteSpace:    "nowrap",
          lineHeight:    1,
        }}
      >
        {label}
      </span>

    </div>
  );
}
