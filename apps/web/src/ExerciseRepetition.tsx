import { useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

export type Demonstration = "squat" | "bench" | "deadlift" | "row" | "legpress" | "conventional" | "pullup" | "pulldown" | "ohp" | "incline" | "pushdown" | "lunge" | "legext" | "legcurl" | "hipthrust" | "dbrow" | "cablerow" | "lateral" | "facepull" | "bbcurl" | "dbcurl" | "hammer" | "skull" | "pecdeck";
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
  skull: {
    folder: "/media/exercises/skull-crusher",
    label: "Press francés acostado con barra Z, vista lateral de tres cuartos",
    duration: 3.6,
    equipment: "Carga de referencia · 1 disco de 10 kg por lado",
    focus: "Tríceps",
  },
  hammer: {
    folder: "/media/exercises/hammer-curl",
    label: "Curl martillo con mancuernas en vista frontal de tres cuartos",
    duration: 3.6,
    equipment: "Un par de mancuernas",
    focus: "Braquial y antebrazo",
  },
  dbcurl: {
    folder: "/media/exercises/dumbbell-curl",
    label: "Curl de bíceps con mancuernas en vista frontal de tres cuartos",
    duration: 3.7,
    equipment: "Un par de mancuernas",
    focus: "Bíceps",
  },
  bbcurl: {
    folder: "/media/exercises/barbell-curl",
    label: "Curl de bíceps con barra recta en vista frontal de tres cuartos",
    duration: 2.9,
    equipment: "Carga de referencia · 1 disco de 10 kg por lado",
    focus: "Bíceps",
  },
  facepull: {
    folder: "/media/exercises/face-pull",
    label: "Face pull en polea con cuerda, vista de tres cuartos desde atrás",
    duration: 3.1,
    equipment: "Polea con cuerda",
    focus: "Hombro posterior y espalda alta",
  },
  lateral: {
    folder: "/media/exercises/lateral-raise",
    label: "Elevaciones laterales con mancuernas en vista frontal de tres cuartos",
    duration: 3.8,
    equipment: "Un par de mancuernas",
    focus: "Deltoides medio",
  },
  cablerow: {
    folder: "/media/exercises/seated-cable-row",
    label: "Remo sentado en polea baja con manija en V, vista de tres cuartos desde atrás",
    duration: 4.1,
    equipment: "Polea baja con manija en V",
    focus: "Espalda media",
  },
  dbrow: {
    folder: "/media/exercises/one-arm-dumbbell-row",
    label: "Remo con mancuerna a una mano apoyado en banco, vista lateral de tres cuartos",
    duration: 4.1,
    equipment: "Banco plano y una mancuerna",
    focus: "Dorsal y romboides",
  },
  hipthrust: {
    folder: "/media/exercises/hip-thrust",
    label: "Hip thrust con barra apoyado en banco, vista lateral de tres cuartos",
    duration: 4.1,
    equipment: "Carga de referencia · 1 disco de 20 kg por lado",
    focus: "Glúteos",
  },
  legcurl: {
    folder: "/media/exercises/lying-leg-curl",
    label: "Curl femoral acostado en máquina, vista lateral de tres cuartos",
    duration: 4.1,
    equipment: "Máquina de curl femoral",
    focus: "Isquiosurales",
  },
  legext: {
    folder: "/media/exercises/leg-extension",
    label: "Extensión de cuádriceps en máquina, vista lateral de tres cuartos",
    duration: 4.1,
    equipment: "Máquina de extensión de piernas",
    focus: "Cuádriceps",
  },
  lunge: {
    folder: "/media/exercises/dumbbell-lunge",
    label: "Zancada con mancuernas vista de perfil",
    duration: 4.1,
    equipment: "Un par de mancuernas",
    focus: "Cuádriceps y glúteos",
  },
  pushdown: {
    folder: "/media/exercises/triceps-pushdown",
    label: "Extensión de tríceps en polea alta con cuerda, vista lateral de tres cuartos",
    duration: 4.1,
    equipment: "Polea alta con cuerda",
    focus: "Tríceps",
  },
  pecdeck: {
    folder: "/media/exercises/machine-chest-fly",
    label: "Apertura en máquina pec deck en vista frontal de tres cuartos",
    duration: 3.1,
    equipment: "Máquina de aperturas (pec deck)",
    focus: "Pecho",
  },
  incline: {
    folder: "/media/exercises/incline-dumbbell-press",
    label: "Press inclinado con mancuernas en vista de tres cuartos",
    duration: 4.3,
    equipment: "Banco inclinado y un par de mancuernas",
    focus: "Pecho alto y hombro anterior",
  },
  ohp: {
    folder: "/media/exercises/overhead-press",
    label: "Press militar de pie con barra en vista de tres cuartos",
    duration: 4.1,
    equipment: "Carga de referencia · 1 disco de 20 kg por lado",
    focus: "Hombros y tríceps",
  },
  pulldown: {
    folder: "/media/exercises/lat-pulldown",
    label: "Jalón al pecho en polea alta visto de tres cuartos desde atrás",
    duration: 4.1,
    equipment: "Polea alta con barra ancha",
    focus: "Dorsales y bíceps",
  },
  pullup: {
    folder: "/media/exercises/pull-up",
    label: "Dominadas en barra fija vistas de tres cuartos desde atrás",
    duration: 4.1,
    equipment: "Peso corporal · barra fija",
    focus: "Dorsales y bíceps",
  },
  conventional: {
    folder: "/media/exercises/deadlift-conventional",
    label: "Peso muerto convencional con barra en vista de tres cuartos",
    duration: 4.3,
    equipment: "Carga de referencia · 1 disco de 20 kg por lado",
    focus: "Cadena posterior",
  },
  legpress: {
    folder: "/media/exercises/leg-press-45",
    label: "Prensa inclinada a 45 grados en vista de tres cuartos",
    duration: 4.2,
    equipment: "Carga de referencia · discos de 20 kg",
    focus: "Cuádriceps y glúteos",
  },
  row: {
    folder: "/media/exercises/bent-over-barbell-row",
    label: "Remo con barra en vista de tres cuartos",
    duration: 4.2,
    equipment: "Carga de referencia · 2 discos de 20 kg por lado",
    focus: "Espalda y tracción",
  },
} as const;

// Foto realista para las miniaturas de la lista (photo.webp en la carpeta de cada ejercicio).
export function exercisePhotoFor(demonstration: Demonstration | undefined): string | undefined {
  if (demonstration === undefined) return undefined;
  return `${media[demonstration].folder}/photo.webp`;
}

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
