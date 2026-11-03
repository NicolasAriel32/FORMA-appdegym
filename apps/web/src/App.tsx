import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ExerciseId, SessionId, SetId, UserId, WorkoutSession } from "../../../packages/domain/src/workout.js";
import {
  createRoutine,
  createConfiguredBrowserApiBaseUrl,
  fetchCurrentUser,
  fetchPublishedExercises,
  fetchRoutines,
  updateRoutine,
  type ApiExercise,
  type ApiRoutine,
  type ApiUser,
} from "./platform/api-client.js";
import {
  listSessionsByOwner,
  openLocalDatabase,
  savePublishedExercises,
  type LocalDatabase,
} from "./platform/local-db.js";
import {
  loadCurrentSession,
  signInWithPassword,
  signOut,
  subscribeToAuthChanges,
  type WebAuthError,
} from "./platform/auth.js";
import { createConfiguredBrowserSupabaseClient } from "./platform/supabase-client.js";
import {
  appendOfflineWorkoutSet,
  finishOfflineWorkoutSession,
  startOfflineWorkoutSession,
} from "./workout/offline-session-service.js";

type AppTab = "home" | "routines" | "train" | "progress" | "exercises";
type IconName = "home" | "routines" | "train" | "progress" | "exercises" | "profile" | "arrow" | "bolt" | "clock" | "search" | "plus" | "check" | "chevron" | "logout";
type ExerciseEducation = {
  movementPattern: string;
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string;
  commonMistakes: string[];
  safetyNotes: string[];
  equipment: string;
  difficulty: string;
};
type ExerciseCard = { id: string; name: string; muscle: string; rank: string; color: string; education: ExerciseEducation };

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

const demoExercises: ExerciseCard[] = [
  { id: "demo-squat", name: "Sentadilla con barra", muscle: "Cuádriceps · Glúteos", rank: "Intermedio", color: "violet", education: { movementPattern: "Dominante de rodilla y cadera", targetMuscles: ["Cuádriceps", "Glúteo mayor"], secondaryMuscles: ["Aductores", "Isquiosurales", "Erectores espinales"], instructions: "Colocá la barra estable sobre la espalda, tomá aire y braceá el tronco. Descendé flexionando cadera y rodillas con el pie completo apoyado; alcanzá la profundidad que puedas controlar sin perder alineación. Empujá el suelo y extendé cadera y rodillas manteniendo la trayectoria de la barra sobre el mediopié.", commonMistakes: ["Colapsar las rodillas hacia adentro", "Despegar los talones", "Perder el control en el descenso", "Extender la zona lumbar al salir"], safetyNotes: ["Elegí una carga que permita repetir la técnica sin compensaciones", "Usá soportes y seguros correctamente regulados", "Si aparece dolor agudo, detené el ejercicio y consultá a un profesional de salud"], equipment: "Barra, rack y discos", difficulty: "Intermedio" } },
  { id: "demo-bench", name: "Press banca plano", muscle: "Pecho · Tríceps", rank: "Intermedio", color: "blue", education: { movementPattern: "Empuje horizontal", targetMuscles: ["Pectoral mayor"], secondaryMuscles: ["Tríceps", "Deltoides anterior"], instructions: "Acomodá ojos bajo la barra, escápulas retraídas y deprimidas, pies firmes. Bajá la barra hacia la zona media-baja del pecho con antebrazos aproximadamente verticales. Pausá sin rebotar y empujá manteniendo muñecas apiladas y hombros estables.", commonMistakes: ["Rebotar la barra en el pecho", "Abrir excesivamente los codos", "Levantar los glúteos del banco", "Entrenar sin seguros ni asistencia cuando corresponde"], safetyNotes: ["Usá un rack con seguros y una carga que puedas controlar", "Con cargas altas, entrená con asistencia competente", "El agarre no debe forzar la muñeca a una extensión extrema"], equipment: "Banco, barra y discos", difficulty: "Intermedio" } },
  { id: "demo-row", name: "Remo con barra", muscle: "Espalda · Bíceps", rank: "Principiante", color: "green", education: { movementPattern: "Tracción horizontal", targetMuscles: ["Dorsal ancho", "Romboides", "Trapecio medio"], secondaryMuscles: ["Bíceps", "Deltoides posterior", "Erectores espinales"], instructions: "Desde una bisagra de cadera, mantené la columna neutra y la barra cerca de las piernas. Tirala hacia el abdomen llevando los codos atrás, sin encoger los hombros. Bajá con control y repetí conservando el ángulo del tronco.", commonMistakes: ["Redondear la espalda para ganar recorrido", "Convertir el movimiento en un tirón de bíceps", "Usar impulso excesivo", "Elevar los hombros hacia las orejas"], safetyNotes: ["Aprendé la bisagra con una carga liviana antes de progresar", "No persigas amplitud si perdés la posición lumbar", "Detené la serie ante dolor agudo o irradiado"], equipment: "Barra y discos", difficulty: "Principiante" } },
  { id: "demo-rdl", name: "Peso muerto rumano", muscle: "Isquios · Glúteos", rank: "Intermedio", color: "orange", education: { movementPattern: "Bisagra de cadera", targetMuscles: ["Isquiosurales", "Glúteo mayor"], secondaryMuscles: ["Erectores espinales", "Aductores", "Antebrazos"], instructions: "Partí de pie con la carga cerca del cuerpo. Flexioná levemente las rodillas y llevá la cadera atrás mientras la barra desciende rozando los muslos. Bajá hasta sentir tensión controlable en los isquiosurales, luego acercá la cadera a la barra y extendé sin hiperextender la espalda.", commonMistakes: ["Convertirlo en una sentadilla", "Alejar la carga del cuerpo", "Buscar profundidad redondeando la espalda", "Bloquear las rodillas o hiperextender al finalizar"], safetyNotes: ["La profundidad depende de movilidad y control, no de tocar el suelo", "Progresá con incrementos pequeños y técnica repetible", "Consultá a un profesional si tenés lesión o dolor persistente"], equipment: "Barra y discos", difficulty: "Intermedio" } },
];

