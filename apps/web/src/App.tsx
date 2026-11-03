import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  loadCurrentSession,
  signInWithPassword,
  signOut,
  subscribeToAuthChanges,
  type WebAuthError,
} from "./platform/auth.js";
import {
  createConfiguredBrowserApiBaseUrl,
  fetchCurrentUser,
  type ApiUser,
} from "./platform/api-client.js";
import { createConfiguredBrowserSupabaseClient } from "./platform/supabase-client.js";

type AppTab = "home" | "routines" | "train" | "progress" | "exercises";
type IconName =
  | "home"
  | "routines"
  | "train"
  | "progress"
  | "exercises"
  | "profile"
  | "arrow"
  | "bolt"
  | "clock"
  | "search"
  | "plus"
  | "check"
  | "chevron"
  | "logout";

const tabs: Array<{ id: AppTab; label: string; icon: IconName }> = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "routines", label: "Rutinas", icon: "routines" },
  { id: "train", label: "Entrenar", icon: "train" },
  { id: "progress", label: "Progreso", icon: "progress" },
  { id: "exercises", label: "Ejercicios", icon: "exercises" },
];

const demoRoutines = [
  { name: "Piernas · Fuerza", detail: "6 ejercicios · 52 min", accent: "violet", progress: 72 },
  { name: "Pecho y espalda", detail: "8 ejercicios · 61 min", accent: "blue", progress: 44 },
  { name: "Full body", detail: "7 ejercicios · 48 min", accent: "green", progress: 18 },
];

const demoExercises = [
  { name: "Sentadilla con barra", muscle: "Cuádriceps · Glúteos", rank: "Intermedio", color: "violet" },
  { name: "Press banca plano", muscle: "Pecho · Tríceps", rank: "Intermedio", color: "blue" },
  { name: "Remo con barra", muscle: "Espalda · Bíceps", rank: "Principiante", color: "green" },
  { name: "Peso muerto rumano", muscle: "Isquios · Glúteos", rank: "Intermedio", color: "orange" },
];

