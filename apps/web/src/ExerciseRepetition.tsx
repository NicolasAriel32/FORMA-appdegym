import { useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

export type Demonstration = "squat" | "bench" | "deadlift";

const media = {
  squat: {
    folder: "/media/exercises/squat-back-barbell",
    label: "Sentadilla trasera con barra en vista de tres cuartos",
    duration: 4.2,
    equipment: null,
  },
  bench: {
    folder: "/media/exercises/bench-press-barbell",
    label: "Press de banca plano con barra en vista de tres cuartos",
    duration: 4.2,
    equipment: "Carga de referencia · 2 discos de 20 kg por lado",
  },
  deadlift: {
    folder: "/media/exercises/romanian-deadlift-barbell",
    label: "Peso muerto rumano con barra en vista de tres cuartos",
    duration: 4.2,
    equipment: "Carga de referencia · 2 discos de 20 kg por lado",
  },
} as const;

export function ExerciseRepetition({ demonstration = "squat", videoRef, compact = false, onProgress, onPlaybackChange }: {
  demonstration?: Demonstration;
  videoRef?: RefObject<HTMLVideoElement | null>;
  compact?: boolean;
  onProgress?: (progress: number) => void;
  onPlaybackChange?: (playing: boolean) => void;
}): ReactElement {
  const { folder, label, duration, equipment } = media[demonstration];
  const fallbackRef = useRef<HTMLVideoElement>(null);
  const player = videoRef ?? fallbackRef;
  const [playing, setPlaying] = useState(false);
  const [autoPlay] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const video = <video
    ref={player}
    className={`squat-model squat-video${compact ? " squat-video-compact" : ""}`}
    src={`${folder}/repetition-pilot.mp4`}
    poster={`${folder}/poster.webp`}
    aria-label={label}
    preload="metadata"
    autoPlay={autoPlay}
    playsInline
    muted
    loop
    onPlay={() => { setPlaying(true); onPlaybackChange?.(true); }}
    onPause={() => { setPlaying(false); onPlaybackChange?.(false); }}
    onTimeUpdate={(event) => onProgress?.(event.currentTarget.currentTime / duration)}
  />;
  return <div className={compact ? "workout-squat-media" : undefined}>
    <div className="exercise-repetition-frame">{video}
    {(compact || demonstration !== "squat") && <button className="squat-inline-play" type="button" onClick={() => {
      const element = player.current;
      if (!element) return;
      if (element.paused) void element.play().catch(() => setPlaying(false));
      else element.pause();
    }}>{playing ? "Pausar" : "Ver movimiento"}</button>}</div>
    {equipment && <p className="squat-cue">{equipment}</p>}
  </div>;
}

