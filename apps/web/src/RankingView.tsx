import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import "./ranking.css";
import "./set-logger.css";
import { exercisePhotoFor } from "./ExerciseRepetition.js";
import { Icon } from "./Icon.js";
import {
  estimate1rm,
  fetchLeaderboard,
  formatKg,
  isRankable,
  LIFTS,
  MAX_RANKED_REPS,
  type Athlete,
  type AthleteSex,
  type LeaderboardRow,
  type LiftCode,
  type PendingMark,
} from "./platform/leaderboard.js";

type Props = {
  loadClient: (() => Promise<SupabaseClient>) | null;
  signedIn: boolean;
  athlete: Athlete | null;
  online: boolean;
  refreshKey: number;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onJoin: (displayName: string, sex: AthleteSex) => Promise<void>;
  onPublish: (mark: PendingMark) => Promise<boolean>;
};

const sexLabel: Record<AthleteSex, string> = { M: "Hombres", F: "Mujeres" };

export function RankingView({ loadClient, signedIn, athlete, online, refreshKey, onCreateAccount, onSignIn, onJoin, onPublish }: Props): ReactElement {
  const [lift, setLift] = useState<LiftCode>("bench");
  const [sex, setSex] = useState<AthleteSex>(athlete?.sex ?? "M");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => { if (athlete?.sex) setSex(athlete.sex); }, [athlete?.sex]);

  useEffect(() => {
    if (loadClient === null) { setRows([]); return; }
    if (!online) { setError("Conectate para ver el ranking."); setRows(null); return; }
    let active = true;
    setRows(null);
    setError(null);
    void loadClient()
      .then((client) => fetchLeaderboard(client, lift, sex))
      .then((result) => { if (active) setRows(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar el ranking."); });
    return () => { active = false; };
  }, [loadClient, lift, sex, online, refreshKey, reload]);

  const current = LIFTS.find((item) => item.code === lift)!;
  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  const me = rows?.find((row) => row.isMe);
  const participating = signedIn && athlete?.enabled === true && athlete.sex !== null;

  return <div className="screen-stack rk">
    <section className="screen-header-row"><div><p className="eyebrow">RANKING FORMA</p><h1>Pesos pesados</h1><p className="screen-subtitle">El 1RM estimado más alto de cada persona en los cuatro básicos.</p></div></section>

    <div className="rk-lifts" role="group" aria-label="Elegí el ejercicio">
      {LIFTS.map((item) => {
        const photo = exercisePhotoFor(item.demonstration);
        return <button key={item.code} type="button" className={item.code === lift ? "is-on" : undefined} aria-pressed={item.code === lift} onClick={() => setLift(item.code)}>
          {photo ? <img src={photo} alt="" width={240} height={240} /> : null}
          <span>{item.name}</span>
        </button>;
      })}
    </div>

    <div className="segmented-control rk-sex" role="group" aria-label="Tabla">
      {(["M", "F"] as const).map((value) => <button key={value} type="button" className={sex === value ? "is-selected" : undefined} aria-pressed={sex === value} onClick={() => setSex(value)}>{sexLabel[value]}</button>)}
    </div>

    <section className="rk-board" aria-labelledby="rk-board-title" aria-busy={rows === null && error === null}>
      <h2 id="rk-board-title" className="rk-board-title">{current.name} · {sexLabel[sex]}</h2>
      {error ? <div className="rk-empty"><p>{error}</p>{online ? <button type="button" className="secondary-button" onClick={() => setReload((value) => value + 1)}>Reintentar</button> : null}</div>
        : rows === null ? <p className="rk-loading" role="status">Cargando ranking…</p>
        : rows.length === 0 ? <div className="rk-empty"><p>Todavía nadie cargó su marca en {current.name.toLocaleLowerCase("es")}. La primera puede ser la tuya.</p></div>
        : <>
          <ol className="rk-podium" aria-label="Podio">
            {podium.map((row) => <li key={`${row.position}-${row.displayName}`} className={`rk-step rk-step-${Math.min(row.position, 3)} ${row.isMe ? "is-me" : ""}`}>
              <span className="rk-medal" aria-label={`Puesto ${row.position}`}>{row.position}</span>
              <strong className="rk-name">{row.displayName}{row.isMe ? " (vos)" : ""}</strong>
              <span className="rk-score"><b>{formatKg(row.estimated1rm)}</b> kg</span>
              <small>{formatKg(row.loadKg)} kg × {row.repetitions}</small>
            </li>)}
          </ol>
          {rest.length > 0 && <ol className="rk-list" aria-label="Resto de la tabla">
            {rest.map((row) => <li key={`${row.position}-${row.displayName}`} className={row.isMe ? "is-me" : undefined}>
              <span className="rk-pos">{row.position}</span>
              <span className="rk-list-name"><strong>{row.displayName}{row.isMe ? " (vos)" : ""}</strong><small>{formatKg(row.loadKg)} kg × {row.repetitions}</small></span>
              <span className="rk-list-score">{formatKg(row.estimated1rm)} kg</span>
            </li>)}
          </ol>}
        </>}
    </section>

    <section className="rk-cta">
      {!signedIn ? <>
        <h2>Aparecé en la tabla</h2>
        <p>Creá tu cuenta y tus mejores series de sentadilla, banca, peso muerto y press militar entran solas al ranking.</p>
        <button type="button" className="primary-button full-button" onClick={onCreateAccount} disabled={loadClient === null}>Crear cuenta</button>
        <button type="button" className="sl-text-button" onClick={onSignIn} disabled={loadClient === null}>Ya tengo cuenta</button>
      </> : !participating ? <JoinForm athlete={athlete} onJoin={onJoin} />
      : <>
        <h2>{me ? `Estás en el puesto ${me.position}` : "Sumá tu marca"}</h2>
        <p>{me ? `Tu mejor ${current.name.toLocaleLowerCase("es")}: ${formatKg(me.loadKg)} kg × ${me.repetitions}.` : "Cuando termines un entrenamiento, tu mejor serie de cada básico se envía sola. También podés cargarla a mano."}</p>
        <button type="button" className="primary-button full-button" onClick={() => setMarkOpen(true)} disabled={!online}>Cargar marca</button>
      </>}
    </section>

    <p className="rk-note">El 1RM estimado es el peso que podrías levantar una vez, calculado con la fórmula de Epley a partir de series de 1 a {MAX_RANKED_REPS} repeticiones. Por ejemplo, 100 kg × 5 equivale a unos {formatKg(estimate1rm(100, 5))} kg.</p>

    {markOpen && <MarkSheet lift={lift} onClose={() => setMarkOpen(false)} onSubmit={async (mark) => {
      const improved = await onPublish(mark);
      setLift(mark.lift);
      setReload((value) => value + 1);
      return improved;
    }} />}
  </div>;
}

function JoinForm({ athlete, onJoin }: { athlete: Athlete | null; onJoin: Props["onJoin"] }): ReactElement {
  const [name, setName] = useState(athlete?.displayName ?? "");
  const [sex, setSex] = useState<AthleteSex | null>(athlete?.sex ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <form className="rk-join" onSubmit={(event) => {
    event.preventDefault();
    if (name.trim().length === 0 || sex === null) { setError("Completá tu nombre y elegí la tabla."); return; }
    setBusy(true); setError(null);
    void onJoin(name, sex).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo sumarte.")).finally(() => setBusy(false));
  }}>
    <h2>Sumate al ranking</h2>
    <label>Nombre visible<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Como querés aparecer" /></label>
    <fieldset className="rk-sex-pick"><legend>Tabla</legend>
      {(["M", "F"] as const).map((value) => <label key={value} className={sex === value ? "is-on" : undefined}><input type="radio" name="rk-join-sex" checked={sex === value} onChange={() => setSex(value)} />{sexLabel[value]}</label>)}
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="primary-button full-button" disabled={busy}>{busy ? "Sumándote…" : "Sumarme"}</button>
  </form>;
}

function MarkSheet({ lift: initialLift, onClose, onSubmit }: { lift: LiftCode; onClose: () => void; onSubmit: (mark: PendingMark) => Promise<boolean> }): ReactElement {
  const [lift, setLift] = useState(initialLift);
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("1");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadValue = Number(load.replace(",", "."));
  const repsValue = Number(reps);
  const valid = load.trim().length > 0 && isRankable(loadValue, repsValue);
  const name = LIFTS.find((item) => item.code === lift)!.name;

  return <div className="drawer-layer rk-sheet-layer" role="presentation" onClick={onClose}>
    <section className="rk-sheet" role="dialog" aria-modal="true" aria-labelledby="rk-sheet-title" onClick={(event) => event.stopPropagation()}>
      <div className="drawer-header"><h2 id="rk-sheet-title">Cargar marca</h2><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar">×</button></div>
      <div className="rk-chip-row" role="group" aria-label="Ejercicio">
        {LIFTS.map((item) => <button key={item.code} type="button" className={item.code === lift ? "is-on" : undefined} aria-pressed={item.code === lift} onClick={() => { setLift(item.code); setResult(null); }}>{item.name}</button>)}
      </div>
      <div className="sl-steppers">
        <div className="sl-stepper"><label htmlFor="rk-load">Kilos</label><div className="sl-stepper-row">
          <button type="button" onClick={() => setLoad(formatStep((Number(load.replace(",", ".")) || 0) - 2.5))} aria-label="Restar 2,5 kg"><Icon name="minus" size={18} /></button>
          <input id="rk-load" value={load} onChange={(event) => { setLoad(event.target.value); setError(null); }} inputMode="decimal" placeholder="0" autoComplete="off" />
          <button type="button" onClick={() => setLoad(formatStep((Number(load.replace(",", ".")) || 0) + 2.5))} aria-label="Sumar 2,5 kg"><Icon name="plus" size={18} /></button>
        </div></div>
        <div className="sl-stepper"><label htmlFor="rk-reps">Repeticiones</label><div className="sl-stepper-row">
          <button type="button" onClick={() => setReps(String(Math.max(1, (Number(reps) || 1) - 1)))} aria-label="Restar una repetición"><Icon name="minus" size={18} /></button>
          <input id="rk-reps" value={reps} onChange={(event) => { setReps(event.target.value); setError(null); }} inputMode="numeric" placeholder="1" autoComplete="off" />
          <button type="button" onClick={() => setReps(String(Math.min(MAX_RANKED_REPS, (Number(reps) || 0) + 1)))} aria-label="Sumar una repetición"><Icon name="plus" size={18} /></button>
        </div></div>
      </div>
      <p className="rk-preview" aria-live="polite">{valid ? <>1RM estimado: <b>{formatKg(estimate1rm(loadValue, repsValue))} kg</b></> : `Usá entre 1 y ${MAX_RANKED_REPS} repeticiones.`}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <p className="rk-result" role="status">{result}</p>}
      <button type="button" className="primary-button full-button" disabled={!valid || busy} onClick={() => {
        setBusy(true); setError(null); setResult(null);
        void onSubmit({ lift, loadKg: loadValue, repetitions: repsValue, recordedAt: new Date().toISOString() })
          .then((improved) => setResult(improved ? `¡Nuevo récord en ${name.toLocaleLowerCase("es")}!` : `Guardado. Tu marca anterior en ${name.toLocaleLowerCase("es")} sigue siendo mejor.`))
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo enviar la marca."))
          .finally(() => setBusy(false));
      }}>{busy ? "Enviando…" : "Enviar al ranking"}</button>
    </section>
  </div>;
}

function formatStep(value: number): string {
  return String(Math.max(0, Math.round(value * 100) / 100)).replace(".", ",");
}
