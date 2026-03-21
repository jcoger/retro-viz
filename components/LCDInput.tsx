"use client";

import { useId, useState } from "react";
import type { Theme } from "@/lib/themes";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  theme: Theme;
};

export default function LCDInput({
  value,
  onChange,
  onSubmit,
  isPlaying,
  onPlayPause,
  theme,
}: Props) {
  // Sanitize useId output for use as a CSS class name
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const cls = `lcd-${uid}`;

  const [btnDown, setBtnDown] = useState(false);

  const canAct   = isPlaying || value.trim().length > 0;
  const btnLabel = isPlaying ? "■ PAUSE" : "▶ PLAY";

  const handleButton = () => {
    if (!canAct) return;
    isPlaying ? onPlayPause() : onSubmit();
  };

  // Accent opacity variants as 8-char hex
  const accent30 = `${theme.accent}4D`;   // ~30 %
  const accent55 = `${theme.accent}8C`;   // ~55 %
  const accent80 = `${theme.accent}CC`;   // ~80 %
  const accent12 = `${theme.accent}1F`;   // ~12 %

  return (
    <>
      {/*
        Scoped styles — injected once per mount.
        Targets ::placeholder and :focus, which can't be expressed inline.
        The @keyframes blink drives the caret animation so it steps
        (hard on/off) rather than fading — period-correct for LCD hardware.
      */}
      <style>{`
        .${cls}-field {
          background:     ${theme.screenBg};
          border:         1px solid ${accent30};
          color:          ${theme.accent};
          font-family:    ${theme.fontDisplay};
          font-size:      13px;
          letter-spacing: 0.08em;
          caret-color:    ${theme.accent};
          outline:        none;
          padding:        7px 10px;
          border-radius:  3px;
          width:          100%;
          min-width:      0;
          box-shadow:
            inset 0 2px 8px rgba(0,0,0,0.75),
            inset 0 0 3px rgba(0,0,0,0.45);
          transition: border-color 0.10s ease, box-shadow 0.10s ease;
          animation: ${cls}-blink 1s step-end infinite;
        }
        .${cls}-field::placeholder {
          color:          ${accent30};
          letter-spacing: 0.08em;
        }
        .${cls}-field:focus {
          border-color: ${accent80};
          box-shadow:
            inset 0 2px 8px rgba(0,0,0,0.75),
            inset 0 0 3px rgba(0,0,0,0.45),
            0 0 0 1px ${accent12},
            0 0 12px ${accent12};
        }
        @keyframes ${cls}-blink {
          0%, 100% { caret-color: ${theme.accent}; }
          50%       { caret-color: transparent;      }
        }
      `}</style>

      <div
        style={{
          display:    "flex",
          gap:        8,
          alignItems: "stretch",
          width:      "100%",
        }}
      >

        {/* ── LCD field ───────────────────────────────────────────── */}
        <input
          className={`${cls}-field`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onSubmit();
          }}
          placeholder="PASTE YOUTUBE URL"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        {/* ── PLAY / PAUSE pill button ─────────────────────────────── */}
        {/*
          Border brightens while pressed; shadow inverts to inset (depressed look).
          Disabled when no URL is loaded and nothing is playing.
        */}
        <button
          onClick={handleButton}
          onMouseDown={() => setBtnDown(true)}
          onMouseUp={() => setBtnDown(false)}
          onMouseLeave={() => setBtnDown(false)}
          onTouchStart={(e) => { e.preventDefault(); setBtnDown(true); }}
          onTouchEnd={() => { setBtnDown(false); handleButton(); }}
          disabled={!canAct}
          style={{
            flexShrink:    0,
            padding:       "0 14px",
            borderRadius:  100,
            border:        `1px solid ${canAct ? (btnDown ? accent80 : accent55) : accent30}`,
            background:    btnDown ? `${theme.panelShadow}` : theme.screenBg,
            color:         canAct ? theme.accent : accent30,
            fontFamily:    theme.fontDisplay,
            fontSize:      10,
            fontWeight:    700,
            letterSpacing: "0.18em",
            cursor:        canAct ? "pointer" : "default",
            userSelect:    "none",
            outline:       "none",
            whiteSpace:    "nowrap",
            boxShadow: btnDown
              ? `inset 0 1px 5px rgba(0,0,0,0.65)`
              : [
                  `inset 0 1px 3px rgba(0,0,0,0.55)`,
                  `0 1px 0 ${theme.panelHighlight}44`,
                  canAct ? `0 0 6px ${theme.accent}22` : "",
                ]
                  .filter(Boolean)
                  .join(", "),
            transform:   btnDown ? "scale(0.95)" : "scale(1)",
            transition:  "transform 0.06s ease, box-shadow 0.08s ease, border-color 0.08s ease, color 0.10s ease",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {btnLabel}
        </button>

      </div>
    </>
  );
}
