// ── Theme system ──────────────────────────────────────────────────
// All visual values for chrome (panel, typography, glow, effects).
// No component may hardcode a color, font, or glow — read from theme.

export type Theme = {
  id: string;
  label: string;

  // ── Accent — the phosphor/glow color ──────────────────────────
  accent: string;        // full-brightness accent (#00FF41, #FFB000)
  accentDim: string;     // dark tinted version — inactive states, backgrounds
  accentMid: string;     // mid-brightness — secondary labels, idle LEDs
  accentGlow: string;    // CSS box-shadow / text-shadow glow string

  // ── Screen / visualizer canvas ────────────────────────────────
  screenBg: string;      // canvas fill — very dark, color-tinted black
  screenBorder: string;  // bezel border around the screen area

  // ── Hardware panel ────────────────────────────────────────────
  panelStyle: "brushed-metal" | "matte-black";
  panelBg: string;           // base panel color
  panelHighlight: string;    // lighter horizontal stripe (brushed metal sheen)
  panelShadow: string;       // recessed shadow stripe
  panelBorder: string;       // outer edge border
  panelBorderGlow: string;   // subtle inner glow on panel edges

  // ── Typography ────────────────────────────────────────────────
  fontDisplay: string;   // large readouts, segment displays
  fontLabel: string;     // control labels, section headers
  textPrimary: string;   // active / bright text
  textSecondary: string; // secondary labels
  textDim: string;       // inactive / ghost text
  panelLabel: string;    // silk-screened hardware labels — neutral regardless of accent
  meterDanger: string;   // VU meter red zone (right 20% of arc)

  // ── Effects ───────────────────────────────────────────────────
  scanlines: boolean;
  scanlinesOpacity: number;  // 0–1
  crtCurvature: boolean;     // corner distortion on the screen

  // ── Content ───────────────────────────────────────────────────
  defaultVideo: string;      // YouTube video ID to auto-load on start (empty = none)
};

// ── Theme definitions ─────────────────────────────────────────────

const retro: Theme = {
  id: "retro",
  label: "Phosphor",

  accent:      "#00FF41",
  accentDim:   "#002B0B",
  accentMid:   "#00A82B",
  accentGlow:  "0 0 6px #00FF41, 0 0 18px #00FF4155, 0 0 40px #00FF4122",

  screenBg:     "#010801",
  screenBorder: "#003010",

  panelStyle:       "brushed-metal",
  panelBg:          "#1C1C1C",
  panelHighlight:   "#2E2E2E",
  panelShadow:      "#111111",
  panelBorder:      "#3A3A3A",
  panelBorderGlow:  "0 0 8px #00FF4118",

  fontDisplay: "var(--font-space-mono), 'Courier New', monospace",
  fontLabel:   "var(--font-space-mono), 'Courier New', monospace",
  textPrimary:   "#00FF41",
  textSecondary: "#00A82B",
  textDim:       "#004D15",
  panelLabel:    "rgba(136, 136, 136, 0.6)",
  meterDanger:   "#FF4444",

  scanlines:        true,
  scanlinesOpacity: 0.07,
  crtCurvature:     false,
  defaultVideo:     "", // paste a YouTube video ID here
};

const amber: Theme = {
  id: "amber",
  label: "Amber",

  accent:      "#FFB000",
  accentDim:   "#2E1F00",
  accentMid:   "#CC8A00",
  accentGlow:  "0 0 6px #FFB000, 0 0 18px #FFB00055, 0 0 40px #FFB00022",

  screenBg:     "#080500",
  screenBorder: "#2E1A00",

  panelStyle:       "brushed-metal",
  panelBg:          "#1C1C1C",
  panelHighlight:   "#2E2E2E",
  panelShadow:      "#111111",
  panelBorder:      "#3A3A3A",
  panelBorderGlow:  "0 0 8px #FFB00018",

  fontDisplay: "var(--font-space-mono), 'Courier New', monospace",
  fontLabel:   "var(--font-space-mono), 'Courier New', monospace",
  textPrimary:   "#FFB000",
  textSecondary: "#CC8A00",
  textDim:       "#4D3500",
  panelLabel:    "rgba(136, 136, 136, 0.6)",
  meterDanger:   "#FF4444",

  scanlines:        true,
  scanlinesOpacity: 0.07,
  crtCurvature:     false,
  defaultVideo:     "", // paste a YouTube video ID here
};

export const THEMES: Record<string, Theme> = { retro, amber };

export const DEFAULT_THEME = "retro";
