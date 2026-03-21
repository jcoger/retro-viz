"use client";

import type { CanvasConfig } from "./MotionCanvas";
import type { Theme } from "@/lib/themes";

type Props = {
  config: CanvasConfig;
  onChange: (config: CanvasConfig) => void;
  theme: Theme;
  onThemeChange: (themeId: string) => void;
};

// Placeholder — retro control panel goes here
export default function ConfigPanel({ config: _config, onChange: _onChange, theme: _theme, onThemeChange: _onThemeChange }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 100,
      }}
    />
  );
}
