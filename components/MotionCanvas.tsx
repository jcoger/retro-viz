"use client";

import { useEffect, useRef } from "react";
import type { Theme } from "@/lib/themes";

export type PatternType = "concentric" | "radial" | "diagonal" | "noise";

export type CanvasConfig = {
  colorA: string;
  colorB: string;
  speed: number;
  density: number;
  background: string;
  pattern: PatternType;
};

type Props = {
  config: CanvasConfig;
  theme: Theme;
};

export default function MotionCanvas({ config, theme: _theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let startTime: number | null = null;

    const resize = () => {
      canvas.width  = window.visualViewport?.width  ?? window.innerWidth;
      canvas.height = window.visualViewport?.height ?? window.innerHeight;
      startTime = null;
    };

    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);

    // ── Main loop ─────────────────────────────────────────────────
    const draw = (ts: number) => {
      if (startTime === null) startTime = ts;
      // elapsed drives all future pattern animations; speed multiplier preserved
      const _elapsed = (ts - startTime) * config.speed; // eslint-disable-line @typescript-eslint/no-unused-vars

      if (config.background === "transparent") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = config.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // pattern draw calls go here

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
