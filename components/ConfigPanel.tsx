"use client";

import { useState } from "react";
import type { CanvasConfig, PatternType } from "./MotionCanvas";

type Props = {
  config: CanvasConfig;
  onChange: (config: CanvasConfig) => void;
};

const PATTERNS: { label: string; value: PatternType }[] = [
  { label: "Concentric", value: "concentric" },
  { label: "Radial",     value: "radial"     },
  { label: "Diagonal",   value: "diagonal"   },
  { label: "Noise",      value: "noise"      },
];

const BG_OPTIONS = [
  { label: "Dark",        value: "#000000"     },
  { label: "Light",       value: "#f2f0ec"     },
  { label: "Transparent", value: "transparent" },
];

export default function ConfigPanel({ config, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const update = (partial: Partial<CanvasConfig>) =>
    onChange({ ...config, ...partial });

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(600px, 96vw)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Collapse toggle — always visible */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
        style={{
          background: "none",
          border: "none",
          padding: "8px 0 6px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronIcon up={!collapsed} />
      </button>

      {/* Main panel */}
      <div
        style={{
          width: "100%",
          background: "rgba(8, 8, 8, 0.78)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderBottom: "none",
          borderRadius: "14px 14px 0 0",
          padding: collapsed ? 0 : "18px 20px 22px",
          maxHeight: collapsed ? 0 : 300,
          overflow: "hidden",
          transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1), padding 0.28s",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Row 1: Color pickers + sliders */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
          <ColorSwatch
            label="Color A"
            value={config.colorA}
            onChange={(v) => update({ colorA: v })}
          />
          <ColorSwatch
            label="Color B"
            value={config.colorB}
            onChange={(v) => update({ colorB: v })}
          />
          <RangeSlider
            label="Speed"
            value={config.speed}
            min={0.5}
            max={2}
            step={0.1}
            display={config.speed.toFixed(1) + "×"}
            onChange={(v) => update({ speed: v })}
          />
          <RangeSlider
            label="Density"
            value={config.density}
            min={1}
            max={3}
            step={1}
            display={["Low", "Mid", "High"][config.density - 1]}
            onChange={(v) => update({ density: v })}
          />
        </div>

        {/* Row 2: Pattern pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {PATTERNS.map((p) => (
            <PillButton
              key={p.value}
              label={p.label}
              active={config.pattern === p.value}
              onClick={() => update({ pattern: p.value })}
            />
          ))}
        </div>

        {/* Row 3: Background toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={labelStyle}>Background</span>
          <div style={{ display: "flex", gap: 6 }}>
            {BG_OPTIONS.map((opt) => (
              <PillButton
                key={opt.value}
                label={opt.label}
                active={config.background === opt.value}
                onClick={() => update({ background: opt.value })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={labelStyle}>{label}</span>
      <label style={{ position: "relative", width: 40, height: 26, cursor: "pointer", display: "block" }}>
        <div
          style={{
            width: 40,
            height: 26,
            borderRadius: 6,
            background: value,
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            width: "100%",
            height: "100%",
            cursor: "pointer",
            padding: 0,
            border: "none",
          }}
        />
      </label>
    </div>
  );
}

function RangeSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={labelStyle}>{label}</span>
        <span style={{ ...labelStyle, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%",
          accentColor: "rgba(255,255,255,0.65)",
          cursor: "pointer",
          margin: 0,
        }}
      />
    </div>
  );
}

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.09)"}`,
        background: active ? "rgba(255,255,255,0.11)" : "transparent",
        color: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.38)",
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        letterSpacing: "0.025em",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="20"
      height="10"
      viewBox="0 0 20 10"
      fill="none"
      style={{
        transform: up ? "rotate(0deg)" : "rotate(180deg)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <path
        d="M2 8 L10 2 L18 8"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(255,255,255,0.3)",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
};
