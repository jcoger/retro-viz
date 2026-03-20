"use client";

import { useState } from "react";
import MotionCanvas from "@/components/MotionCanvas";
import ConfigPanel from "@/components/ConfigPanel";
import type { CanvasConfig } from "@/components/MotionCanvas";

const DEFAULT_CONFIG: CanvasConfig = {
  colorA:     "#4400FF",
  colorB:     "#888888",
  speed:      1.0,
  density:    2,
  background: "#000000",
  pattern:    "concentric",
};

export default function Home() {
  const [config, setConfig] = useState<CanvasConfig>(DEFAULT_CONFIG);

  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <MotionCanvas config={config} />
      <ConfigPanel config={config} onChange={setConfig} />
    </main>
  );
}
