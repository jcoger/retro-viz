"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import type { Theme } from "@/lib/themes";

// ── YouTube IFrame API types ───────────────────────────────────────

interface YTPlayerOptions {
  videoId: string;
  width?: number;
  height?: number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number }) => void;
    onError?: (e: { data: number }) => void;
  };
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getIframe(): HTMLIFrameElement;
  getVolume(): number;      // 0–100 (user volume setting)
  getCurrentTime(): number; // seconds into playback
  destroy(): void;
}

declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
      PlayerState: Record<string, number>;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

// ── Public API ────────────────────────────────────────────────────

// "youtube" = player loaded (even if CORS keeps analyser in silent mode)
// "none"    = no video loaded yet
export type AudioMode = "none" | "youtube";

export type YouTubePlayerHandle = {
  getFrequencyData:  () => Uint8Array<ArrayBuffer>;
  getTimeDomainData: () => Uint8Array<ArrayBuffer>;
  isActive:  boolean;
  audioMode: AudioMode;
  play:  () => void;
  pause: () => void;
};

type Props = {
  youtubeUrl:        string;
  theme:             Theme;
  onAudioModeChange?: (mode: AudioMode) => void;
  onPlayingChange?:   (playing: boolean) => void;
};

// ── YT API loader ─────────────────────────────────────────────────

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) { resolve(); return; }
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

// ── Video ID extractor ────────────────────────────────────────────

function extractVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname === "youtu.be")
      return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/embed/"))  return u.pathname.split("/")[2] || null;
      return u.searchParams.get("v");
    }
  } catch { /* not a URL */ }
  return null;
}

// ── Synthetic waveform constants ─────────────────────────────────
// Used when CORS blocks direct AudioContext access. Four harmonics at
// co-prime frequency multiples produce a complex, non-repeating waveform.

const HARMONICS = [
  { freqMult:  3, amp: 1.00, phaseRate: 0.80 },
  { freqMult:  7, amp: 0.45, phaseRate: 1.30 },
  { freqMult: 11, amp: 0.20, phaseRate: 2.10 },
  { freqMult: 17, amp: 0.08, phaseRate: 3.70 },
] as const;

const HARMONICS_TOTAL_AMP = HARMONICS.reduce((s, h) => s + h.amp, 0); // ≈ 1.73

// ── Component ─────────────────────────────────────────────────────

