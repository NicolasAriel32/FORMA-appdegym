import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

const phases = [
  { label: "Inicio", at: 0, cue: "Apoyá el pie completo y prepará el tronco antes de bajar." },
  { label: "Bajada", at: 0.24, cue: "Flexioná caderas y rodillas con control y mantené los talones apoyados." },
  { label: "Fondo", at: 0.48, cue: "Frená en una profundidad que puedas controlar sin perder el apoyo." },
  { label: "Subida", at: 0.72, cue: "Empujá el piso y extendé caderas y rodillas juntas." },
] as const;

const squatMedia = "/media/exercises/squat-back-barbell";
const repetitionDuration = 4.2;

export function SquatRepetition({ videoRef, compact = false, onProgress }: {
  videoRef?: RefObject<HTMLVideoElement | null>;
  compact?: boolean;
  onProgress?: (progress: number) => void;
}): ReactElement {
  const fallbackRef = useRef<HTMLVideoElement>(null);
  const player = videoRef ?? fallbackRef;
  const [playing, setPlaying] = useState(false);
  const video = <video
    ref={player}
    className={`squat-model squat-video${compact ? " squat-video-compact" : ""}`}
    src={`${squatMedia}/repetition-pilot.mp4`}
    poster={`${squatMedia}/poster.webp`}
    aria-label="Sentadilla trasera con barra en vista de tres cuartos"
    preload="metadata"
    playsInline
    muted
    loop
    onPlay={() => setPlaying(true)}
    onPause={() => setPlaying(false)}
    onTimeUpdate={(event) => onProgress?.(event.currentTarget.currentTime / repetitionDuration)}
  />;
  if (!compact) return video;

  return <div className="workout-squat-media">
    {video}
    <button className="squat-inline-play" type="button" onClick={() => {
      const element = player.current;
      if (!element) return;
      if (element.paused) void element.play().catch(() => setPlaying(false));
      else element.pause();
    }}>{playing ? "Pausar" : "Ver movimiento"}</button>
  </div>;
}

type View = "movement" | "technique" | "muscles";
type Point = readonly [forward: number, height: number, side: number];

export function SquatPreview(): ReactElement {
  const [view, setView] = useState<View>("movement");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const position = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!playing || view !== "technique") return;
    let frame = 0;
    let previous: number | undefined;
    function render(now: number) {
      const elapsed = previous === undefined ? 0 : now - previous;
      previous = now;
      position.current = (position.current + elapsed / 4200) % 1;
      setProgress(position.current);
      frame = requestAnimationFrame(render);
    }
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [playing, view]);

  const phase = phases[progress < .09 || progress >= .94 ? 0 : progress < .41 ? 1 : progress < .56 ? 2 : 3];

  function selectView(next: View) {
    setPlaying(false);
    position.current = 0;
    setProgress(0);
    setView(next);
  }

  return <section className="squat-preview" aria-label="Demostración de sentadilla trasera">
    <p className="exercise-detail-kicker">DEMOSTRACIÓN · MODELO PILOTO</p>
    <div className="squat-controls" role="group" aria-label="Vista del ejercicio">
      <button type="button" aria-pressed={view === "movement"} onClick={() => selectView("movement")}>Movimiento</button>
      <button type="button" aria-pressed={view === "technique"} onClick={() => selectView("technique")}>Técnica lateral</button>
      <button type="button" aria-pressed={view === "muscles"} onClick={() => selectView("muscles")}>Músculos</button>
    </div>
    {view === "movement" ? <SquatRepetition videoRef={videoRef} onProgress={setProgress} /> :
      <SquatFigure progress={view === "muscles" ? .48 : progress} view={view} />}
    {view === "muscles" ? <p className="squat-cue"><strong>Cuádriceps y glúteo mayor.</strong> El color señala los grupos principales de forma orientativa.</p> : <>
      <div className="squat-controls squat-phases" role="group" aria-label="Fases de la repetición">
        {phases.map((item) => <button key={item.label} type="button" aria-pressed={phase === item} onClick={() => {
          setPlaying(false);
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = item.at * repetitionDuration;
          }
          position.current = item.at;
          setProgress(item.at);
        }}>{item.label}</button>)}
      </div>
      <p className="squat-cue"><strong>{phase.label}.</strong> {phase.cue}</p>
      {view === "technique" && <p className="squat-cue">La línea punteada marca la referencia del mediopié en esta demostración.</p>}
      <button className="secondary-button squat-play" type="button" onClick={() => {
        const video = videoRef.current;
        if (!video) {
          setPlaying(!playing);
        } else if (playing) {
          video.pause();
          setPlaying(false);
        } else {
          void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        }
      }}>{playing ? "Pausar" : "Reproducir loop"}</button>
    </>}
  </section>;
}

