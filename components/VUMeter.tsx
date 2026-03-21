"use client";

import { useRef, useEffect } from "react";
import type { Theme } from "@/lib/themes";

type Props = {
  volume: number;   // 0–1 (live, updated every frame by parent)
  theme: Theme;
};

// ── Constants ─────────────────────────────────────────────────────

const W  = 160;
const H  = 100;
const PX = 80;   // pivot x
const PY = 88;   // pivot y (below arc center so needle sweeps upward)
const R  = 72;   // arc radius

// Total sweep: 100°, centered on vertical
// value=0 → −50° (left), value=1 → +50° (right)
const MIN_ROT = -50;
const MAX_ROT =  50;

// Ballistic time constants (ms)
const ATTACK_TAU  =   5;
const RELEASE_TAU = 300;

// Zone split: right 20% of the 0–1 range is "danger"
const DANGER_THRESHOLD = 0.80;

// Scale marks: [vuLabel, value0to1]
const MAJOR_MARKS: [string, number][] = [
  ["-20", 0.00],
  ["-10", 0.33],
  [ "-7", 0.48],
  [ "-3", 0.67],
  [  "0", 0.83],
  [ "+3", 1.00],
];

const MINOR_MARKS: number[] = [
  // approx value positions for -15, -5, -2, -1, +1, +2
  0.165, 0.575, 0.75, 0.79, 0.875, 0.935,
];

// ── Helpers ───────────────────────────────────────────────────────

/** Convert a 0–1 value to the rotation angle in degrees (0 = straight up). */
function valueToAngle(v: number): number {
  return MIN_ROT + v * (MAX_ROT - MIN_ROT);
}

/** Point on the arc at given angle (degrees, 0 = up) and radius. */
function arcPoint(r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: PX + r * Math.sin(rad), y: PY - r * Math.cos(rad) };
}

/** SVG arc path from angle a1 to a2 (degrees, 0 = up) at radius r. */
function arcPath(r: number, a1: number, a2: number): string {
  const p1 = arcPoint(r, a1);
  const p2 = arcPoint(r, a2);
  // large-arc-flag: 1 if sweep > 180°
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  // sweep-flag: 1 = CW (going right = increasing angle)
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
}

// ── Component ─────────────────────────────────────────────────────

export default function VUMeter({ volume, theme }: Props) {
  const needleRef  = useRef<SVGLineElement>(null);
  const pivotRef   = useRef<SVGCircleElement>(null);
  const rafRef     = useRef<number>(0);
  const displayRef = useRef(0);      // ballistic display value (0–1)
  const lastTRef   = useRef<number | null>(null);

  // Keep a stable ref to the latest volume prop so the rAF loop can read it
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  // Danger angle for zone split
  const dangerAngle = valueToAngle(DANGER_THRESHOLD);

  useEffect(() => {
    const loop = (ts: number) => {
      const dt = lastTRef.current === null ? 0 : ts - lastTRef.current;
      lastTRef.current = ts;

      const target = volumeRef.current;
      const cur    = displayRef.current;

      // Exponential ballistic: fast attack, slow release
      const tau = target > cur ? ATTACK_TAU : RELEASE_TAU;
      const k   = dt > 0 ? 1 - Math.exp(-dt / tau) : 0;
      displayRef.current = cur + (target - cur) * k;

      const angle = valueToAngle(displayRef.current);
      const rad   = (angle * Math.PI) / 180;
      const tipX  = PX + (R - 8) * Math.sin(rad);
      const tipY  = PY - (R - 8) * Math.cos(rad);

      needleRef.current?.setAttribute("x2", String(tipX));
      needleRef.current?.setAttribute("y2", String(tipY));

      // Pivot dot color tracks zone
      if (pivotRef.current) {
        pivotRef.current.setAttribute(
          "fill",
          displayRef.current >= DANGER_THRESHOLD ? theme.meterDanger : theme.accent
        );
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [theme]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>

      <svg
        width={W}
        height={H}
        style={{ display: "block", overflow: "visible" }}
        aria-label="VU Meter"
      >
        {/* ── Background arc (normal zone) ─────────────────────── */}
        <path
          d={arcPath(R, MIN_ROT, dangerAngle)}
          fill="none"
          stroke={theme.accent}
          strokeWidth={3}
          strokeOpacity={0.20}
          strokeLinecap="round"
        />

        {/* ── Background arc (danger zone) ─────────────────────── */}
        <path
          d={arcPath(R, dangerAngle, MAX_ROT)}
          fill="none"
          stroke={theme.meterDanger}
          strokeWidth={3}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />

        {/* ── Minor tick marks ─────────────────────────────────── */}
        {MINOR_MARKS.map((v, i) => {
          const ang  = valueToAngle(v);
          const outer = arcPoint(R - 2,  ang);
          const inner = arcPoint(R - 10, ang);
          return (
            <line
              key={i}
              x1={outer.x} y1={outer.y}
              x2={inner.x} y2={inner.y}
              stroke={v >= DANGER_THRESHOLD ? theme.meterDanger : theme.accent}
              strokeWidth={0.75}
              strokeOpacity={0.50}
            />
          );
        })}

        {/* ── Major tick marks + labels ─────────────────────────── */}
        {MAJOR_MARKS.map(([lbl, v]) => {
          const ang    = valueToAngle(v);
          const outer  = arcPoint(R - 2,  ang);
          const inner  = arcPoint(R - 13, ang);
          const labelP = arcPoint(R - 24, ang);
          const isDanger = v >= DANGER_THRESHOLD;
          const color  = isDanger ? theme.meterDanger : theme.accent;
          return (
            <g key={lbl}>
              <line
                x1={outer.x} y1={outer.y}
                x2={inner.x} y2={inner.y}
                stroke={color}
                strokeWidth={1.25}
                strokeOpacity={0.70}
              />
              <text
                x={labelP.x}
                y={labelP.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                fillOpacity={0.65}
                fontSize={7}
                fontFamily={theme.fontLabel}
                fontWeight={700}
                letterSpacing="0.05em"
              >
                {lbl}
              </text>
            </g>
          );
        })}

        {/* ── Needle ───────────────────────────────────────────── */}
        <line
          ref={needleRef}
          x1={PX}
          y1={PY}
          x2={PX}
          y2={PY - (R - 8)}   // initial: straight up (will be overridden by rAF)
          stroke={theme.accent}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* ── Pivot circle ─────────────────────────────────────── */}
        <circle
          ref={pivotRef}
          cx={PX}
          cy={PY}
          r={4}
          fill={theme.accent}
        />

        {/* ── Pivot rim ────────────────────────────────────────── */}
        <circle
          cx={PX}
          cy={PY}
          r={4}
          fill="none"
          stroke={theme.panelShadow}
          strokeWidth={1}
        />
      </svg>

      {/* ── Label ────────────────────────────────────────────────── */}
      <span
        style={{
          fontFamily:    theme.fontLabel,
          fontSize:      8,
          fontWeight:    700,
          letterSpacing: "0.15em",
          color:         theme.panelLabel,
          textTransform: "uppercase",
          lineHeight:    1,
        }}
      >
        VU
      </span>

    </div>
  );
}
