"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import MotionCanvas from "@/components/MotionCanvas";
import ConfigPanel from "@/components/ConfigPanel";
import type { CanvasConfig, PatternType } from "@/components/MotionCanvas";

const DEFAULT_CONFIG: CanvasConfig = {
  colorA:     "#4400FF",
  colorB:     "#888888",
  speed:      1.0,
  density:    2,
  background: "#000000",
  pattern:    "concentric",
};

const VALID_PATTERNS: PatternType[] = ["concentric", "radial", "diagonal", "noise"];

function parseConfig(params: ReturnType<typeof useSearchParams>): CanvasConfig {
  const rawPattern = params.get("pattern") ?? "";
  const speed      = parseFloat(params.get("speed")   ?? "");
  const density    = parseInt(params.get("density")   ?? "");

  return {
    colorA:     params.get("colorA")     ?? DEFAULT_CONFIG.colorA,
    colorB:     params.get("colorB")     ?? DEFAULT_CONFIG.colorB,
    background: params.get("background") ?? DEFAULT_CONFIG.background,
    speed:      isNaN(speed)   ? DEFAULT_CONFIG.speed   : speed,
    density:    isNaN(density) ? DEFAULT_CONFIG.density : density,
    pattern:    VALID_PATTERNS.includes(rawPattern as PatternType)
                  ? (rawPattern as PatternType)
                  : DEFAULT_CONFIG.pattern,
  };
}

// ── Inner component — useSearchParams requires a Suspense ancestor ─
function HomeContent() {
  const searchParams = useSearchParams();

  // Lazy initializer: reads URL on first render, falls back to defaults
  const [config, setConfig] = useState<CanvasConfig>(() => parseConfig(searchParams));

  // iOS Safari: 100vh includes hidden browser chrome. Track real visible
  // height via visualViewport (fires on chrome show/hide) + window resize.
  const [vh, setVh] = useState<number | null>(null);
  useEffect(() => {
    const update = () =>
      setVh(window.visualViewport?.height ?? window.innerHeight);
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  // Sync config → URL without adding to browser history
  useEffect(() => {
    const params = new URLSearchParams({
      colorA:     config.colorA,
      colorB:     config.colorB,
      speed:      String(config.speed),
      density:    String(config.density),
      background: config.background,
      pattern:    config.pattern,
    });
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [config]);

  return (
    <main style={{ width: "100vw", height: vh ? `${vh}px` : "100svh" }}>
      <div className="safe-top-bar" />
      <MotionCanvas config={config} />
      <ConfigPanel config={config} onChange={setConfig} />
    </main>
  );
}

// ── Page — Suspense required for useSearchParams in App Router ─────
export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
