import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import "./routine-editor.css";
import { exercisePhotoFor } from "./ExerciseRepetition.js";
import { demonstrationFor, muscleGroupFor, muscleGroups, type MuscleGroup } from "./exerciseCatalog.js";
import { Icon } from "./Icon.js";
import { defaultSetsPerExercise, estimateUniformMinutes, formatRestSeconds, formatRoutineMinutes, restOptions } from "./routineDuration.js";

export type EditorExercise = { id: string; name: string; description: string };

type Props = {
  mode: "demo" | "create" | "edit";
  initialName: string;
  initialDescription: string;
  initialExerciseIds: string[];
  /** Descanso entre series guardado en la rutina, en segundos. */
  initialRestSeconds: number;
  message: string | null;
  exercises: EditorExercise[];
  saving: boolean;
  online: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, exerciseIds: string[], restSeconds: number) => void;
};

export function RoutineEditor({ mode, initialName, initialDescription, initialExerciseIds, initialRestSeconds, message, exercises, saving, online, onClose, onSave }: Props): ReactElement {
  const demo = mode === "demo";
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [selected, setSelected] = useState<string[]>(initialExerciseIds);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "Todos">("Todos");
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [restSeconds, setRestSeconds] = useState(initialRestSeconds);
  const minutes = estimateUniformMinutes(selected.length, restSeconds);

  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const groupOf = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, muscleGroupFor({ ...exercise, muscle: exercise.description })])), [exercises]);
  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es");
    return exercises.filter((exercise) =>
      (group === "Todos" || groupOf.get(exercise.id) === group) &&
      (text.length === 0 || `${exercise.name} ${exercise.description}`.toLocaleLowerCase("es").includes(text)));
  }, [exercises, group, groupOf, query]);

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setLastAdded(selected.includes(id) ? null : id);
  };
  const move = (index: number, offset: -1 | 1) => setSelected((current) => {
    const target = index + offset;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next;
  });

  const canSave = !saving && (demo || online) && name.trim().length > 0 && (!demo || selected.length > 0);
  const saveLabel = saving ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Crear rutina";

  return <div className="drawer-layer" role="presentation" onClick={onClose}>
    <section className="routine-editor rx" role="dialog" aria-modal="true" aria-labelledby="routine-editor-title" onClick={(event) => event.stopPropagation()}>
      <div className="rx-scroll">
        <div className="drawer-header">
          <div><p className="eyebrow">{demo ? "PLAN LOCAL" : mode === "create" ? "NUEVA RUTINA" : "EDICIÓN ONLINE"}</p>
            <h2 id="routine-editor-title">{mode === "edit" ? "Editar rutina" : "Crear rutina"}</h2></div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar editor">×</button>
        </div>
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ej. Piernas y glúteos" /></label>
        <label>Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Objetivo y notas de la rutina (opcional)" /></label>

        <section className="rx-plan" aria-labelledby="rx-plan-title">
          <div className="rx-heading"><h3 id="rx-plan-title">Tu rutina</h3><span className="rx-count" aria-label={`${selected.length} ejercicios elegidos`}>{selected.length}</span></div>
          {selected.length === 0
            ? <p className="rx-empty">Tocá los ejercicios de abajo y se suman acá en el orden en que los elijas.</p>
            : <ol className="rx-order">{selected.map((id, index) => {
              const exercise = byId.get(id);
              if (exercise === undefined) return null;
              const photo = exercisePhotoFor(demonstrationFor(exercise));
              return <li key={id} className={id === lastAdded ? "is-new" : undefined}>
                <span className="rx-position">{index + 1}</span>
                {photo ? <img src={photo} alt="" width={240} height={240} /> : <span className="rx-thumb-fallback"><Icon name="train" size={16} /></span>}
                <span className="rx-order-name"><strong>{exercise.name}</strong><small>{exercise.description}</small></span>
                <span className="rx-order-actions">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir ${exercise.name}`}><Icon name="up" size={16} /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === selected.length - 1} aria-label={`Bajar ${exercise.name}`}><Icon name="down" size={16} /></button>
                  <button type="button" onClick={() => toggle(id)} aria-label={`Quitar ${exercise.name}`}><Icon name="close" size={15} /></button>
                </span>
              </li>;
            })}</ol>}
        </section>

        <section className="rx-rest" aria-labelledby="rx-rest-title">
          <div className="rx-heading"><h3 id="rx-rest-title">Descanso entre series</h3>
            {selected.length > 0 && <span className="rx-duration" aria-live="polite">Duración estimada <strong>{formatRoutineMinutes(minutes)}</strong></span>}</div>
          {demo
            ? <div className="rx-chips" role="group" aria-label="Descanso entre series">
              {restOptions.map((seconds) => <button key={seconds} type="button" aria-pressed={restSeconds === seconds} className={restSeconds === seconds ? "is-on" : undefined} onClick={() => setRestSeconds(seconds)}>{formatRestSeconds(seconds)}</button>)}
            </div>
            : <p className="muted">{formatRestSeconds(restSeconds)}, el que tiene guardado la rutina.</p>}
          <p className="rx-hint">Calculado con {defaultSetsPerExercise} series por ejercicio, unos 45 segundos por serie y un minuto y medio para cambiar de ejercicio.</p>
        </section>

        <section className="rx-library" aria-labelledby="rx-library-title">
          <div className="rx-heading"><h3 id="rx-library-title">Agregar ejercicios</h3><span className="muted">{visible.length} de {exercises.length}</span></div>
          {exercises.length === 0 ? <p className="muted">Necesitás conexión para cargar el catálogo de ejercicios.</p> : <>
            <label className="rx-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o músculo" aria-label="Buscar ejercicio" /></label>
            <div className="rx-chips" role="group" aria-label="Filtrar por grupo muscular">
              {(["Todos", ...muscleGroups] as const).map((item) => <button key={item} type="button" aria-pressed={group === item} className={group === item ? "is-on" : undefined} onClick={() => setGroup(item)}>{item}</button>)}
            </div>
            {visible.length === 0 ? <p className="rx-empty">No hay ejercicios con ese filtro. Probá con otro músculo o borrá la búsqueda.</p> : <div className="rx-grid">
              {visible.map((exercise) => {
                const position = selected.indexOf(exercise.id);
                const photo = exercisePhotoFor(demonstrationFor(exercise));
                return <button key={exercise.id} type="button" className={`rx-tile ${position >= 0 ? "is-picked" : ""}`} aria-pressed={position >= 0} onClick={() => toggle(exercise.id)}>
                  <span className="rx-tile-photo">
                    {photo ? <img src={photo} alt="" width={240} height={240} loading="lazy" decoding="async" /> : <span className="rx-thumb-fallback"><Icon name="train" size={24} /></span>}
                    <span className="rx-badge" aria-hidden="true">{position >= 0 ? position + 1 : <Icon name="plus" size={15} />}</span>
                  </span>
                  <strong>{exercise.name}</strong>
                  <small>{groupOf.get(exercise.id) ?? exercise.description}</small>
                </button>;
              })}
            </div>}
          </>}
        </section>
        {message && <p className="form-error" role="alert">{message}</p>}
        {!demo && !online && <p className="form-error" role="alert">Conectate para guardar los cambios de la rutina.</p>}
      </div>
      <div className="rx-footer">
        <p className="security-note">{demo ? "Se guarda en este teléfono." : "Se guarda en tu cuenta."}</p>
        <button className="primary-button full-button" type="button" disabled={!canSave} onClick={() => onSave(name, description, selected, restSeconds)}>
          {saveLabel}{selected.length > 0 && !saving ? ` (${selected.length})` : ""}
        </button>
      </div>
    </section>
  </div>;
}
