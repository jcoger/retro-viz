"use client";

import type { Theme } from "@/lib/themes";
import type { VisualMode } from "@/components/VisualCanvas";
import type { YouTubePlayerHandle } from "@/components/YouTubePlayer";
import YouTubePlayer from "@/components/YouTubePlayer";
import LCDInput     from "@/components/LCDInput";
import RotaryKnob   from "@/components/RotaryKnob";
import ToggleSwitch from "@/components/ToggleSwitch";
import VUMeter      from "@/components/VUMeter";
import LEDIndicator from "@/components/LEDIndicator";

// ── Types ─────────────────────────────────────────────────────────

type Props = {
  theme:         Theme;
  onThemeChange: (id: string) => void;

  // Transport
  youtubeUrl:      string;
  onUrlChange:     (v: string) => void;
  isPlaying:       boolean;
  onPlayingChange: (playing: boolean) => void;
  playerRef:       React.RefObject<YouTubePlayerHandle | null>;

  // Knobs
  sensitivity:         number;
  onSensitivityChange: (v: number) => void;
  speed:               number;
  onSpeedChange:       (v: number) => void;
  zoom:                number;
  onZoomChange:        (v: number) => void;

  // Toggles
  scanlines:         boolean;
  onScanlinesChange: (v: boolean) => void;
  mode:              VisualMode;
  onModeChange:      (m: VisualMode) => void;

  // Meters
  volume: number;
};

// ── Constants ─────────────────────────────────────────────────────

const MODES: VisualMode[] = ["oscilloscope", "spectrum", "radar", "stars"];

// ── Sub-components ────────────────────────────────────────────────

function ZoneDivider({ theme }: { theme: Theme }) {
  return (
    <div
      style={{
        width:      1,
        alignSelf:  "stretch",
        margin:     "8px 0",
        background: `linear-gradient(
          to bottom,
          transparent,
          ${theme.panelBorder} 20%,
          ${theme.panelBorder} 80%,
          transparent
        )`,
        flexShrink: 0,
      }}
    />
  );
}

function Zone({
  label, theme, flex = 1, children,
}: {
  label: string; theme: Theme; flex?: number; children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex,
        display:       "flex",
        flexDirection: "column",
        gap:           8,
        padding:       "10px 16px",
        minWidth:      0,
      }}
    >
      <span
        style={{
          fontFamily:    theme.fontLabel,
          fontSize:      8,
          fontWeight:    700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color:         theme.panelLabel,
          userSelect:    "none",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

// ── HardwarePanel ─────────────────────────────────────────────────

export default function HardwarePanel({
  theme,
  onThemeChange:       _onThemeChange, // reserved for future theme picker
  youtubeUrl,
  onUrlChange,
  isPlaying,
  onPlayingChange,
  playerRef,
  sensitivity,
  onSensitivityChange,
  speed,
  onSpeedChange,
  zoom,
  onZoomChange,
  scanlines,
  onScanlinesChange,
  mode,
  onModeChange,
  volume,
}: Props) {

  // Route LCDInput actions through the shared playerRef
  const handleSubmit    = () => playerRef.current?.play();
  const handlePlayPause = () =>
    isPlaying ? playerRef.current?.pause() : playerRef.current?.play();

  // Cycle through all four modes on each toggle click
  const handleModeToggle = () => {
    const idx = MODES.indexOf(mode);
    onModeChange(MODES[(idx + 1) % MODES.length]);
  };

  // ── Brushed metal panel background ───────────────────────────
  const brushedMetal = `
    repeating-linear-gradient(
      to bottom,
      transparent       0px,
      transparent       2px,
      rgba(255,255,255,0.03) 2px,
      rgba(255,255,255,0.03) 3px
    ),
    radial-gradient(
      ellipse at 50% -30%,
      ${theme.panelHighlight} 0%,
      ${theme.panelBg}        45%,
      ${theme.panelShadow}    100%
    )
  `;

  const bevel = [
    `inset 0  1px 0   ${theme.panelHighlight}`,
    `inset 0 -1px 0   ${theme.panelShadow}`,
    `inset 1px  0 0   rgba(255,255,255,0.04)`,
    `inset -1px 0 0   rgba(0,0,0,0.45)`,
    `0 -6px 24px rgba(0,0,0,0.55)`,
    theme.panelBorderGlow,
  ].join(", ");

  return (
    <div
      style={{
        position:      "fixed",
        bottom:        0,
        left:          0,
        right:         0,
        height:        "calc(180px + env(safe-area-inset-bottom))",
        zIndex:        100,
        background:    brushedMetal,
        boxShadow:     bevel,
        borderTop:     `1px solid ${theme.panelBorder}`,
        display:       "flex",
        flexDirection: "column",
        fontFamily:    theme.fontLabel,
        textTransform: "uppercase",
      }}
    >
      <div style={{ flex: 1, display: "flex", maxHeight: 180 }}>

        {/* ── LEFT — URL input + transport ──────────────────────── */}
        <Zone label="Input / Transport" theme={theme} flex={1.4}>
          {/*
            YouTubePlayer renders only its status line — the player iframe is
            positioned off-screen. We forward playerRef so page.tsx can read
            audio data each frame.
          */}
          <YouTubePlayer
            ref={playerRef}
            youtubeUrl={youtubeUrl}
            theme={theme}
            onPlayingChange={onPlayingChange}
          />

          <LCDInput
            value={youtubeUrl}
            onChange={onUrlChange}
            onSubmit={handleSubmit}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            theme={theme}
          />
        </Zone>

        <ZoneDivider theme={theme} />

        {/* ── CENTER — Rotary knobs ──────────────────────────────── */}
        <Zone label="Controls" theme={theme} flex={1}>
          <div
            style={{
              flex:           1,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-around",
            }}
          >
            <RotaryKnob
              value={sensitivity}
              onChange={onSensitivityChange}
              label="Sens"
              theme={theme}
            />
            <RotaryKnob
              value={speed}
              onChange={onSpeedChange}
              label="Speed"
              theme={theme}
            />
            <RotaryKnob
              value={zoom}
              onChange={onZoomChange}
              label="Zoom"
              theme={theme}
            />
          </div>
        </Zone>

        <ZoneDivider theme={theme} />

        {/* ── RIGHT — VU meter + toggles + beat LED ─────────────── */}
        <Zone label="Meters / Switches" theme={theme} flex={1.4}>
          <div
            style={{
              flex:           1,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-around",
            }}
          >

            <VUMeter volume={volume} theme={theme} />

            <div
              style={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "space-evenly",
                height:         "100%",
              }}
            >
              <ToggleSwitch
                value={scanlines}
                onChange={onScanlinesChange}
                label="Lines"
                theme={theme}
              />
              {/* Mode cycles oscilloscope → spectrum → radar → stars on each click.
                  onChange ignores the boolean; we always advance to the next mode. */}
              <ToggleSwitch
                value={mode !== "oscilloscope"}
                onChange={handleModeToggle}
                label={mode === "oscilloscope" ? "Mode" : mode.slice(0, 4).toUpperCase()}
                theme={theme}
              />
            </div>

            <LEDIndicator volume={volume} label="Beat" theme={theme} />

          </div>
        </Zone>

      </div>

      {/* Safe-area spacer — iOS home indicator clearance */}
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
