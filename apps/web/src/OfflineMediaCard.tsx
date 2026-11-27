import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  downloadExerciseMedia,
  formatMegabytes,
  isOnMeteredConnection,
  readMediaStatus,
  type MediaStatus,
} from "./platform/offline-media.js";

type CardState =
  | { kind: "checking" }
  | { kind: "unavailable" }
  | { kind: "idle"; status: MediaStatus }
  | { kind: "downloading"; done: number; total: number; bytes: number }
  | { kind: "done"; status: MediaStatus; failed: number };

export function OfflineMediaCard({ online }: { online: boolean }): ReactElement {
  const [state, setState] = useState<CardState>({ kind: "checking" });

  useEffect(() => {
    let active = true;
    void readMediaStatus().then((status) => {
      if (!active) return;
      setState(status === null ? { kind: "unavailable" } : { kind: "idle", status });
    });
    return () => { active = false; };
  }, []);

  async function startDownload(bytes: number): Promise<void> {
    setState({ kind: "downloading", done: 0, total: 1, bytes });
    try {
      const result = await downloadExerciseMedia(({ done, total }) => setState({ kind: "downloading", done, total, bytes }));
      const status = await readMediaStatus();
      setState(status === null ? { kind: "unavailable" } : { kind: "done", status, failed: result.failed });
    } catch {
      setState({ kind: "unavailable" });
    }
  }

  const heading = <h3 id="offline-media-title">Uso sin conexión</h3>;

  if (state.kind === "checking") {
    return <section className="offline-media-card" aria-labelledby="offline-media-title">{heading}<p className="muted">Revisando videos guardados…</p></section>;
  }
  if (state.kind === "unavailable") {
    return <section className="offline-media-card" aria-labelledby="offline-media-title">{heading}<p className="muted">Instalá o abrí FORMA desde su dirección segura para poder guardar los videos en el teléfono.</p></section>;
  }

  if (state.kind === "downloading") {
    const percent = Math.round((state.done / Math.max(state.total, 1)) * 100);
    return <section className="offline-media-card" aria-labelledby="offline-media-title">
      {heading}
      <p className="muted" role="status" aria-live="polite">Descargando ejercicios… {percent}%</p>
      <div className="offline-media-progress" role="progressbar" aria-label="Descarga de ejercicios" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
      <p className="security-note">Podés cerrar el perfil: la descarga sigue mientras la app esté abierta.</p>
    </section>;
  }

  const status = state.status;
  const complete = status.cached >= status.total;
  const failed = state.kind === "done" ? state.failed : 0;
  const metered = isOnMeteredConnection();
  const sizeLabel = status.bytes > 0 ? ` (${formatMegabytes(status.bytes)})` : "";

  return <section className="offline-media-card" aria-labelledby="offline-media-title">
    {heading}
    {complete
      ? <p className="offline-media-ready" role="status"><span aria-hidden="true">✓</span> Todos los ejercicios están guardados. Sus videos funcionan sin conexión.</p>
      : <p className="muted">Guardá los videos de los {status.exercises} ejercicios en el teléfono para entrenar sin señal en el gimnasio{sizeLabel}.{status.savedExercises > 0 ? ` Ya tenés ${status.savedExercises} guardado${status.savedExercises === 1 ? "" : "s"}.` : ""}</p>}
    {failed > 0 ? <p className="form-error" role="alert">No se pudieron bajar {failed} archivo{failed === 1 ? "" : "s"}. Probá de nuevo con mejor conexión.</p> : null}
    {!complete && metered ? <p className="security-note">Parece que estás con datos móviles. Conviene hacerlo con Wi‑Fi.</p> : null}
    {!complete ? <button className="secondary-button full-button" type="button" disabled={!online} onClick={() => void startDownload(status.bytes)}>{online ? (status.cached > 0 ? "Descargar los que faltan" : "Descargar ejercicios") : "Necesitás conexión para descargar"}</button> : null}
  </section>;
}
