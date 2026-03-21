"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import VisualCanvas, { type VisualMode } from "@/components/VisualCanvas";
import HardwarePanel from "@/components/HardwarePanel";
import type { YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { THEMES, DEFAULT_THEME } from "@/lib/themes";

// ── Defaults ──────────────────────────────────────────────────────

const DEFAULT_SENSITIVITY = 0.5;
const DEFAULT_SPEED       = 0.5;
const DEFAULT_ZOOM        = 0.5;
const DEFAULT_MODE: VisualMode = "oscilloscope";
const DEFAULT_SCANLINES   = true;

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// ── Inner component (needs useSearchParams, so must be inside Suspense) ───

function HomeContent() {
  const searchParams = useSearchParams();

  // ── Theme ────────────────────────────────────────────────────
  const [themeId, setThemeId] = useState<string>(() => {
    const raw = searchParams.get("theme") ?? "";
    return raw in THEMES ? raw : DEFAULT_THEME;
  });
  const theme = THEMES[themeId];

  // ── Transport ────────────────────────────────────────────────
  const [youtubeUrl, setYoutubeUrl] = useState(() => searchParams.get("url") ?? "");
  const [isPlaying,  setIsPlaying]  = useState(false);

  // ── Knobs ────────────────────────────────────────────────────
  const [sensitivity, setSensitivity] = useState(() =>
    clamp01(parseFloat(searchParams.get("sensitivity") ?? "") || DEFAULT_SENSITIVITY)
  );
  const [speed, setSpeed] = useState(() =>
    clamp01(parseFloat(searchParams.get("speed") ?? "") || DEFAULT_SPEED)
  );
  const [zoom, setZoom] = useState(() =>
    clamp01(parseFloat(searchParams.get("zoom") ?? "") || DEFAULT_ZOOM)
  );

  // ── Mode / scanlines ─────────────────────────────────────────
  const [mode, setMode] = useState<VisualMode>(() => {
    const raw = searchParams.get("mode") ?? "";
    return (["oscilloscope", "spectrum", "radar", "stars"] as VisualMode[]).includes(raw as VisualMode)
      ? (raw as VisualMode)
      : DEFAULT_MODE;
  });
  const [scanlines, setScanlines] = useState(() => {
    const raw = searchParams.get("scanlines");
    return raw === null ? DEFAULT_SCANLINES : raw === "1";
  });

  // ── Audio data ───────────────────────────────────────────────
  // Stable buffer refs passed directly to VisualCanvas — no re-renders when they fill.
  const freqBuf  = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(256) as Uint8Array<ArrayBuffer>);
  const timeBuf  = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(256) as Uint8Array<ArrayBuffer>);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  // React state for volume — throttled to ~20 FPS to limit re-renders
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    let raf: number;
    let lastVolUpdate = 0;

    const loop = (ts: number) => {
      const handle = playerRef.current;
      if (handle?.isActive) {
        const freq = handle.getFrequencyData();
        freqBuf.current.set(freq);

        const time = handle.getTimeDomainData();
        timeBuf.current.set(time);

        if (ts - lastVolUpdate > 50) {
          let sum = 0;
          for (let i = 0; i < freq.length; i++) sum += freq[i] * freq[i];
          const rms = Math.sqrt(sum / freq.length) / 255;
          setVolume(rms);
          lastVolUpdate = ts;
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── iOS viewport height ───────────────────────────────────────
  const [vh, setVh] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setVh(window.visualViewport?.height ?? window.innerHeight);
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  // ── URL sync ──────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams({
      theme:       themeId,
      url:         youtubeUrl,
      sensitivity: String(sensitivity),
      speed:       String(speed),
      zoom:        String(zoom),
      mode,
      scanlines:   scanlines ? "1" : "0",
    });
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [themeId, youtubeUrl, sensitivity, speed, zoom, mode, scanlines]);

  // ── Stable callbacks for playing state ───────────────────────
  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  return (
    <main
      style={{
        width:      "100vw",
        height:     vh ? `${vh}px` : "100svh",
        background: theme.screenBg,
        position:   "relative",
        overflow:   "hidden",
      }}
    >
      {/* ── Visualizer canvas — fills the full viewport ── */}
      <VisualCanvas
        frequencyData={freqBuf.current}
        timeDomainData={timeBuf.current}
        beamCount={1}
        beamSpread={0}
        sensitivity={sensitivity}
        speed={speed}
        zoom={zoom}
        mode={mode}
        scanlines={scanlines}
        theme={theme}
      />

      {/* ── Hardware control panel — fixed to bottom ── */}
      <HardwarePanel
        theme={theme}
        onThemeChange={setThemeId}
        youtubeUrl={youtubeUrl}
        onUrlChange={setYoutubeUrl}
        isPlaying={isPlaying}
        onPlayingChange={handlePlayingChange}
        playerRef={playerRef}
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
        speed={speed}
        onSpeedChange={setSpeed}
        zoom={zoom}
        onZoomChange={setZoom}
        scanlines={scanlines}
        onScanlinesChange={setScanlines}
        mode={mode}
        onModeChange={setMode}
        volume={volume}
      />
    </main>
  );
}

// ── Root export ───────────────────────────────────────────────────

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
