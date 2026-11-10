import { useRef, useState } from "react";
import { ExerciseRepetition } from "./ExerciseRepetition.js";
import type { ExerciseVisualMode } from "./ExerciseRepetition.js";
import type { ReactElement } from "react";

const phases = [
  { label: "Inicio", at: 0, cue: "Apoyá el pie completo y prepará el tronco antes de bajar." },
  { label: "Bajada", at: 0.24, cue: "Flexioná caderas y rodillas con control y mantené los talones apoyados." },
  { label: "Fondo", at: 0.48, cue: "Frená en una profundidad que puedas controlar sin perder el apoyo." },
  { label: "Subida", at: 0.72, cue: "Empujá el piso y extendé caderas y rodillas juntas." },
] as const;

const repetitionDuration = 4.2;

export function SquatPreview(): ReactElement {
  const [view, setView] = useState<ExerciseVisualMode>("movement");
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const phase = phases[progress < .09 || progress >= .94 ? 0 : progress < .41 ? 1 : progress < .56 ? 2 : 3];

  return <section className="squat-preview" aria-label="Demostración de sentadilla trasera">
    <p className="exercise-detail-kicker">ANIMACIÓN 3D · LOOP EN TODAS LAS VISTAS</p>
    <div className="squat-controls" role="group" aria-label="Vista del ejercicio">
      <button type="button" aria-pressed={view === "movement"} onClick={() => setView("movement")}>Movimiento</button>
      <button type="button" aria-pressed={view === "technique"} onClick={() => setView("technique")}>Técnica lateral</button>
      <button type="button" aria-pressed={view === "muscles"} onClick={() => setView("muscles")}>Músculos</button>
    </div>
    <ExerciseRepetition
      videoRef={videoRef}
      view={view}
      onProgress={setProgress}
      muscles={["Cuádriceps", "Glúteo mayor"]}
    />
    {view !== "muscles" && <>
      <div className="squat-controls squat-phases" role="group" aria-label="Fases de la repetición">
        {phases.map((item) => <button key={item.label} type="button" aria-pressed={phase === item} onClick={() => {
          if (videoRef.current) videoRef.current.currentTime = item.at * repetitionDuration;
        }}>{item.label}</button>)}
      </div>
      <p className="squat-cue"><strong>{phase.label}.</strong> {phase.cue}</p>
      {view === "technique" && <p className="squat-cue">La referencia acompaña la trayectoria de la barra y la alineación de la rodilla durante el loop.</p>}
    </>}
  </section>;
}