const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(
  ({ youtubeUrl, theme, onAudioModeChange, onPlayingChange }, ref) => {

    const ytWrapperRef = useRef<HTMLDivElement>(null);
    const ytPlayerRef  = useRef<YTPlayer | null>(null);

    // Web Audio — created once on mount, lives for component lifetime
    const audioCtxRef        = useRef<AudioContext | null>(null);
    const analyserRef        = useRef<AnalyserNode | null>(null);
    const dataArrayRef       = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(256) as Uint8Array<ArrayBuffer>);
    const timeDomainArrayRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(256) as Uint8Array<ArrayBuffer>);

    // Interval that drives synthetic waveform data after CORS blocks direct audio
    const synthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Stable ref so YT event callbacks never close over a stale onPlayingChange
    const onPlayingChangeRef = useRef(onPlayingChange);
    useEffect(() => { onPlayingChangeRef.current = onPlayingChange; }, [onPlayingChange]);

    const [audioMode, setAudioMode] = useState<AudioMode>("none");
    const [isReady,   setIsReady]   = useState(false);
    const [statusMsg, setStatusMsg] = useState("Paste a YouTube URL");

    const videoId = extractVideoId(youtubeUrl);

    // ── Expose handle ─────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getFrequencyData: () => {
        if (analyserRef.current)
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        return dataArrayRef.current;
      },
      getTimeDomainData: () => {
        if (analyserRef.current)
          analyserRef.current.getByteTimeDomainData(timeDomainArrayRef.current);
        return timeDomainArrayRef.current;
      },
      isActive:  audioMode !== "none",
      audioMode,
      play:  () => { handlePlay(); },
      pause: () => { handlePause(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [audioMode]);

    // ── AudioContext — created once on mount ──────────────────────
    // Starts suspended on most browsers; resumes on first user interaction.
    useEffect(() => {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      dataArrayRef.current       = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      timeDomainArrayRef.current = new Uint8Array(analyser.fftSize)            as Uint8Array<ArrayBuffer>;

      // Resume on the first interaction anywhere on the page — this satisfies
      // the browser's autoplay policy without requiring a specific button press.
      const resume = () => { ctx.resume().catch(() => {}); };
      document.addEventListener("click",      resume, { once: true });
      document.addEventListener("keydown",    resume, { once: true });
      document.addEventListener("touchstart", resume, { once: true, passive: true });

      return () => {
        document.removeEventListener("click",      resume);
        document.removeEventListener("keydown",    resume);
        document.removeEventListener("touchstart", resume);
        if (synthIntervalRef.current) clearInterval(synthIntervalRef.current);
        ctx.close().catch(() => {});
        ytPlayerRef.current?.destroy();
      };
    }, []); // runs once

    // ── YouTube player — (re)created when videoId changes ─────────
    useEffect(() => {
      if (!videoId) {
        setIsReady(false);
        setAudioMode("none");
        setStatusMsg(youtubeUrl.trim() ? "Invalid URL" : "Paste a YouTube URL");
        return;
      }

      setIsReady(false);
      setStatusMsg("Loading player…");

      let cancelled = false;

      loadYouTubeAPI().then(() => {
        if (cancelled || !ytWrapperRef.current) return;

        ytPlayerRef.current?.destroy();
        ytPlayerRef.current = null;

        ytWrapperRef.current.innerHTML = "";
        const mountEl = document.createElement("div");
        ytWrapperRef.current.appendChild(mountEl);

        ytPlayerRef.current = new window.YT.Player(mountEl, {
          videoId,
          width: 320,
          height: 180,
          playerVars: {
            controls: 0, disablekb: 1, fs: 0,
            modestbranding: 1, rel: 0, playsinline: 1,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              setIsReady(true);

              // Mark as "youtube" mode — the analyser runs (silently if CORS blocks it)
              const mode: AudioMode = "youtube";
              setAudioMode(mode);
              onAudioModeChange?.(mode);

              // Attempt to tap the iframe video element via Web Audio.
              // YouTube embeds are cross-origin so this always throws SecurityError.
              // The catch leaves the analyser unconnected → silent mode (flat zeros).
              const ctx     = audioCtxRef.current;
              const analyser = analyserRef.current;
              if (ctx && analyser) {
                try {
                  const iframe  = e.target.getIframe();
                  const videoEl = iframe.contentDocument
                    ?.querySelector("video") as HTMLVideoElement | null;
                  if (!videoEl) throw new Error("CORS");
                  const source = ctx.createMediaElementSource(videoEl);
                  source.connect(analyser);
                  source.connect(ctx.destination);
                  setStatusMsg("Audio connected");
                } catch {
                  // Expected — YouTube CORS blocks direct AudioContext access.
                  // Instead, drive the visualiser with synthetic data derived from
                  // the player's own getVolume() and getCurrentTime() values.
                  // The interval runs at ~60 fps, keeping the buffers fresh each frame.
                  if (synthIntervalRef.current) clearInterval(synthIntervalRef.current);

                  synthIntervalRef.current = setInterval(() => {
                    const player = ytPlayerRef.current;
                    if (!player) return;

                    const vol         = (player.getVolume() ?? 100) / 100; // 0–1
                    const currentTime =  player.getCurrentTime() ?? 0;

                    const timeBuf = timeDomainArrayRef.current;
                    const freqBuf = dataArrayRef.current;

                    // ── Time domain: sum of harmonics ───────────────────────
                    // Each harmonic uses currentTime as its phase clock so the
                    // waveform evolves continuously as the video plays.
                    for (let i = 0; i < timeBuf.length; i++) {
                      const t = i / timeBuf.length; // position in buffer, 0–1
                      let sample = 0;
                      for (const h of HARMONICS) {
                        sample +=
                          Math.sin(2 * Math.PI * h.freqMult * t + currentTime * h.phaseRate) *
                          h.amp;
                      }
                      sample /= HARMONICS_TOTAL_AMP;              // normalize to [-1, 1]
                      timeBuf[i] = Math.round(128 + sample * vol * 127);
                    }

                    // ── Frequency domain: gaussian bell curve ───────────────
                    // Center bin and peak both scale with volume so louder
                    // content pushes energy toward higher frequencies.
                    const centerBin = 15 + vol * 70;
                    const width     = 15 + vol * 12;
                    const peak      = vol * 210;

                    for (let i = 0; i < freqBuf.length; i++) {
                      const g = Math.exp(-((i - centerBin) ** 2) / (2 * width ** 2));
                      freqBuf[i] = Math.round(g * peak);
                    }
                  }, Math.round(1000 / 60));
                }
              }

              // Auto-play immediately when the player is ready
              e.target.playVideo();
            },

            onStateChange: ({ data }) => {
              // YT.PlayerState: ENDED=0 PLAYING=1 PAUSED=2
              onPlayingChangeRef.current?.(data === 1);
              if (data === 1) setStatusMsg("Playing");
              if (data === 2) setStatusMsg("Paused");
              if (data === 0) setStatusMsg("Ended");
            },

            onError: () => {
              if (!cancelled) setStatusMsg("YouTube error — try another video");
            },
          },
        });
      });

      return () => {
        cancelled = true;
        // Clear the synthetic tick so it doesn't write into buffers for a
        // player that has already been torn down.
        if (synthIntervalRef.current) {
          clearInterval(synthIntervalRef.current);
          synthIntervalRef.current = null;
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    // ── Play / Pause ──────────────────────────────────────────────
    const handlePlay = useCallback(() => {
      // Also a good opportunity to resume AudioContext if the page listener
      // fired before the context was created.
      audioCtxRef.current?.resume().catch(() => {});
      ytPlayerRef.current?.playVideo();
    }, []);

    const handlePause = useCallback(() => {
      ytPlayerRef.current?.pauseVideo();
    }, []);

    // ── Render ────────────────────────────────────────────────────
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>

        {/* Hidden YouTube player — off-screen, invisible */}
        <div
          ref={ytWrapperRef}
          style={{
            position: "absolute", left: -9999, top: -9999,
            width: 320, height: 180,
            opacity: 0, pointerEvents: "none", overflow: "hidden",
          }}
        />

        {/* Status line + audio mode badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily:    theme.fontLabel,
              fontSize:      9,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color:         audioMode !== "none" ? theme.textSecondary : theme.textDim,
              flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {statusMsg}
          </span>

          {isReady && (
            <span
              style={{
                flexShrink:    0,
                fontFamily:    theme.fontLabel,
                fontSize:      8,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color:         theme.accentMid,
                border:        `1px solid ${theme.accentDim}`,
                padding:       "2px 5px",
                borderRadius:  2,
              }}
            >
              YT
            </span>
          )}
        </div>
      </div>
    );
  }
);

YouTubePlayer.displayName = "YouTubePlayer";
export default YouTubePlayer;
