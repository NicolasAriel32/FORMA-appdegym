import { useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

export type Demonstration = "squat" | "bench" | "deadlift" | "row";
export type ExerciseVisualMode = "movement" | "muscles";

const media = {
  squat: {
    folder: "/media/exercises/squat-back-barbell",
    label: "Sentadilla trasera con barra en vista de tres cuartos",
    duration: 4.2,
    equipment: null,
    focus: "Piernas y cadera",
  },
  bench: {
    folder: "/media/exercises/bench-press-barbell",
    label: "Press de banca plano con barra en vista de tres cuartos",
    duration: 4.2,
    equipment: "Carga de referencia · 2 discos de 20 kg por lado",
    focus: "Pecho y empuje",
  },
  deadlift: {
    folder: "/media/exercises/romanian-deadlift-barbell",
    label: "Peso muerto rumano con barra en vista de tres cuartos",
    duration: 4.2,
    equipment: "Carga de referencia · 2 discos de 20 kg por lado",
    focus: "Cadena posterior",
  },
  row: {
    folder: "/media/exercises/bent-over-barbell-row",
    label: "Remo con barra en vista de tres cuartos",
    duration: 4.2,
    equipment: "Carga de referencia · 2 discos de 20 kg por lado",
    focus: "Espalda y tracción",
  },
} as const;

const modes: Array<{ id: ExerciseVisualMode; label: string }> = [
  { id: "movement", label: "Movimiento" },
  { id: "muscles", label: "Músculos" },
];

export function ExerciseRepetition({
  demonstration = "squat",
  videoRef,
  compact = false,
  onProgress,
  onPlaybackChange,
  view,
  showViewControls = false,
  muscles = [],
}: {
  demonstration?: Demonstration;
  videoRef?: RefObject<HTMLVideoElement | null>;
  compact?: boolean;
  onProgress?: (progress: number) => void;
  onPlaybackChange?: (playing: boolean) => void;
  view?: ExerciseVisualMode;
  showViewControls?: boolean;
  muscles?: string[];
}): ReactElement {
  const { folder, label, duration, equipment, focus } = media[demonstration];
  const fallbackRef = useRef<HTMLVideoElement>(null);
  const player = videoRef ?? fallbackRef;
  const [playing, setPlaying] = useState(false);
  const [localView, setLocalView] = useState<ExerciseVisualMode>("movement");
  const activeView = view ?? localView;
  const [autoPlay] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const visibleMuscles = muscles.slice(0, 3);

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
    onTimeUpdate={(event) => onProgress?.(event.currentTarget.currentTime / (event.currentTarget.duration || duration))}
  />;

  return <div className={`exercise-repetition${compact ? " exercise-repetition-compact" : ""}`}
    data-demonstration={demonstration} data-view={activeView}>
    {showViewControls && <div className="squat-controls exercise-mode-controls" role="group" aria-label="Vista 3D del ejercicio">
      {modes.map((mode) => <button key={mode.id} type="button" aria-pressed={activeView === mode.id}
        onClick={() => setLocalView(mode.id)}>{mode.label}</button>)}
    </div>}
    <div className="exercise-repetition-frame">{video}
      {activeView === "muscles" && <>
        <span className={`exercise-muscle-glow glow-${demonstration}`} aria-hidden="true" />
        <span className="exercise-muscle-badge">FOCO · {focus}</span>
      </>}
      <button className="squat-inline-play" type="button" aria-label={playing ? "Pausar animación 3D" : "Reproducir animación 3D"} onClick={() => {
        const element = player.current;
        if (!element) return;
        if (element.paused) void element.play().catch(() => setPlaying(false));
        else element.pause();
      }}>{playing ? "Pausar" : "Reproducir"}</button>
    </div>
    {activeView === "muscles" && <div className="exercise-muscle-details">
      <p className="squat-cue"><strong>Grupos principales.</strong> El resaltado acompaña el loop 3D y es orientativo.</p>
      <div className="tag-list">{(visibleMuscles.length > 0 ? visibleMuscles : [focus]).map((item) => <span key={item}>{item}</span>)}</div>
    </div>}
    {equipment && <p className="squat-cue">{equipment}</p>}
  </div>;
}