export default function App(): ReactElement {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [completedSets, setCompletedSets] = useState(2);
  const [exerciseQuery, setExerciseQuery] = useState("");

  const supabase = useMemo(() => createConfiguredBrowserSupabaseClient(), []);
  const apiBaseUrl = useMemo(() => createConfiguredBrowserApiBaseUrl(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [serverUser, setServerUser] = useState<ApiUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [serverIdentityLoading, setServerIdentityLoading] = useState(false);
  const [serverIdentityMessage, setServerIdentityMessage] = useState<string | null>(null);

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
        if (active) setSession(currentSession);
      })
      .catch(() => {
        if (active) setAuthMessage("No se pudo comprobar la sesión actual.");
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    const unsubscribe = subscribeToAuthChanges(supabase, (nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (session === null || apiBaseUrl === undefined) {
      setServerUser(null);
      setServerIdentityLoading(false);
      setServerIdentityMessage(null);
      return;
    }

    let active = true;
    setServerIdentityLoading(true);
    setServerIdentityMessage(null);
    void fetchCurrentUser({ apiBaseUrl, accessToken: session.access_token })
      .then((user) => {
        if (active) setServerUser(user);
      })
      .catch((error) => {
        if (active) {
          setServerUser(null);
          setServerIdentityMessage(toApiMessage(error));
        }
      })
      .finally(() => {
        if (active) setServerIdentityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl, session]);

  const filteredExercises = demoExercises.filter((exercise) => {
    const query = exerciseQuery.trim().toLowerCase();
    return query.length === 0 || `${exercise.name} ${exercise.muscle}`.toLowerCase().includes(query);
  });

  function startWorkout(): void {
    setSessionStarted(true);
    setActiveTab("train");
  }

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
    if (supabase === null) return;
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
    <div className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-mark" aria-label="FORMA">
          <span className="brand-symbol">F</span>
          <span>FORMA</span>
        </div>
        <div className="topbar-actions">
          <span className={`sync-pill ${online ? "is-online" : "is-offline"}`}>
            <span className="sync-dot" aria-hidden="true" />
            {online ? "Online" : "Offline"}
          </span>
          <button className="profile-button" type="button" aria-label="Abrir perfil" onClick={() => setProfileOpen(true)}>
            {session?.user.email?.slice(0, 1).toUpperCase() ?? "N"}
          </button>
        </div>
      </header>

      <main className="app-content">
        {activeTab === "home" ? <HomeView onStart={startWorkout} /> : null}
        {activeTab === "routines" ? <RoutinesView onStart={startWorkout} /> : null}
        {activeTab === "train" ? <TrainView started={sessionStarted} completedSets={completedSets} onStart={startWorkout} onCompleteSet={() => setCompletedSets((value) => Math.min(value + 1, 8))} /> : null}
        {activeTab === "progress" ? <ProgressView /> : null}
        {activeTab === "exercises" ? <ExercisesView query={exerciseQuery} onQueryChange={setExerciseQuery} exercises={filteredExercises} /> : null}
      </main>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {tabs.map((tab) => (
          <button className={`nav-item ${activeTab === tab.id ? "is-active" : ""} ${tab.id === "train" ? "train-nav-item" : ""}`} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}>
            <span className={tab.id === "train" ? "train-nav-icon" : "nav-icon"}><Icon name={tab.icon} size={tab.id === "train" ? 21 : 19} /></span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {profileOpen ? <ProfileDrawer session={session} serverUser={serverUser} authLoading={authLoading} authBusy={authBusy} authMessage={authMessage} serverIdentityLoading={serverIdentityLoading} serverIdentityMessage={serverIdentityMessage} email={email} password={password} supabaseConfigured={supabase !== null} onClose={() => setProfileOpen(false)} onSubmit={(event) => void handleSubmit(event)} onEmailChange={setEmail} onPasswordChange={setPassword} onSignOut={() => void handleSignOut()} /> : null}
    </div>
  );
}

function HomeView({ onStart }: { onStart: () => void }): ReactElement {
  return (
    <div className="screen-stack">
      <section className="welcome-block"><div><p className="eyebrow">MI ENTRENAMIENTO</p><h1>Entrená con intención.</h1><p className="screen-subtitle">Una sesión consistente vale más que una sesión perfecta.</p></div><span className="demo-label">Vista de diseño</span></section>
      <section className="featured-workout"><div className="featured-glow" aria-hidden="true" /><div className="featured-copy"><span className="card-kicker">PRÓXIMO ENTRENAMIENTO</span><h2>Piernas <span>·</span> Fuerza</h2><p><Icon name="clock" size={15} /> 6 ejercicios <span className="bullet">•</span> 52 min</p><button className="primary-button" type="button" onClick={onStart}>Comenzar sesión <Icon name="arrow" size={17} /></button></div><div className="muscle-orb" aria-hidden="true"><div className="orb-ring orb-ring-one" /><div className="orb-ring orb-ring-two" /><span>LEG<br /><b>DAY</b></span></div></section>
      <section><div className="section-heading"><div><p className="eyebrow">RESUMEN</p><h2>Tu semana</h2></div><button className="text-button" type="button">Ver todo <Icon name="chevron" size={15} /></button></div><div className="metric-grid"><MetricCard label="Sesiones" value="4" detail="+1 esta semana" accent="violet" /><MetricCard label="Volumen" value="12.480" detail="kg movidos" accent="blue" /><MetricCard label="Racha" value="12" detail="días seguidos" accent="orange" /></div></section>
      <section><div className="section-heading"><div><p className="eyebrow">TUS RUTINAS</p><h2>Seguí progresando</h2></div><button className="icon-button" type="button" aria-label="Agregar rutina"><Icon name="plus" size={18} /></button></div><div className="routine-preview-list">{demoRoutines.slice(0, 2).map((routine) => <RoutinePreview key={routine.name} routine={routine} />)}</div></section>
    </div>
  );
}

function RoutinesView({ onStart }: { onStart: () => void }): ReactElement {
  return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">PLANIFICACIÓN</p><h1>Mis rutinas</h1><p className="screen-subtitle">Todo lo que necesitás para tu próxima sesión.</p></div><button className="round-action" type="button" aria-label="Crear rutina"><Icon name="plus" size={20} /></button></section><div className="segmented-control" role="tablist" aria-label="Tipos de rutina"><button className="is-selected" type="button">Mis rutinas</button><button type="button">Programas</button></div><div className="routine-card-list">{demoRoutines.map((routine, index) => <button className={`routine-card routine-card-${routine.accent}`} type="button" key={routine.name} onClick={index === 0 ? onStart : undefined}><span className="routine-card-top"><span>{index === 0 ? "HOY" : "PLANTILLA"}</span><Icon name="chevron" size={17} /></span><span className="routine-card-title">{routine.name}</span><span className="routine-card-detail">{routine.detail}</span><span className="routine-progress"><span style={{ width: `${routine.progress}%` }} /></span><span className="routine-card-footer"><span>{routine.progress}% completado</span><span>Última vez hace 2 días</span></span></button>)}</div></div>;
}

function TrainView({ started, completedSets, onStart, onCompleteSet }: { started: boolean; completedSets: number; onStart: () => void; onCompleteSet: () => void }): ReactElement {
  if (!started) return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">MODO ENTRENAMIENTO</p><h1>Entrenar</h1><p className="screen-subtitle">Tu sesión queda guardada localmente mientras entrenás.</p></div><span className="offline-badge"><Icon name="bolt" size={14} /> Offline ready</span></section><section className="empty-workout-card"><div className="empty-icon"><Icon name="train" size={28} /></div><p className="eyebrow">LISTO PARA EMPEZAR</p><h2>Tu próxima sesión está acá.</h2><p>Iniciá una rutina y registrá cada serie sin depender de la conexión.</p><button className="primary-button" type="button" onClick={onStart}>Comenzar Piernas <Icon name="arrow" size={17} /></button></section></div>;
  return <div className="screen-stack workout-screen"><section className="active-workout-header"><div><span className="live-label"><span className="live-dot" /> SESIÓN ACTIVA</span><h1>Piernas <span>· Fuerza</span></h1><p className="screen-subtitle">32 min <span className="bullet">•</span> {completedSets}/8 series</p></div><button className="round-action" type="button" aria-label="Más opciones">•••</button></section><div className="workout-progress"><span style={{ width: `${(completedSets / 8) * 100}%` }} /></div><section className="exercise-log-card"><div className="exercise-log-heading"><div><span className="exercise-index">01</span><div><h2>Sentadilla con barra</h2><p>Cuádriceps · Glúteos</p></div></div><span className="exercise-status"><Icon name="check" size={14} /> 2/3</span></div><div className="set-header"><span>Serie</span><span>Kg</span><span>Reps</span><span /></div>{[1, 2, 3].map((set) => <div className={`set-row ${set <= 2 ? "is-complete" : ""}`} key={set}><span className="set-number">{set}</span><span>{set <= 2 ? "80" : "—"}</span><span>{set <= 2 ? "8" : "—"}</span><button className="set-check" type="button" onClick={onCompleteSet} aria-label={`Completar serie ${set}`}><Icon name="check" size={15} /></button></div>)}<button className="add-set-button" type="button" onClick={onCompleteSet}><Icon name="plus" size={15} /> Agregar serie</button></section><section className="next-exercise-card"><span className="card-kicker">SIGUIENTE</span><div><h2>Prensa inclinada</h2><p>3 series · 10 repeticiones</p></div><Icon name="chevron" size={18} /></section></div>;
}

function ProgressView(): ReactElement {
  return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">DATOS DE ENTRENAMIENTO</p><h1>Tu progreso</h1><p className="screen-subtitle">La constancia se ve cuando la medís.</p></div><button className="round-action" type="button" aria-label="Elegir período"><Icon name="chevron" size={18} /></button></section><section className="progress-hero-card"><div><span className="card-kicker">VOLUMEN TOTAL · ÚLTIMOS 30 DÍAS</span><strong>48.620 <small>kg</small></strong><p className="positive-change">↗ 18,4% vs. período anterior</p></div><div className="chart-orb"><span>+18%</span></div></section><section className="chart-card"><div className="section-heading compact"><div><p className="eyebrow">EVOLUCIÓN</p><h2>Volumen semanal</h2></div><span className="chart-legend"><i /> kg</span></div><div className="bar-chart" aria-label="Gráfico de volumen semanal"><span style={{ height: "38%" }} /><span style={{ height: "52%" }} /><span style={{ height: "46%" }} /><span style={{ height: "70%" }} /><span style={{ height: "64%" }} /><span style={{ height: "88%" }} /><span className="is-current" style={{ height: "76%" }} /></div><div className="chart-labels"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div></section><div className="metric-grid progress-metrics"><MetricCard label="Mejor marca" value="100 kg" detail="Sentadilla" accent="violet" /><MetricCard label="Sesiones" value="16" detail="este mes" accent="blue" /></div></div>;
}

function ExercisesView({ query, onQueryChange, exercises }: { query: string; onQueryChange: (value: string) => void; exercises: typeof demoExercises }): ReactElement {
  return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">BIBLIOTECA OFICIAL</p><h1>Ejercicios</h1><p className="screen-subtitle">Encontrá el movimiento indicado para cada objetivo.</p></div><button className="round-action" type="button" aria-label="Agregar ejercicio"><Icon name="plus" size={20} /></button></section><label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar ejercicio o músculo" /></label><div className="filter-row"><button className="filter-chip is-selected" type="button">Todos</button><button className="filter-chip" type="button">Pecho</button><button className="filter-chip" type="button">Espalda</button><button className="filter-chip" type="button">Piernas</button></div><div className="exercise-library-list">{exercises.map((exercise) => <button className="library-exercise" type="button" key={exercise.name}><span className={`exercise-avatar avatar-${exercise.color}`}><Icon name="train" size={20} /></span><span className="library-exercise-copy"><strong>{exercise.name}</strong><small>{exercise.muscle}</small></span><span className="exercise-rank">{exercise.rank}<Icon name="chevron" size={15} /></span></button>)}</div>{exercises.length === 0 ? <p className="empty-search">No encontramos ejercicios con esa búsqueda.</p> : null}</div>;
}

function ProfileDrawer({ session, serverUser, authLoading, authBusy, authMessage, serverIdentityLoading, serverIdentityMessage, email, password, supabaseConfigured, onClose, onSubmit, onEmailChange, onPasswordChange, onSignOut }: { session: Session | null; serverUser: ApiUser | null; authLoading: boolean; authBusy: boolean; authMessage: string | null; serverIdentityLoading: boolean; serverIdentityMessage: string | null; email: string; password: string; supabaseConfigured: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onSignOut: () => void }): ReactElement {
  return <div className="drawer-layer" role="presentation" onClick={onClose}><aside className="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">CUENTA</p><h2 id="profile-title">Tu perfil</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar perfil">×</button></div>{authLoading ? <p className="muted">Comprobando sesión…</p> : null}{!authLoading && session !== null ? <div className="profile-authenticated"><div className="profile-large-avatar">{session.user.email?.slice(0, 1).toUpperCase() ?? "N"}</div><h3>{session.user.email ?? "Atleta FORMA"}</h3><p className="muted">Sesión online activa</p>{serverIdentityLoading ? <p className="muted">Validando identidad interna…</p> : null}{serverUser !== null ? <p className="server-identity">Identidad FORMA validada · {serverUser.role}</p> : null}{serverIdentityMessage !== null ? <p className="form-error" role="alert">{serverIdentityMessage}</p> : null}<p className="security-note">La sesión offline todavía no conserva credenciales. Tus entrenamientos locales sí se guardan en el dispositivo.</p><button className="secondary-button" type="button" onClick={onSignOut} disabled={authBusy}><Icon name="logout" size={16} /> {authBusy ? "Cerrando…" : "Cerrar sesión"}</button></div> : null}{!authLoading && session === null ? <form className="drawer-auth-form" onSubmit={onSubmit}><div className="auth-intro"><div className="profile-large-avatar"><Icon name="profile" size={24} /></div><h3>Entrá a FORMA</h3><p className="muted">Sincronizá tu identidad cuando vuelvas a tener conexión.</p></div><label>Correo<input type="email" autoComplete="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required /></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} required /></label><button className="primary-button full-button" type="submit" disabled={authBusy || !supabaseConfigured}>{authBusy ? "Ingresando…" : "Iniciar sesión"}</button>{!supabaseConfigured ? <p className="security-note">Configurá las variables VITE_SUPABASE_* para habilitar este entorno.</p> : null}{authMessage !== null ? <p className="form-error" role="alert">{authMessage}</p> : null}</form> : null}<div className="drawer-footer"><span>FORMA · diseño inicial</span><span>v0.1</span></div></aside></div>;
}

function RoutinePreview({ routine }: { routine: (typeof demoRoutines)[number] }): ReactElement {
  return <button className={`routine-preview routine-preview-${routine.accent}`} type="button"><span className="routine-preview-icon"><Icon name="bolt" size={18} /></span><span><strong>{routine.name}</strong><small>{routine.detail}</small></span><Icon name="chevron" size={17} /></button>;
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }): ReactElement {
  return <article className={`metric-card metric-${accent}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }): ReactElement {
  const content: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v10h14V9" /><path d="M9 19v-6h6v6" /></>,
    routines: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    train: <><path d="M6 5v14M18 5v14M3 8h6M15 8h6M3 16h6M15 16h6" /><path d="M9 12h6" /></>,
    progress: <><path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-7" /></>,
    exercises: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" /></>,
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    bolt: <path d="m13 2-9 11h7l-1 9 9-12h-7l1-8Z" />,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    logout: <><path d="M10 5H5v14h5" /><path d="m14 8 4 4-4 4M8 12h10" /></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content[name]}</svg>;
}

function toAuthMessage(error: unknown): string {
  if (error !== null && typeof error === "object" && "message" in error) {
    const message = (error as WebAuthError).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "No se pudo completar la operación de autenticación.";
}

function toApiMessage(error: unknown): string {
  if (error !== null && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "No se pudo validar la identidad en el API.";
}