function SquatFigure({ progress, view }: { progress: number; view: View }): ReactElement {
  const material = useId();
  const angle = view === "technique" ? 0 : .58;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const ramp = Math.min(1, Math.max(0, progress < .48 ? (progress - .05) / .38 : (.94 - progress) / .39));
  const depth = ramp * ramp * (3 - 2 * ramp);
  const shin = .10 + .55 * depth;
  const thigh = .16 + 1.36 * depth;
  const kneeForward = 47 * Math.sin(shin);
  const kneeHeight = 8 + 47 * Math.cos(shin);
  const hipForward = kneeForward - 49 * Math.sin(thigh);
  const hipHeight = kneeHeight + 49 * Math.cos(thigh);
  const shoulderForward = 12;
  const shoulderHeight = hipHeight + Math.sqrt(49 ** 2 - (shoulderForward - hipForward) ** 2);
  const barHeight = shoulderHeight + 3;
  const body = `url(#${material})`;
  const highlighted = view === "muscles" ? "#ff927d" : body;

  function project([forward, height, side]: Point): [number, number] {
    return [149 + forward * cos + side * sin, 183 - height + (side * cos - forward * sin) * (angle === 0 ? 0 : .19)];
  }

  function limb(from: Point, to: Point, width: number, color = body) {
    const [x1, y1] = project(from);
    const [x2, y2] = project(to);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />;
  }

  function side(sign: number) {
    const knee: Point = [kneeForward, kneeHeight, sign * (16 + 2 * depth)];
    const hip: Point = [hipForward, hipHeight, sign * 12];
    const ankle: Point = [0, 8, sign * 17];
    return <g opacity={sign === -1 ? .72 : 1}>
      {limb([-8, 3, sign * 17], [22, 3, sign * 20], 8, "#9b91bb")}
      {limb(ankle, knee, 10)}
      {limb(hip, knee, 16, highlighted)}
    </g>;
  }

  function arm(sign: number) {
    const elbow: Point = [shoulderForward - 17, shoulderHeight - 19, sign * 23];
    return <g>{limb([shoulderForward, shoulderHeight, sign * 16], elbow, 10)}
      {limb(elbow, [7, barHeight, sign * 30], 7)}</g>;
  }

  const [headX, headY] = project([shoulderForward + 3, shoulderHeight + 19, 0]);
  return <svg className="squat-model" viewBox="0 0 310 202" role="img" aria-label={view === "technique" ? "Modelo lateral de sentadilla con referencia del mediopié" : "Modelo de sentadilla trasera en tres cuartos"}>
    <defs><linearGradient id={material} x2="100%" y2="100%"><stop stopColor="#dcd2ff" /><stop offset="1" stopColor="#8074c0" /></linearGradient></defs>
    <path d="M58 188 H252" stroke="#534a71" />
    {view === "technique" && <path d="M156 23 V184" stroke="#aa94f4" strokeDasharray="4 5" />}
    {side(-1)}
    {arm(-1)}
    {limb([hipForward, hipHeight, 0], [shoulderForward, shoulderHeight, 0], 27)}
    {limb([hipForward, hipHeight, -10], [hipForward, hipHeight, 10], 19, highlighted)}
    {side(1)}
    <ellipse cx={headX} cy={headY} rx="8" ry="10" fill={body} />
    {limb([7, barHeight, -50], [7, barHeight, 50], 4, "#e1dafa")}
    {arm(1)}
    {limb([7, barHeight, -43], [7, barHeight, -47], 22, "#a094d5")}
    {limb([7, barHeight, 43], [7, barHeight, 47], 22, "#d9ccff")}
  </svg>;
}