export default function App(): ReactElement {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [demoSessionStarted, setDemoSessionStarted] = useState(false);
  const [demoCompletedSets, setDemoCompletedSets] = useState(2);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [workoutMessage, setWorkoutMessage] = useState<string | null>(null);
  const [supabase] = useState(() => createConfiguredBrowserSupabaseClient());
  const [apiBaseUrl] = useState(() => createConfiguredBrowserApiBaseUrl());
  const [session, setSession] = useState<Session | null>(null);
  const [serverUser, setServerUser] = useState<ApiUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [serverIdentityLoading, setServerIdentityLoading] = useState(false);
  const [serverIdentityMessage, setServerIdentityMessage] = useState<string | null>(null);
  const [localDatabase, setLocalDatabase] = useState<LocalDatabase | null>(null);
  const [catalogExercises, setCatalogExercises] = useState<ApiExercise[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [routines, setRoutines] = useState<ApiRoutine[] | null>(null);
  const [routinesLoading, setRoutinesLoading] = useState(false);
  const [routineMessage, setRoutineMessage] = useState<string | null>(null);
  const [routineEditorOpen, setRoutineEditorOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<ApiRoutine | null>(null);
  const [routineSaving, setRoutineSaving] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (supabase === null) { setAuthLoading(false); return; }
    let active = true;
    void loadCurrentSession(supabase).then((current) => { if (active) setSession(current); }).catch(() => { if (active) setAuthMessage("No se pudo comprobar la sesión actual."); }).finally(() => { if (active) setAuthLoading(false); });
    const unsubscribe = subscribeToAuthChanges(supabase, (next) => { if (active) setSession(next); });
    return () => { active = false; unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (session === null || apiBaseUrl === undefined) { setServerUser(null); setServerIdentityLoading(false); setServerIdentityMessage(null); return; }
    let active = true; setServerIdentityLoading(true); setServerIdentityMessage(null);
    void fetchCurrentUser({ apiBaseUrl, accessToken: session.access_token }).then((user) => { if (active) setServerUser(user); }).catch((error) => { if (active) { setServerUser(null); setServerIdentityMessage(toApiMessage(error)); } }).finally(() => { if (active) setServerIdentityLoading(false); });
    return () => { active = false; };
  }, [apiBaseUrl, session]);

  useEffect(() => {
    if (serverUser === null) { setLocalDatabase(null); setActiveWorkout(null); return; }
    let active = true;
    void openLocalDatabase(indexedDB, `forma-${serverUser.id}`).then(async (database) => {
      const sessions = await listSessionsByOwner(database, serverUser.id);
      const current = sessions.find((candidate) => candidate.status === "in_progress" || candidate.status === "paused");
      if (!active) { database.close(); return; }
      setLocalDatabase(database); if (current !== undefined) setActiveWorkout(current);
    }).catch(() => { if (active) setWorkoutMessage("No se pudo abrir el almacenamiento local seguro."); });
    return () => { active = false; };
  }, [serverUser]);

  useEffect(() => {
    if (session === null || apiBaseUrl === undefined) { setCatalogExercises(null); setCatalogMessage(null); return; }
    let active = true; setCatalogLoading(true); setCatalogMessage(null);
    void fetchPublishedExercises({ apiBaseUrl, accessToken: session.access_token }).then(async (exercises) => { if (!active) return; setCatalogExercises(exercises); if (localDatabase !== null) await savePublishedExercises(localDatabase, exercises); }).catch((error) => { if (active) { setCatalogExercises([]); setCatalogMessage(toApiMessage(error)); } }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [apiBaseUrl, localDatabase, session]);

  useEffect(() => {
    if (session === null || apiBaseUrl === undefined) { setRoutines(null); return; }
    let active = true; setRoutinesLoading(true);
    void fetchRoutines({ apiBaseUrl, accessToken: session.access_token }).then((loaded) => { if (active) setRoutines(loaded); }).catch((error) => { if (active) setRoutineMessage(toApiMessage(error)); }).finally(() => { if (active) setRoutinesLoading(false); });
    return () => { active = false; };
  }, [apiBaseUrl, session]);

  const displayExercises = useMemo<ExerciseCard[]>(() => {
    if (catalogExercises === null) return demoExercises;
    return catalogExercises.map((exercise, index) => ({ id: exercise.id, name: exercise.name, muscle: exercise.targetMuscles.join(" · ") || exercise.description || "Ejercicio oficial", rank: difficultyLabel(exercise.difficulty), color: ["violet", "blue", "green", "orange"][index % 4] ?? "violet", education: { movementPattern: exercise.movementPattern, targetMuscles: exercise.targetMuscles, secondaryMuscles: exercise.secondaryMuscles, instructions: exercise.instructions, commonMistakes: exercise.commonMistakes, safetyNotes: exercise.safetyNotes, equipment: exercise.equipment, difficulty: difficultyLabel(exercise.difficulty) } }));
  }, [catalogExercises]);
  const filteredExercises = displayExercises.filter((exercise) => { const query = exerciseQuery.trim().toLowerCase(); return query.length === 0 || `${exercise.name} ${exercise.muscle}`.toLowerCase().includes(query); });
  const realWorkoutEnabled = serverUser !== null && localDatabase !== null;
  const clientInstanceId = serverUser === null ? null : getClientInstanceId(serverUser.id);

  async function startWorkout(): Promise<void> {
    setActiveTab("train"); setWorkoutMessage(null);
    if (!realWorkoutEnabled || serverUser === null || localDatabase === null || clientInstanceId === null) { setDemoSessionStarted(true); return; }
    try {
      const timestamp = new Date().toISOString();
      const result = await startOfflineWorkoutSession({ database: localDatabase, ownerId: serverUser.id as UserId, sessionId: crypto.randomUUID() as SessionId, operationId: crypto.randomUUID(), clientInstanceId, createdAt: timestamp, startedAt: timestamp });
      setActiveWorkout(result.session); setWorkoutMessage("Sesión guardada localmente. Quedará pendiente de sincronización.");
    } catch (error) { setWorkoutMessage(toErrorMessage(error, "No se pudo iniciar la sesión local.")); }
  }

  async function completeSet(): Promise<void> {
    if (!realWorkoutEnabled || serverUser === null || localDatabase === null || activeWorkout === null || clientInstanceId === null) { setDemoCompletedSets((value) => Math.min(value + 1, 8)); return; }
    const exercise = catalogExercises?.[0];
    if (exercise === undefined) { setWorkoutMessage("El catálogo oficial todavía no está disponible para registrar la serie."); return; }
    try {
      const timestamp = new Date().toISOString();
      const result = await appendOfflineWorkoutSet({ database: localDatabase, ownerId: serverUser.id as UserId, sessionId: activeWorkout.id, operationId: crypto.randomUUID(), clientInstanceId, setId: crypto.randomUUID() as SetId, exercise: { id: exercise.id as ExerciseId, status: "published" }, exerciseId: exercise.id as ExerciseId, repetitions: 8, loadKg: 80, createdAt: timestamp });
      setActiveWorkout(result.session); setWorkoutMessage("Serie guardada en el dispositivo.");
    } catch (error) { setWorkoutMessage(toErrorMessage(error, "No se pudo guardar la serie.")); }
  }

  async function finishWorkout(): Promise<void> {
    if (!realWorkoutEnabled || serverUser === null || localDatabase === null || activeWorkout === null || clientInstanceId === null) { setDemoSessionStarted(false); setDemoCompletedSets(0); setWorkoutMessage("Vista de diseño: la sesión real requiere identidad FORMA y API configurados."); return; }
    try {
      const result = await finishOfflineWorkoutSession({ database: localDatabase, ownerId: serverUser.id as UserId, sessionId: activeWorkout.id, operationId: crypto.randomUUID(), clientInstanceId, finishedAt: new Date().toISOString() });
      setActiveWorkout(null); setWorkoutMessage(`Sesión finalizada localmente con ${result.session.sets.length} series pendientes de sincronizar.`);
    } catch (error) { setWorkoutMessage(toErrorMessage(error, "No se pudo finalizar la sesión.")); }
  }

  function openRoutineEditor(routine: ApiRoutine | null = null): void { setEditingRoutine(routine); setRoutineMessage(null); setRoutineEditorOpen(true); }
  async function saveRoutine(name: string, description: string, exerciseIds: string[]): Promise<void> {
    if (session === null || apiBaseUrl === undefined || !online) { setRoutineMessage("La edición estructural de rutinas requiere conexión y una sesión online."); return; }
    setRoutineSaving(true); setRoutineMessage(null);
    try {
      const input = { name, description, exerciseIds };
      const saved = editingRoutine === null ? await createRoutine({ apiBaseUrl, accessToken: session.access_token, input }) : await updateRoutine({ apiBaseUrl, accessToken: session.access_token, routineId: editingRoutine.id, input });
      setRoutines((current) => current === null ? [saved] : editingRoutine === null ? [...current, saved] : current.map((routine) => routine.id === saved.id ? saved : routine)); setRoutineEditorOpen(false);
    } catch (error) { setRoutineMessage(toApiMessage(error)); } finally { setRoutineSaving(false); }
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); setAuthMessage(null); if (supabase === null) { setAuthMessage("La autenticación todavía no está configurada en este entorno."); return; } if (!online) { setAuthMessage("Necesitás conexión para iniciar sesión."); return; } setAuthBusy(true); try { const next = await signInWithPassword(supabase, email, password); setSession(next); setPassword(""); } catch (error) { setAuthMessage(toAuthMessage(error)); } finally { setAuthBusy(false); } }
  async function handleSignOut(): Promise<void> { if (supabase === null) return; setAuthMessage(null); setAuthBusy(true); try { await signOut(supabase); setSession(null); } catch (error) { setAuthMessage(toAuthMessage(error)); } finally { setAuthBusy(false); } }

  return <div className="app-shell"><div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" /><header className="topbar"><div className="brand-mark" aria-label="FORMA"><span className="brand-symbol">F</span><span>FORMA</span></div><div className="topbar-actions"><span className={`sync-pill ${online ? "is-online" : "is-offline"}`}><span className="sync-dot" aria-hidden="true" />{online ? "Online" : "Offline"}</span><button className="profile-button" type="button" aria-label="Abrir perfil" onClick={() => setProfileOpen(true)}>{session?.user.email?.slice(0, 1).toUpperCase() ?? "N"}</button></div></header><main className="app-content">{activeTab === "home" ? <HomeView onStart={() => void startWorkout()} /> : null}{activeTab === "routines" ? <RoutinesView routines={routines} loading={routinesLoading} message={routineMessage} catalogExercises={catalogExercises ?? []} onStart={() => void startWorkout()} onCreate={() => openRoutineEditor()} onEdit={openRoutineEditor} /> : null}{activeTab === "train" ? <TrainView started={demoSessionStarted || activeWorkout !== null} activeSession={activeWorkout} completedSets={activeWorkout?.sets.length ?? demoCompletedSets} message={workoutMessage} onStart={() => void startWorkout()} onCompleteSet={() => void completeSet()} onFinish={() => void finishWorkout()} /> : null}{activeTab === "progress" ? <ProgressView /> : null}{activeTab === "exercises" ? <ExercisesView query={exerciseQuery} onQueryChange={setExerciseQuery} exercises={filteredExercises} loading={catalogLoading} message={catalogMessage} source={catalogExercises === null ? "demo" : "api"} /> : null}</main><nav className="bottom-nav" aria-label="Navegación principal">{tabs.map((tab) => <button className={`nav-item ${activeTab === tab.id ? "is-active" : ""} ${tab.id === "train" ? "train-nav-item" : ""}`} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}><span className={tab.id === "train" ? "train-nav-icon" : "nav-icon"}><Icon name={tab.icon} size={tab.id === "train" ? 21 : 19} /></span><span>{tab.label}</span></button>)}</nav>{profileOpen ? <ProfileDrawer session={session} serverUser={serverUser} authLoading={authLoading} authBusy={authBusy} authMessage={authMessage} serverIdentityLoading={serverIdentityLoading} serverIdentityMessage={serverIdentityMessage} email={email} password={password} supabaseConfigured={supabase !== null} onClose={() => setProfileOpen(false)} onSubmit={(event) => void handleSubmit(event)} onEmailChange={setEmail} onPasswordChange={setPassword} onSignOut={() => void handleSignOut()} /> : null}{routineEditorOpen ? <RoutineEditor routine={editingRoutine} exercises={catalogExercises ?? []} saving={routineSaving} online={online} onClose={() => setRoutineEditorOpen(false)} onSave={(name, description, exerciseIds) => void saveRoutine(name, description, exerciseIds)} /> : null}</div>;
}

function HomeView({ onStart }: { onStart: () => void }): ReactElement { return <div className="screen-stack"><section className="welcome-block"><div><p className="eyebrow">MI ENTRENAMIENTO</p><h1>Entrená con intención.</h1><p className="screen-subtitle">Una sesión consistente vale más que una sesión perfecta.</p></div><span className="demo-label">Vista de diseño</span></section><section className="featured-workout"><div className="featured-glow" aria-hidden="true" /><div className="featured-copy"><span className="card-kicker">PRÓXIMO ENTRENAMIENTO</span><h2>Piernas <span>·</span> Fuerza</h2><p><Icon name="clock" size={15} /> 6 ejercicios <span className="bullet">•</span> 52 min</p><button className="primary-button" type="button" onClick={onStart}>Comenzar sesión <Icon name="arrow" size={17} /></button></div><div className="muscle-orb" aria-hidden="true"><div className="orb-ring orb-ring-one" /><div className="orb-ring orb-ring-two" /><span>LEG<br /><b>DAY</b></span></div></section><section><div className="section-heading"><div><p className="eyebrow">RESUMEN</p><h2>Tu semana</h2></div><button className="text-button" type="button">Ver todo <Icon name="chevron" size={15} /></button></div><div className="metric-grid"><MetricCard label="Sesiones" value="4" detail="+1 esta semana" accent="violet" /><MetricCard label="Volumen" value="12.480" detail="kg movidos" accent="blue" /><MetricCard label="Racha" value="12" detail="días seguidos" accent="orange" /></div></section><section><div className="section-heading"><div><p className="eyebrow">TUS RUTINAS</p><h2>Seguí progresando</h2></div><button className="icon-button" type="button" aria-label="Agregar rutina"><Icon name="plus" size={18} /></button></div><div className="routine-preview-list">{demoRoutines.slice(0, 2).map((routine) => <RoutinePreview key={routine.name} routine={routine} />)}</div></section></div>; }

function RoutinesView({ routines, loading, message, catalogExercises, onStart, onCreate, onEdit }: { routines: ApiRoutine[] | null; loading: boolean; message: string | null; catalogExercises: ApiExercise[]; onStart: () => void; onCreate: () => void; onEdit: (routine: ApiRoutine) => void }): ReactElement {
  const real = routines !== null;
  const cards = real ? routines.map((api, index) => ({ api, name: api.name, detail: `${api.exercises.length} ejercicios · revisión ${api.revision}`, accent: ["violet", "blue", "green", "orange"][index % 4] ?? "violet", progress: 0 })) : demoRoutines.map((demo) => ({ api: null, name: demo.name, detail: demo.detail, accent: demo.accent, progress: demo.progress }));
  return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">PLANIFICACIÓN</p><h1>Mis rutinas</h1><p className="screen-subtitle">Todo lo que necesitás para tu próxima sesión.</p></div><button className="round-action" type="button" aria-label="Crear rutina" onClick={onCreate}><Icon name="plus" size={20} /></button></section><div className="segmented-control" role="tablist" aria-label="Tipos de rutina"><button className="is-selected" type="button">Mis rutinas</button><button type="button">Programas</button></div>{loading ? <p className="status-line">Cargando rutinas online…</p> : null}{message ? <p className="form-error" role="alert">{message}</p> : null}{!real ? <span className="demo-label section-demo-label">Vista de diseño · guardado online requerido</span> : null}<div className="routine-card-list">{cards.map((card, index) => <div className={`routine-card-wrap routine-card-${card.accent}`} key={card.api?.id ?? card.name}><button className="routine-card" type="button" onClick={index === 0 ? onStart : undefined}><span className="routine-card-top"><span>{index === 0 ? "HOY" : "PLANTILLA"}</span><Icon name="chevron" size={17} /></span><span className="routine-card-title">{card.name}</span><span className="routine-card-detail">{card.detail}</span><span className="routine-progress"><span style={{ width: `${card.progress}%` }} /></span><span className="routine-card-footer"><span>{card.api === null ? `${card.progress}% completado` : "Lista para entrenar"}</span><span>{card.api === null ? "Última vez hace 2 días" : "Edición online"}</span></span></button>{card.api !== null ? <button className="routine-edit-button" type="button" onClick={() => onEdit(card.api)}>Editar estructura</button> : null}</div>)}</div>{real && routines.length === 0 ? <div className="empty-workout-card compact-empty"><p className="eyebrow">SIN RUTINAS</p><h2>Creá tu primera rutina.</h2><p>La estructura se edita online y queda protegida por tu identidad.</p><button className="primary-button" type="button" onClick={onCreate}>Crear rutina <Icon name="plus" size={17} /></button></div> : null}<small className="screen-footnote">{real ? `${catalogExercises.length} ejercicios oficiales disponibles para editar.` : "Los datos mostrados son una maqueta visual hasta conectar el API."}</small></div>;
}

function TrainView({ started, activeSession, completedSets, message, onStart, onCompleteSet, onFinish }: { started: boolean; activeSession: WorkoutSession | null; completedSets: number; message: string | null; onStart: () => void; onCompleteSet: () => void; onFinish: () => void }): ReactElement { if (!started) return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">MODO ENTRENAMIENTO</p><h1>Entrenar</h1><p className="screen-subtitle">Tu sesión queda guardada localmente mientras entrenás.</p></div><span className="offline-badge"><Icon name="bolt" size={14} /> Offline ready</span></section>{message ? <p className="status-line">{message}</p> : null}<section className="empty-workout-card"><div className="empty-icon"><Icon name="train" size={28} /></div><p className="eyebrow">LISTO PARA EMPEZAR</p><h2>Tu próxima sesión está acá.</h2><p>Iniciá una rutina y registrá cada serie sin depender de la conexión.</p><button className="primary-button" type="button" onClick={onStart}>Comenzar Piernas <Icon name="arrow" size={17} /></button></section></div>; const actual = activeSession !== null; return <div className="screen-stack workout-screen"><section className="active-workout-header"><div><span className="live-label"><span className="live-dot" /> SESIÓN ACTIVA</span><h1>Piernas <span>· Fuerza</span></h1><p className="screen-subtitle">{actual ? "Guardado local" : "32 min"} <span className="bullet">•</span> {completedSets}/8 series</p></div><button className="round-action" type="button" aria-label="Más opciones">•••</button></section>{message ? <p className="status-line">{message}</p> : null}<div className="workout-progress"><span style={{ width: `${Math.min((completedSets / 8) * 100, 100)}%` }} /></div><section className="exercise-log-card"><div className="exercise-log-heading"><div><span className="exercise-index">01</span><div><h2>{actual && activeSession.sets[0] ? "Ejercicio oficial" : "Sentadilla con barra"}</h2><p>{actual ? "Catálogo oficial" : "Cuádriceps · Glúteos"}</p></div></div><span className="exercise-status"><Icon name="check" size={14} /> {Math.min(completedSets, 3)}/3</span></div><div className="set-header"><span>Serie</span><span>Kg</span><span>Reps</span><span /></div>{[1, 2, 3].map((set) => { const completed = actual ? activeSession.sets[set - 1] : set <= completedSets; const load = typeof completed === "object" ? completed.loadKg : completed ? 80 : null; const reps = typeof completed === "object" ? completed.repetitions : completed ? 8 : null; return <div className={`set-row ${completed ? "is-complete" : ""}`} key={set}><span className="set-number">{set}</span><span>{load ?? "—"}</span><span>{reps ?? "—"}</span><button className="set-check" type="button" onClick={onCompleteSet} aria-label={`Completar serie ${set}`}><Icon name="check" size={15} /></button></div>; })}<button className="add-set-button" type="button" onClick={onCompleteSet}><Icon name="plus" size={15} /> Agregar serie</button><button className="secondary-button finish-button" type="button" onClick={onFinish}>Finalizar sesión</button></section><section className="next-exercise-card"><span className="card-kicker">SIGUIENTE</span><div><h2>Prensa inclinada</h2><p>3 series · 10 repeticiones</p></div><Icon name="chevron" size={18} /></section></div>; }

function ExercisesView({ query, onQueryChange, exercises, loading, message, source }: { query: string; onQueryChange: (value: string) => void; exercises: ExerciseCard[]; loading: boolean; message: string | null; source: "demo" | "api" }): ReactElement { const [selected, setSelected] = useState<ExerciseCard | null>(null); return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">BIBLIOTECA OFICIAL</p><h1>Ejercicios</h1><p className="screen-subtitle">Técnica, objetivos y errores frecuentes en una sola ficha.</p></div><button className="round-action" type="button" aria-label="Agregar ejercicio"><Icon name="plus" size={20} /></button></section><div className="catalog-meta"><span className={source === "api" ? "live-label" : "demo-label"}>{source === "api" ? "Catálogo online" : "Vista de diseño"}</span>{loading ? <span className="muted">Actualizando…</span> : null}</div>{message ? <p className="form-error" role="alert">{message}</p> : null}<label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar ejercicio o músculo" /></label><div className="filter-row"><button className="filter-chip is-selected" type="button">Todos</button><button className="filter-chip" type="button">Pecho</button><button className="filter-chip" type="button">Espalda</button><button className="filter-chip" type="button">Piernas</button></div><div className="exercise-library-list">{exercises.map((exercise) => <button className="library-exercise" type="button" key={exercise.id} onClick={() => setSelected(exercise)}><span className={`exercise-avatar avatar-${exercise.color}`}><Icon name="train" size={20} /></span><span className="library-exercise-copy"><strong>{exercise.name}</strong><small>{exercise.muscle}</small></span><span className="exercise-rank">{exercise.rank}<Icon name="chevron" size={15} /></span></button>)}</div>{exercises.length === 0 ? <p className="empty-search">No encontramos ejercicios con esa búsqueda.</p> : null}{selected ? <ExerciseDetails exercise={selected} source={source} onClose={() => setSelected(null)} /> : null}</div>; }

function ExerciseDetails({ exercise, source, onClose }: { exercise: ExerciseCard; source: "demo" | "api"; onClose: () => void }): ReactElement { const info = exercise.education; return <div className="drawer-layer" role="presentation" onClick={onClose}><section className="exercise-details" role="dialog" aria-modal="true" aria-labelledby="exercise-detail-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">{source === "api" ? "CONTENIDO OFICIAL" : "VISTA DE DISEÑO"}</p><h2 id="exercise-detail-title">{exercise.name}</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar ficha">×</button></div><p className="detail-lead">{info.movementPattern} · {info.equipment} · {info.difficulty}</p><DetailSection title="Para qué sirve"><p>{info.instructions}</p></DetailSection><DetailSection title="Músculos principales"><div className="tag-list">{info.targetMuscles.map((item) => <span key={item}>{item}</span>)}</div></DetailSection><DetailSection title="Músculos secundarios"><div className="tag-list muted-tags">{info.secondaryMuscles.map((item) => <span key={item}>{item}</span>)}</div></DetailSection><DetailSection title="Errores frecuentes"><ul>{info.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul></DetailSection><DetailSection title="Cues de seguridad"><ul className="safety-list">{info.safetyNotes.map((item) => <li key={item}>{item}</li>)}</ul></DetailSection><p className="security-note">La ficha es educativa y no reemplaza una evaluación individual de un profesor de educación física o profesional de la salud.</p></section></div>; }
function DetailSection({ title, children }: { title: string; children: ReactNode }): ReactElement { return <section className="detail-section"><p className="eyebrow">{title}</p>{children}</section>; }

function RoutineEditor({ routine, exercises, saving, online, onClose, onSave }: { routine: ApiRoutine | null; exercises: ApiExercise[]; saving: boolean; online: boolean; onClose: () => void; onSave: (name: string, description: string, exerciseIds: string[]) => void }): ReactElement { const [name, setName] = useState(routine?.name ?? ""); const [description, setDescription] = useState(routine?.description ?? ""); const [selected, setSelected] = useState<string[]>(routine?.exercises.filter((item) => item.status === "active").sort((a, b) => a.position - b.position).map((item) => item.exerciseId) ?? []); const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); return <div className="drawer-layer" role="presentation" onClick={onClose}><section className="routine-editor" role="dialog" aria-modal="true" aria-labelledby="routine-editor-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">{routine === null ? "NUEVA RUTINA" : "EDICIÓN ONLINE"}</p><h2 id="routine-editor-title">{routine === null ? "Crear rutina" : "Editar rutina"}</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar editor">×</button></div><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ej. Piernas · Fuerza" /></label><label>Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Objetivo y notas de la rutina" /></label><div className="editor-section"><div className="section-heading compact"><div><p className="eyebrow">ESTRUCTURA</p><h3>Ejercicios oficiales</h3></div><span className="editor-count">{selected.length}</span></div>{exercises.length === 0 ? <p className="muted">Necesitás catálogo online para agregar ejercicios.</p> : <div className="exercise-picker">{exercises.map((exercise) => <label className={`exercise-picker-row ${selected.includes(exercise.id) ? "is-selected" : ""}`} key={exercise.id}><input type="checkbox" checked={selected.includes(exercise.id)} onChange={() => toggle(exercise.id)} /><span><strong>{exercise.name}</strong><small>{exercise.description || "Ejercicio oficial"}</small></span></label>)}</div>}</div><p className="security-note">La estructura se edita online. No se crea una rutina offline ni se envía una operación pendiente.</p><button className="primary-button full-button" type="button" disabled={saving || !online || name.trim().length === 0} onClick={() => onSave(name, description, selected)}>{saving ? "Guardando…" : routine === null ? "Crear rutina" : "Guardar cambios"} <Icon name="arrow" size={17} /></button>{!online ? <p className="form-error" role="alert">Conectate para guardar cambios estructurales.</p> : null}</section></div>; }

function ProfileDrawer({ session, serverUser, authLoading, authBusy, authMessage, serverIdentityLoading, serverIdentityMessage, email, password, supabaseConfigured, onClose, onSubmit, onEmailChange, onPasswordChange, onSignOut }: { session: Session | null; serverUser: ApiUser | null; authLoading: boolean; authBusy: boolean; authMessage: string | null; serverIdentityLoading: boolean; serverIdentityMessage: string | null; email: string; password: string; supabaseConfigured: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onSignOut: () => void }): ReactElement { return <div className="drawer-layer" role="presentation" onClick={onClose}><aside className="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">CUENTA</p><h2 id="profile-title">Tu perfil</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar perfil">×</button></div>{authLoading ? <p className="muted">Comprobando sesión…</p> : null}{!authLoading && session !== null ? <div className="profile-authenticated"><div className="profile-large-avatar">{session.user.email?.slice(0, 1).toUpperCase() ?? "N"}</div><h3>{session.user.email ?? "Atleta FORMA"}</h3><p className="muted">Sesión online activa</p>{serverIdentityLoading ? <p className="muted">Validando identidad interna…</p> : null}{serverUser !== null ? <p className="server-identity">Identidad FORMA validada · {serverUser.role}</p> : null}{serverIdentityMessage !== null ? <p className="form-error" role="alert">{serverIdentityMessage}</p> : null}<p className="security-note">La sesión offline todavía no conserva credenciales. Tus entrenamientos locales sí se guardan en el dispositivo.</p><button className="secondary-button" type="button" onClick={onSignOut} disabled={authBusy}><Icon name="logout" size={16} /> {authBusy ? "Cerrando…" : "Cerrar sesión"}</button></div> : null}{!authLoading && session === null ? <form className="drawer-auth-form" onSubmit={onSubmit}><div className="auth-intro"><div className="profile-large-avatar"><Icon name="profile" size={24} /></div><h3>Entrá a FORMA</h3><p className="muted">Sincronizá tu identidad cuando vuelvas a tener conexión.</p></div><label>Correo<input type="email" autoComplete="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required /></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} required /></label><button className="primary-button full-button" type="submit" disabled={authBusy || !supabaseConfigured}>{authBusy ? "Ingresando…" : "Iniciar sesión"}</button>{!supabaseConfigured ? <p className="security-note">Configurá las variables VITE_SUPABASE_* para habilitar este entorno.</p> : null}{authMessage !== null ? <p className="form-error" role="alert">{authMessage}</p> : null}</form> : null}<div className="drawer-footer"><span>FORMA · diseño inicial</span><span>v0.1</span></div></aside></div>; }

function RoutinePreview({ routine }: { routine: (typeof demoRoutines)[number] }): ReactElement { return <button className={`routine-preview routine-preview-${routine.accent}`} type="button"><span className="routine-preview-icon"><Icon name="bolt" size={18} /></span><span><strong>{routine.name}</strong><small>{routine.detail}</small></span><Icon name="chevron" size={17} /></button>; }
function ProgressView(): ReactElement { return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">DATOS DE ENTRENAMIENTO</p><h1>Tu progreso</h1><p className="screen-subtitle">La constancia se ve cuando la medís.</p></div><button className="round-action" type="button" aria-label="Elegir período"><Icon name="chevron" size={18} /></button></section><section className="progress-hero-card"><div><span className="card-kicker">VOLUMEN TOTAL · ÚLTIMOS 30 DÍAS</span><strong>48.620 <small>kg</small></strong><p className="positive-change">↗ 18,4% vs. período anterior</p></div><div className="chart-orb"><span>+18%</span></div></section><section className="chart-card"><div className="section-heading compact"><div><p className="eyebrow">EVOLUCIÓN</p><h2>Volumen semanal</h2></div><span className="chart-legend"><i /> kg</span></div><div className="bar-chart" aria-label="Gráfico de volumen semanal"><span style={{ height: "38%" }} /><span style={{ height: "52%" }} /><span style={{ height: "46%" }} /><span style={{ height: "70%" }} /><span style={{ height: "64%" }} /><span style={{ height: "88%" }} /><span className="is-current" style={{ height: "76%" }} /></div><div className="chart-labels"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div></section><div className="metric-grid progress-metrics"><MetricCard label="Mejor marca" value="100 kg" detail="Sentadilla" accent="violet" /><MetricCard label="Sesiones" value="16" detail="este mes" accent="blue" /></div></div>; }
function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }): ReactElement { return <article className={`metric-card metric-${accent}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function Icon({ name, size = 20 }: { name: IconName; size?: number }): ReactElement { const content: Record<IconName, ReactNode> = { home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v10h14V9" /><path d="M9 19v-6h6v6" /></>, routines: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>, train: <><path d="M6 5v14M18 5v14M3 8h6M15 8h6M3 16h6M15 16h6" /><path d="M9 12h6" /></>, progress: <><path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-7" /></>, exercises: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>, profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" /></>, arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>, bolt: <path d="m13 2-9 11h7l-1 9 9-12h-7l1-8Z" />, clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>, search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>, plus: <><path d="M12 5v14M5 12h14" /></>, check: <path d="m5 12 4 4L19 6" />, chevron: <path d="m9 5 7 7-7 7" />, logout: <><path d="M10 5H5v14h5" /><path d="m14 8 4 4-4 4M8 12h10" /></> }; return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content[name]}</svg>; }
function getClientInstanceId(ownerId: string): string { const key = `forma.client-instance.${ownerId}`; try { const existing = localStorage.getItem(key); if (existing !== null && existing.length > 0) return existing; const created = crypto.randomUUID(); localStorage.setItem(key, created); return created; } catch { return `memory-${ownerId}`; } }
function difficultyLabel(value: ApiExercise["difficulty"]): string { return value === "beginner" ? "Principiante" : value === "advanced" ? "Avanzado" : "Intermedio"; }
function toAuthMessage(error: unknown): string { if (error !== null && typeof error === "object" && "message" in error) { const message = (error as WebAuthError).message; if (typeof message === "string" && message.length > 0) return message; } return "No se pudo completar la operación de autenticación."; }
function toApiMessage(error: unknown): string { if (error !== null && typeof error === "object" && "message" in error) { const message = (error as { message?: unknown }).message; if (typeof message === "string" && message.length > 0) return message; } return "No se pudo completar la solicitud online."; }
function toErrorMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message.length > 0 ? error.message : fallback; }
