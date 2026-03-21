"use client";

import type { Theme } from "@/lib/themes";

type Props = {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  theme: Theme;
};

// Degrees of rotateX — how far the lever "nods" each way
const TILT = 20;

export default function ToggleSwitch({ value, onChange, label, theme }: Props) {
  const toggle = () => onChange(!value);

  return (
    <div
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") toggle(); }}
      role="switch"
      aria-checked={value}
      aria-label={label}
      tabIndex={0}
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            5,
        cursor:         "pointer",
        userSelect:     "none",
        outline:        "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >

      {/* ── LED indicator ──────────────────────────────────────── */}
      {/*
        Single dot above the housing. Bright accent with radial glow when ON,
        collapsed to accentDim with no shadow when OFF.
      */}
      <div
        style={{
          width:        6,
          height:       6,
          borderRadius: "50%",
          flexShrink:   0,
          background:   value ? theme.accent : theme.accentDim,
          boxShadow:    value
            ? `0 0 5px ${theme.accent}, 0 0 10px ${theme.accent}66`
            : "none",
          transition:   "background 0.12s ease, box-shadow 0.12s ease",
        }}
      />

      {/* ── Housing ─────────────────────────────────────────────── */}
      {/*
        Recessed socket: panelShadow fill + heavy inset shadow reads as a
        cavity cut into the brushed-metal panel. The top edge highlight gives
        the sense of a beveled opening.
      */}
      <div
        style={{
          width:        32,
          height:       48,
          borderRadius: 6,
          border:       `1px solid ${theme.panelBorder}`,
          background:   theme.panelShadow,
          boxShadow: [
            "inset 0 3px 7px rgba(0,0,0,0.80)",
            "inset 0 0 3px rgba(0,0,0,0.50)",
            `0 1px 0 ${theme.panelHighlight}44`,   // top edge catch-light
          ].join(", "),
          padding:        3,
          // Establishes 3D perspective context for the lever child
          perspective:    "100px",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "stretch",
          overflow:       "hidden",
        }}
      >

        {/* ── Lever ─────────────────────────────────────────────── */}
        {/*
          Rotates about the horizontal center axis (rotateX).
          ON  = top nods toward viewer (rotateX negative) → top face lit → lighter at top.
          OFF = bottom nods toward viewer (rotateX positive) → bottom face lit → lighter at bottom.

          The gradient follows the exposed face so the "high" side always
          looks brighter, reinforcing the physical tilt.
        */}
        <div
          style={{
            flex:            1,
            borderRadius:    4,
            transformOrigin: "50% 50%",
            transform:       `rotateX(${value ? -TILT : TILT}deg)`,

            // Gradient: lit side (the face angled toward viewer) is always panelHighlight
            background: value
              ? `linear-gradient(to bottom, ${theme.panelHighlight} 0%, ${theme.panelBg} 52%, ${theme.panelShadow} 100%)`
              : `linear-gradient(to top,    ${theme.panelHighlight} 0%, ${theme.panelBg} 52%, ${theme.panelShadow} 100%)`,

            // Drop shadow: falls toward the depressed side; tiny specular on raised edge
            boxShadow: value
              ? `0 -3px 5px rgba(0,0,0,0.55), inset 0  1px 0 rgba(255,255,255,0.08)`
              : `0  3px 5px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.08)`,

            transition: [
              "transform    120ms ease",
              "background   120ms ease",
              "box-shadow   120ms ease",
            ].join(", "),
          }}
        />

      </div>

      {/* ── Label ───────────────────────────────────────────────── */}
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
