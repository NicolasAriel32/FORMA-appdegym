import { useState } from "react";
import type { ReactElement } from "react";
import "./set-logger.css";
import { Icon } from "./Icon.js";

export type LoggedSet = { id: string; loadKg: number; repetitions: number };
export type RestState = { running: boolean; seconds: number; total: number; onAdjust: (deltaSeconds: number) => void; onSkip: () => void };

type Props = {
  exerciseId: string;
  targetSets: number;
  sets: LoggedSet[];
  disabled: boolean;
  rest: RestState;
  onComplete: (loadKg: number, repetitions: number) => Promise<boolean>;
  onRemove: (setId: string) => Promise<boolean>;
  /** Nombre del siguiente ejercicio y cómo ir; sin siguiente, el botón no aparece. */
  next?: { name: string; onGo: () => void } | undefined;
};

const LOAD_STEP = 2.5;

function formatKg(value: number): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function parseLoad(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseReps(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* sin vibración en este equipo */ }
}

/** Montalo con key={exerciseId}: cada ejercicio arranca con su propia planilla. */
export function SetLogger({ exerciseId, targetSets, sets, disabled, rest, onComplete, onRemove, next }: Props): ReactElement {
  const [extraRows, setExtraRows] = useState(0);
  const last = sets.at(-1);
  const [load, setLoad] = useState(last ? formatKg(last.loadKg) : "");
  const [reps, setReps] = useState(last ? String(last.repetitions) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const planned = Math.max(targetSets + extraRows, sets.length);
  const upcoming = Math.max(planned - sets.length - 1, 0);
  const hasActive = planned > sets.length;
  const activeNumber = sets.length + 1;
  const volume = sets.reduce((total, set) => total + set.loadKg * set.repetitions, 0);
  const loadValue = parseLoad(load);
  const repsValue = parseReps(reps);
  const preview = loadValue !== null && repsValue !== null ? `${formatKg(loadValue)} kg × ${repsValue}` : "Igual que la anterior";

  function stepLoad(direction: 1 | -1): void {
    const current = loadValue ?? 0;
    setLoad(formatKg(Math.max(0, Math.round((current + direction * LOAD_STEP) * 100) / 100)));
    setError(null);
  }

  function stepReps(direction: 1 | -1): void {
    setReps(String(Math.max(1, (repsValue ?? 0) + direction)));
    setError(null);
  }

  async function complete(): Promise<void> {
    if (busy || disabled) return;
    if (loadValue === null || repsValue === null) {
      setError(loadValue === null ? "Poné cuántos kilos usaste (0 si fue sin peso)." : "Poné cuántas repeticiones hiciste.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await onComplete(loadValue, repsValue)) {
        vibrate(15);
        setJustSaved(`${sets.length}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function undo(set: LoggedSet, index: number): Promise<void> {
    if (busy || disabled) return;
    setBusy(true);
    try {
      if (await onRemove(set.id)) {
        if (index === sets.length - 1) {
          setLoad(formatKg(set.loadKg));
          setReps(String(set.repetitions));
        }
        setJustSaved(null);
      }
    } finally {
      setBusy(false);
    }
  }

  function removePlannedRow(): void {
    setExtraRows((current) => Math.max(current - 1, sets.length - targetSets));
  }

  return <section className="sl" aria-label="Registro de series">
    <header className="sl-summary">
      <div className="sl-dots" aria-hidden="true">{Array.from({ length: planned }, (_, index) => <span key={index} className={index < sets.length ? "is-done" : index === sets.length ? "is-now" : undefined} />)}</div>
      <p><strong>{sets.length} de {planned}</strong> series{volume > 0 ? <> · <strong>{formatKg(volume)} kg</strong> levantados</> : null}</p>
    </header>

    {sets.length > 0 && <ol className="sl-done" aria-label="Series completadas">
      {sets.map((set, index) => <li key={set.id} className={justSaved === `${index}` ? "is-fresh" : undefined}>
        <span className="sl-check" aria-hidden="true"><Icon name="check" size={15} /></span>
        <span className="sl-done-text"><span className="sl-done-number">Serie {index + 1}</span><strong>{formatKg(set.loadKg)} kg × {set.repetitions}</strong></span>
        <button type="button" className="sl-icon-button" onClick={() => void undo(set, index)} disabled={busy || disabled} aria-label={`Deshacer serie ${index + 1}`}><Icon name="undo" size={17} /></button>
      </li>)}
    </ol>}

    {rest.running && <div className="sl-rest" role="timer" aria-live="off" aria-label="Descanso">
      <div className="sl-rest-bar"><span style={{ width: `${Math.min(100, (rest.seconds / Math.max(rest.total, 1)) * 100)}%` }} /></div>
      <div className="sl-rest-row">
        <div><span className="sl-rest-label">Descanso</span><strong>{Math.floor(rest.seconds / 60)}:{String(rest.seconds % 60).padStart(2, "0")}</strong></div>
        <div className="sl-rest-actions">
          <button type="button" onClick={() => rest.onAdjust(-15)} aria-label="Restar 15 segundos">−15</button>
          <button type="button" onClick={() => rest.onAdjust(15)} aria-label="Sumar 15 segundos">+15</button>
          <button type="button" className="sl-rest-skip" onClick={rest.onSkip}><Icon name="skip" size={14} /> Saltar</button>
        </div>
      </div>
    </div>}

    {hasActive ? <div className="sl-active">
      <div className="sl-active-head">
        <h3>Serie {activeNumber}</h3>
        <button type="button" className="sl-text-button" onClick={removePlannedRow} disabled={planned <= 1 && sets.length === 0}>Quitar serie</button>
      </div>
      <div className="sl-steppers">
        <div className="sl-stepper">
          <label htmlFor={`sl-load-${exerciseId}`}>Kilos</label>
          <div className="sl-stepper-row">
            <button type="button" onClick={() => stepLoad(-1)} aria-label="Restar 2,5 kg"><Icon name="minus" size={18} /></button>
            <input id={`sl-load-${exerciseId}`} value={load} onChange={(event) => { setLoad(event.target.value); setError(null); }} inputMode="decimal" placeholder="0" autoComplete="off" />
            <button type="button" onClick={() => stepLoad(1)} aria-label="Sumar 2,5 kg"><Icon name="plus" size={18} /></button>
          </div>
        </div>
        <div className="sl-stepper">
          <label htmlFor={`sl-reps-${exerciseId}`}>Repeticiones</label>
          <div className="sl-stepper-row">
            <button type="button" onClick={() => stepReps(-1)} aria-label="Restar una repetición"><Icon name="minus" size={18} /></button>
            <input id={`sl-reps-${exerciseId}`} value={reps} onChange={(event) => { setReps(event.target.value); setError(null); }} inputMode="numeric" placeholder="0" autoComplete="off" />
            <button type="button" onClick={() => stepReps(1)} aria-label="Sumar una repetición"><Icon name="plus" size={18} /></button>
          </div>
        </div>
      </div>
      {error && <p className="sl-error" role="alert">{error}</p>}
      <button type="button" className="primary-button sl-complete" onClick={() => void complete()} disabled={busy || disabled}>
        <Icon name="check" size={19} /> {busy ? "Guardando…" : `Completar serie ${activeNumber}`}
      </button>
    </div> : <div className="sl-finished">
      <span className="sl-finished-icon" aria-hidden="true"><Icon name="check" size={22} /></span>
      <div><h3>Ejercicio completo</h3><p>{sets.length} {sets.length === 1 ? "serie registrada" : "series registradas"}.{next ? " Cuando quieras, seguí con el próximo." : " Fue el último: finalizá la sesión cuando estés listo."}</p></div>
      {next && <button type="button" className="primary-button sl-next" onClick={next.onGo}>Seguir con {next.name} <Icon name="arrow" size={17} /></button>}
    </div>}

    {upcoming > 0 && <ol className="sl-upcoming" aria-label="Series que faltan" start={activeNumber + 1}>
      {Array.from({ length: upcoming }, (_, index) => <li key={index}>
        <span className="sl-upcoming-number">Serie {activeNumber + 1 + index}</span>
        <span className="sl-upcoming-preview">{preview}</span>
        <button type="button" className="sl-icon-button" onClick={removePlannedRow} aria-label={`Quitar serie ${activeNumber + 1 + index}`}><Icon name="close" size={15} /></button>
      </li>)}
    </ol>}

    <button type="button" className="secondary-button sl-add" onClick={() => setExtraRows((current) => current + 1)} disabled={disabled}><Icon name="plus" size={17} /> Agregar serie</button>
  </section>;
}
