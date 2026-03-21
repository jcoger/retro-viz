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
  cueVideoById(videoId: string): void;
  getPlayerState(): number;
  getIframe(): HTMLIFrameElement;
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

export type AudioMode = "none" | "youtube" | "microphone";

export type YouTubePlayerHandle = {
  getFrequencyData:  () => Uint8Array<ArrayBuffer>;
  getTimeDomainData: () => Uint8Array<ArrayBuffer>;
  isActive:  boolean;
  audioMode: AudioMode;
  play:  () => void;
  pause: () => void;
};

type Props = {
  youtubeUrl: string;
  theme: Theme;
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
  } catch {
    // not a valid URL — already handled by bare-ID check
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────

const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(
  ({ youtubeUrl, theme, onAudioModeChange, onPlayingChange }, ref) => {
    const ytWrapperRef = useRef<HTMLDivElement>(null);
    const ytPlayerRef  = useRef<YTPlayer | null>(null);

    const audioCtxRef         = useRef<AudioContext | null>(null);
    const analyserRef         = useRef<AnalyserNode | null>(null);
    const dataArrayRef        = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(256) as Uint8Array<ArrayBuffer>);
    const timeDomainArrayRef  = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(256) as Uint8Array<ArrayBuffer>);
    const micStreamRef        = useRef<MediaStream | null>(null);
    const audioInitRef        = useRef(false);

    // Stable ref for onPlayingChange — avoids stale closure in YT event handlers
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
      play:  () => { void handlePlay(); },
      pause: () => handlePause(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [audioMode]);

    // ── Load / swap YouTube player ─────────────────────────────────
    useEffect(() => {
      if (!videoId) {
        setIsReady(false);
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
          playerVars: { controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              if (!cancelled) {
                setIsReady(true);
                setStatusMsg("Ready — press Play");
              }
            },
            onStateChange: ({ data }) => {
              const playing = data === 1;
              onPlayingChangeRef.current?.(playing);
              if (data === 0) setStatusMsg("Ended");
              if (data === 2) setStatusMsg("Paused");
              if (data === 1) setStatusMsg("Playing");
            },
            onError: () => {
              if (!cancelled)
                setStatusMsg("YouTube error — try another video");
            },
          },
        });
      });

      return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    // ── Audio init ────────────────────────────────────────────────
    const initAudio = useCallback(async () => {
      if (audioInitRef.current) {
        if (audioCtxRef.current?.state === "suspended")
          await audioCtxRef.current.resume();
        return;
      }
      audioInitRef.current = true;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      dataArrayRef.current       = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      timeDomainArrayRef.current = new Uint8Array(analyser.fftSize)            as Uint8Array<ArrayBuffer>;

      let connected = false;
      try {
        const iframe = ytPlayerRef.current?.getIframe();
        if (!iframe) throw new Error("no iframe");
        const videoEl = iframe.contentDocument?.querySelector("video") as HTMLVideoElement | null;
        if (!videoEl) throw new Error("video element unreachable (CORS)");
        const source = ctx.createMediaElementSource(videoEl);
        source.connect(analyser);
        source.connect(ctx.destination);
        connected = true;
        const mode: AudioMode = "youtube";
        setAudioMode(mode);
        onAudioModeChange?.(mode);
        setStatusMsg("YouTube audio connected");
      } catch { /* expected CORS failure — fall through */ }

      if (!connected) {
        try {
          setStatusMsg("Requesting microphone…");
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            video: false,
          });
          micStreamRef.current = stream;
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);
          const mode: AudioMode = "microphone";
          setAudioMode(mode);
          onAudioModeChange?.(mode);
          setStatusMsg("Microphone active");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "permission denied";
          setStatusMsg(`No audio source: ${msg}`);
          audioInitRef.current = false;
          ctx.close().catch(() => {});
          audioCtxRef.current = null;
          return;
        }
      }

      if (ctx.state === "suspended") await ctx.resume();
    }, [onAudioModeChange]);

    const handlePlay = useCallback(async () => {
      if (!isReady) return;
      await initAudio();
      ytPlayerRef.current?.playVideo();
    }, [initAudio, isReady]);

    const handlePause = useCallback(() => {
      ytPlayerRef.current?.pauseVideo();
    }, []);

    // ── Cleanup ───────────────────────────────────────────────────
    useEffect(() => {
      return () => {
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioCtxRef.current?.close().catch(() => {});
        ytPlayerRef.current?.destroy();
      };
    }, []);

    // ── Render ────────────────────────────────────────────────────
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>

        {/* Hidden YouTube player */}
        <div
          ref={ytWrapperRef}
          style={{
            position: "absolute", left: -9999, top: -9999,
            width: 320, height: 180, opacity: 0,
            pointerEvents: "none", overflow: "hidden",
          }}
        />

        {/* Status + audio mode badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily:   theme.fontLabel,
              fontSize:     9,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color:         audioMode !== "none" ? theme.textSecondary : theme.textDim,
              flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {statusMsg}
          </span>

          {audioMode !== "none" && (
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
              {audioMode === "microphone" ? "MIC" : "YT"}
            </span>
          )}
        </div>
      </div>
    );
  }
);

YouTubePlayer.displayName = "YouTubePlayer";
export default YouTubePlayer;
