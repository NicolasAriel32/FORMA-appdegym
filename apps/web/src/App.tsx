import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  loadCurrentSession,
  signInWithPassword,
  signOut,
  subscribeToAuthChanges,
  type WebAuthError,
} from "./platform/auth.js";
import { createConfiguredBrowserSupabaseClient } from "./platform/supabase-client.js";

export default function App(): ReactElement {
  const [online, setOnline] = useState(() => navigator.onLine);
  const supabase = useMemo(() => createConfiguredBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (supabase === null) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    void loadCurrentSession(supabase)
      .then((currentSession) => {
        if (active) {
          setSession(currentSession);
        }
      })
      .catch(() => {
        if (active) {
          setAuthMessage("No se pudo comprobar la sesión actual.");
        }
      })
      .finally(() => {
        if (active) {
          setAuthLoading(false);
        }
      });

    const unsubscribe = subscribeToAuthChanges(supabase, (nextSession) => {
      if (active) {
        setSession(nextSession);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setAuthMessage(null);
    if (supabase === null) {
      setAuthMessage("La autenticación todavía no está configurada en este entorno.");
      return;
    }
    if (!online) {
      setAuthMessage("Necesitás conexión para iniciar sesión.");
      return;
    }

    setAuthBusy(true);
    try {
      const nextSession = await signInWithPassword(supabase, email, password);
      setSession(nextSession);
      setPassword("");
    } catch (error) {
      setAuthMessage(toAuthMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (supabase === null) {
      return;
    }
    setAuthMessage(null);
    setAuthBusy(true);
    try {
      await signOut(supabase);
      setSession(null);
    } catch (error) {
      setAuthMessage(toAuthMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">FORMA · MVP técnico</p>
        <h1 id="app-title">Entrená con continuidad.</h1>
        <p className="lead">
          La carcasa PWA está lista. El entrenamiento offline, la identidad y la sincronización se incorporarán por incrementos verificables.
        </p>
        <div className={`connection-status ${online ? "is-online" : "is-offline"}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {online ? "Con conexión" : "Sin conexión"}
        </div>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <div>
          <p className="eyebrow">Identidad</p>
          <h2 id="auth-title">Acceso seguro</h2>
        </div>
        {authLoading ? <p className="muted">Comprobando sesión…</p> : null}
        {!authLoading && session !== null ? (
          <div className="signed-in-panel">
            <p className="muted">
              Sesión online activa{session.user.email ? ` para ${session.user.email}` : ""}.
            </p>
            <p className="security-note">
              La persistencia de credenciales offline todavía no está habilitada. Tus entrenamientos offline se incorporarán con una política de desbloqueo explícita.
            </p>
            <button type="button" onClick={() => void handleSignOut()} disabled={authBusy}>
              {authBusy ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        ) : null}
        {!authLoading && session === null ? (
          <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
            <label>
              Correo
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={authBusy || supabase === null}>
              {authBusy ? "Ingresando…" : "Iniciar sesión"}
            </button>
            {supabase === null ? (
              <p className="security-note">Configurá las variables VITE_SUPABASE_* para habilitar este entorno.</p>
            ) : null}
          </form>
        ) : null}
        {authMessage !== null ? <p className="form-error" role="alert">{authMessage}</p> : null}
      </section>

      <section className="technical-card" aria-labelledby="status-title">
        <div>
          <p className="eyebrow">Estado del proyecto</p>
          <h2 id="status-title">Base offline-first preparada</h2>
        </div>
        <ul>
          <li>Persistencia local atómica</li>
          <li>Outbox con operaciones idempotentes</li>
          <li>Recuperación por cursor y snapshot</li>
        </ul>
      </section>
    </main>
  );
}

function toAuthMessage(error: unknown): string {
  if (error !== null && typeof error === "object" && "message" in error) {
    const message = (error as WebAuthError).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return "No se pudo completar la operación de autenticación.";
}
