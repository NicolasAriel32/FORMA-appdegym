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
import { drainOutbox, pullSyncChanges } from "./workout/outbox-sync-service.js";
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
type RoutineAccent = "violet" | "blue" | "green" | "orange";
type RoutineSummary = {
  api: ApiRoutine | null;
  name: string;
  detail: string;
  accent: RoutineAccent;
  progress: number;
  muscleGroup: string;
  note: string;
};
type WorkoutSetInput = { loadKg: number; repetitions: number };
type WorkoutExercise = { id: string; name: string; muscle: string; color: string };

const tabs: Array<{ id: AppTab; label: string; icon: IconName }> = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "routines", label: "Rutinas", icon: "routines" },
  { id: "train", label: "Entrenar", icon: "train" },
  { id: "progress", label: "Progreso", icon: "progress" },
  { id: "exercises", label: "Ejercicios", icon: "exercises" },
];

const demoRoutines: Array<Omit<RoutineSummary, "api">> = [
  { name: "Piernas · Fuerza", detail: "6 ejercicios · 52 min", accent: "violet", progress: 72, muscleGroup: "Piernas", note: "Tu próxima sesión" },
  { name: "Pecho y espalda", detail: "8 ejercicios · 61 min", accent: "blue", progress: 44, muscleGroup: "Torso", note: "Última vez hace 2 días" },
  { name: "Full body", detail: "7 ejercicios · 48 min", accent: "green", progress: 18, muscleGroup: "Cuerpo completo", note: "Disponible para empezar" },
];
const initialDemoSetValues: WorkoutSetInput[] = [
  { loadKg: 80, repetitions: 8 },
  { loadKg: 80, repetitions: 8 },
];

const demoExercises: ExerciseCard[] = [
  { id: "demo-squat", name: "Sentadilla con barra", muscle: "Cuádriceps · Glúteos", rank: "Intermedio", color: "violet", education: { movementPattern: "Dominante de rodilla y cadera", targetMuscles: ["Cuádriceps", "Glúteo mayor"], secondaryMuscles: ["Aductores", "Isquiosurales", "Erectores espinales"], instructions: "Colocá la barra estable sobre la espalda, tomá aire y braceá el tronco. Descendé flexionando cadera y rodillas con el pie completo apoyado; alcanzá la profundidad que puedas controlar sin perder alineación. Empujá el suelo y extendé cadera y rodillas manteniendo la trayectoria de la barra sobre el mediopié.", commonMistakes: ["Colapsar las rodillas hacia adentro", "Despegar los talones", "Perder el control en el descenso", "Extender la zona lumbar al salir"], safetyNotes: ["Elegí una carga que permita repetir la técnica sin compensaciones", "Usá soportes y seguros correctamente regulados", "Si aparece dolor agudo, detené el ejercicio y consultá a un profesional de salud"], equipment: "Barra, rack y discos", difficulty: "Intermedio" } },
  { id: "demo-bench", name: "Press banca plano", muscle: "Pecho · Tríceps", rank: "Intermedio", color: "blue", education: { movementPattern: "Empuje horizontal", targetMuscles: ["Pectoral mayor"], secondaryMuscles: ["Tríceps", "Deltoides anterior"], instructions: "Acomodá ojos bajo la barra, escápulas retraídas y deprimidas, pies firmes. Bajá la barra hacia la zona media-baja del pecho con antebrazos aproximadamente verticales. Pausá sin rebotar y empujá manteniendo muñecas apiladas y hombros estables.", commonMistakes: ["Rebotar la barra en el pecho", "Abrir excesivamente los codos", "Levantar los glúteos del banco", "Entrenar sin seguros ni asistencia cuando corresponde"], safetyNotes: ["Usá un rack con seguros y una carga que puedas controlar", "Con cargas altas, entrená con asistencia competente", "El agarre no debe forzar la muñeca a una extensión extrema"], equipment: "Banco, barra y discos", difficulty: "Intermedio" } },
  { id: "demo-row", name: "Remo con barra", muscle: "Espalda · Bíceps", rank: "Principiante", color: "green", education: { movementPattern: "Tracción horizontal", targetMuscles: ["Dorsal ancho", "Romboides", "Trapecio medio"], secondaryMuscles: ["Bíceps", "Deltoides posterior", "Erectores espinales"], instructions: "Desde una bisagra de cadera, mantené la columna neutra y la barra cerca de las piernas. Tirala hacia el abdomen llevando los codos atrás, sin encoger los hombros. Bajá con control y repetí conservando el ángulo del tronco.", commonMistakes: ["Redondear la espalda para ganar recorrido", "Convertir el movimiento en un tirón de bíceps", "Usar impulso excesivo", "Elevar los hombros hacia las orejas"], safetyNotes: ["Aprendé la bisagra con una carga liviana antes de progresar", "No persigas amplitud si perdés la posición lumbar", "Detené la serie ante dolor agudo o irradiado"], equipment: "Barra y discos", difficulty: "Principiante" } },
  { id: "demo-rdl", name: "Peso muerto rumano", muscle: "Isquios · Glúteos", rank: "Intermedio", color: "orange", education: { movementPattern: "Bisagra de cadera", targetMuscles: ["Isquiosurales", "Glúteo mayor"], secondaryMuscles: ["Erectores espinales", "Aductores", "Antebrazos"], instructions: "Partí de pie con la carga cerca del cuerpo. Flexioná levemente las rodillas y llevá la cadera atrás mientras la barra desciende rozando los muslos. Bajá hasta sentir tensión controlable en los isquiosurales, luego acercá la cadera a la barra y extendé sin hiperextender la espalda.", commonMistakes: ["Convertirlo en una sentadilla", "Alejar la carga del cuerpo", "Buscar profundidad redondeando la espalda", "Bloquear las rodillas o hiperextender al finalizar"], safetyNotes: ["La profundidad depende de movilidad y control, no de tocar el suelo", "Progresá con incrementos pequeños y técnica repetible", "Consultá a un profesional si tenés lesión o dolor persistente"], equipment: "Barra y discos", difficulty: "Intermedio" } },
];
const demoWorkoutExercises: WorkoutExercise[] = [
  { id: "demo-squat", name: "Sentadilla con barra", muscle: "Cuádriceps · Glúteos", color: "violet" },
  { id: "demo-rdl", name: "Peso muerto rumano", muscle: "Isquiosurales · Glúteos", color: "orange" },
  { id: "demo-bench", name: "Press banca plano", muscle: "Pectoral · Tríceps", color: "blue" },
  { id: "demo-row", name: "Remo con barra", muscle: "Espalda · Bíceps", color: "green" },
];

export default function App(): ReactElement {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [demoSessionStarted, setDemoSessionStarted] = useState(false);
  const [demoCompletedSets, setDemoCompletedSets] = useState(2);
  const [demoSetValues, setDemoSetValues] = useState<WorkoutSetInput[]>(initialDemoSetValues);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>(demoWorkoutExercises);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutName, setWorkoutName] = useState(demoRoutines[0]!.name);
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
  const [localSessions, setLocalSessions] = useState<WorkoutSession[] | null>(null);
  const [catalogExercises, setCatalogExercises] = useState<ApiExercise[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [routines, setRoutines] = useState<ApiRoutine[] | null>(null);
  const [routinesLoading, setRoutinesLoading] = useState(false);
  const [routineMessage, setRoutineMessage] = useState<string | null>(null);
  const [routineEditorOpen, setRoutineEditorOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<ApiRoutine | null>(null);
  const [routineSaving, setRoutineSaving] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineSummary | null>(null);

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
    if (serverUser === null) { setLocalDatabase(null); setLocalSessions(null); setActiveWorkout(null); return; }
    let active = true;
    void openLocalDatabase(indexedDB, `forma-${serverUser.id}`).then(async (database) => {
      const sessions = await listSessionsByOwner(database, serverUser.id);
      const current = sessions.find((candidate) => candidate.status === "in_progress" || candidate.status === "paused");
      if (!active) { database.close(); return; }
      setLocalDatabase(database); setLocalSessions(sessions); if (current !== undefined) setActiveWorkout(current);
    }).catch(() => { if (active) setWorkoutMessage("No se pudo abrir el almacenamiento local seguro."); });
    return () => { active = false; };
  }, [serverUser]);

  useEffect(() => {
    if (!online || session === null || serverUser === null || apiBaseUrl === undefined || localDatabase === null) return;
    let active = true;
    void drainOutbox({ database: localDatabase, apiBaseUrl, accessToken: session.access_token }).then(async (result) => {
      await pullSyncChanges({ database: localDatabase, scopeId: serverUser.id, apiBaseUrl, accessToken: session.access_token });
      await refreshLocalSessions();
      if (active && result.confirmed > 0) setWorkoutMessage(`${result.confirmed} operación${result.confirmed === 1 ? "" : "es"} sincronizada${result.confirmed === 1 ? "" : "s"} con el servidor.`);
    }).catch(() => {
      if (active) setWorkoutMessage("La sincronización quedará pendiente y se reintentará al recuperar conexión.");
    });
    return () => { active = false; };
  }, [apiBaseUrl, localDatabase, online, serverUser, session]);

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

  async function drainPendingOutbox(): Promise<void> {
    if (!online || session === null || serverUser === null || apiBaseUrl === undefined || localDatabase === null) return;
    try {
      const result = await drainOutbox({ database: localDatabase, apiBaseUrl, accessToken: session.access_token });
      await pullSyncChanges({ database: localDatabase, scopeId: serverUser.id, apiBaseUrl, accessToken: session.access_token });
      await refreshLocalSessions();
      if (result.confirmed > 0) setWorkoutMessage(`${result.confirmed} operación${result.confirmed === 1 ? "" : "es"} sincronizada${result.confirmed === 1 ? "" : "s"} con el servidor.`);
    } catch {
      setWorkoutMessage("La sincronización quedará pendiente y se reintentará al recuperar conexión.");
    }
  }

  async function refreshLocalSessions(): Promise<void> {
    if (localDatabase === null || serverUser === null) return;
    setLocalSessions(await listSessionsByOwner(localDatabase, serverUser.id));
  }

  async function startWorkout(routine: RoutineSummary | null = null): Promise<void> {
    setActiveTab("train"); setWorkoutMessage(null);
    const plannedExercises = buildWorkoutExercises(routine, catalogExercises);
    if (routine?.api !== null && routine?.api !== undefined && plannedExercises.length === 0) {
      setWorkoutMessage("No se pudo cargar la estructura oficial de esta rutina.");
      return;
    }
    if (realWorkoutEnabled && (catalogExercises === null || plannedExercises.length === 0)) {
      setWorkoutMessage("Esperá a que cargue el catálogo oficial para iniciar esta sesión.");
      return;
    }
    setWorkoutExercises(plannedExercises.length > 0 ? plannedExercises : demoWorkoutExercises);
    setCurrentExerciseIndex(0);
    setWorkoutName(routine?.name ?? demoRoutines[0]!.name);
    if (!realWorkoutEnabled || serverUser === null || localDatabase === null || clientInstanceId === null) { setDemoSessionStarted(true); return; }
    try {
      const timestamp = new Date().toISOString();
      const result = await startOfflineWorkoutSession({ database: localDatabase, ownerId: serverUser.id as UserId, sessionId: crypto.randomUUID() as SessionId, operationId: crypto.randomUUID(), clientInstanceId, createdAt: timestamp, startedAt: timestamp });
      setActiveWorkout(result.session); setWorkoutMessage("Sesión guardada localmente. Quedará pendiente de sincronización.");
      await refreshLocalSessions();
      void drainPendingOutbox();
    } catch (error) { setWorkoutMessage(toErrorMessage(error, "No se pudo iniciar la sesión local.")); }
  }

  async function completeSet(loadKg: number, repetitions: number): Promise<void> {
    if (!Number.isFinite(loadKg) || loadKg < 0 || !Number.isInteger(repetitions) || repetitions <= 0) {
      setWorkoutMessage("Ingresá una carga válida y una cantidad de repeticiones mayor a cero.");
      return;
    }
    if (!realWorkoutEnabled || serverUser === null || localDatabase === null || activeWorkout === null || clientInstanceId === null) {
      setDemoCompletedSets((value) => Math.min(value + 1, 8));
      setDemoSetValues((values) => values.length >= 8 ? values : [...values, { loadKg, repetitions }]);
      return;
    }
    const currentExercise = workoutExercises[currentExerciseIndex];
    const exercise = catalogExercises?.find((candidate) => candidate.id === currentExercise?.id && candidate.status === "published");
    if (exercise === undefined) { setWorkoutMessage("El catálogo oficial todavía no está disponible para registrar la serie."); return; }
    try {
      const timestamp = new Date().toISOString();
      const result = await appendOfflineWorkoutSet({ database: localDatabase, ownerId: serverUser.id as UserId, sessionId: activeWorkout.id, operationId: crypto.randomUUID(), clientInstanceId, setId: crypto.randomUUID() as SetId, exercise: { id: exercise.id as ExerciseId, status: "published" }, exerciseId: exercise.id as ExerciseId, repetitions, loadKg, createdAt: timestamp });
      setActiveWorkout(result.session); setWorkoutMessage("Serie guardada en el dispositivo.");
      await refreshLocalSessions();
      void drainPendingOutbox();
    } catch (error) { setWorkoutMessage(toErrorMessage(error, "No se pudo guardar la serie.")); }
  }

  async function finishWorkout(): Promise<void> {
    if (!realWorkoutEnabled || serverUser === null || localDatabase === null || activeWorkout === null || clientInstanceId === null) { setDemoSessionStarted(false); setDemoCompletedSets(0); setDemoSetValues([]); setWorkoutMessage("La sesión demo se reinició. Para guardar entrenamientos reales, iniciá sesión y conectá el API."); return; }
    try {
      const result = await finishOfflineWorkoutSession({ database: localDatabase, ownerId: serverUser.id as UserId, sessionId: activeWorkout.id, operationId: crypto.randomUUID(), clientInstanceId, finishedAt: new Date().toISOString() });
      setActiveWorkout(null); setWorkoutMessage(`Sesión finalizada localmente con ${result.session.sets.length} series pendientes de sincronizar.`);
      await refreshLocalSessions();
      void drainPendingOutbox();
    } catch (error) { setWorkoutMessage(toErrorMessage(error, "No se pudo finalizar la sesión.")); }
  }

  function goToNextExercise(): void {
    setCurrentExerciseIndex((index) => Math.min(index + 1, Math.max(workoutExercises.length - 1, 0)));
    setWorkoutMessage(null);
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

  const openRoutine = (routine: RoutineSummary): void => setSelectedRoutine(routine);
  const selectedRoutineForEdit = selectedRoutine?.api;
  const currentWorkoutExercise = workoutExercises[currentExerciseIndex] ?? workoutExercises[0] ?? demoWorkoutExercises[0]!;
  const exerciseCompletedSets = activeWorkout === null ? currentExerciseIndex === 0 ? demoSetValues.length : 0 : activeWorkout.sets.filter((set) => set.exerciseId === currentWorkoutExercise.id).length;
  return <div className="app-shell"><div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" /><header className="topbar"><div className="brand-mark" aria-label="FORMA"><span className="brand-symbol">F</span><span>FORMA</span></div><div className="topbar-actions"><span className={`sync-pill ${online ? "is-online" : "is-offline"}`}><span className="sync-dot" aria-hidden="true" />{online ? "Online" : "Offline"}</span><button className="profile-button" type="button" aria-label="Abrir perfil" onClick={() => setProfileOpen(true)}>{session?.user.email?.slice(0, 1).toUpperCase() ?? "N"}</button></div></header><main className="app-content">{activeTab === "home" ? <HomeView onStart={() => void startWorkout({ api: null, ...demoRoutines[0]! })} onCreate={() => openRoutineEditor()} onOpenRoutine={openRoutine} /> : null}{activeTab === "routines" ? <RoutinesView routines={routines} loading={routinesLoading} message={routineMessage} catalogExercises={catalogExercises ?? []} onCreate={() => openRoutineEditor()} onEdit={openRoutineEditor} onOpenRoutine={openRoutine} /> : null}{activeTab === "train" ? <TrainView started={demoSessionStarted || activeWorkout !== null} activeSession={activeWorkout} workoutName={workoutName} currentExercise={currentWorkoutExercise} nextExercise={workoutExercises[currentExerciseIndex + 1] ?? null} currentExerciseIndex={currentExerciseIndex} totalExercises={workoutExercises.length} exerciseCompletedSets={exerciseCompletedSets} demoSetValues={demoSetValues} completedSets={activeWorkout?.sets.length ?? demoCompletedSets} message={workoutMessage} onStart={() => void startWorkout()} onCompleteSet={(loadKg, repetitions) => void completeSet(loadKg, repetitions)} onNextExercise={goToNextExercise} onFinish={() => void finishWorkout()} /> : null}{activeTab === "progress" ? <ProgressView sessions={localSessions} /> : null}{activeTab === "exercises" ? <ExercisesView query={exerciseQuery} onQueryChange={setExerciseQuery} exercises={filteredExercises} loading={catalogLoading} message={catalogMessage} source={catalogExercises === null ? "demo" : "api"} /> : null}</main><nav className="bottom-nav" aria-label="Navegación principal">{tabs.map((tab) => <button className={`nav-item ${activeTab === tab.id ? "is-active" : ""} ${tab.id === "train" ? "train-nav-item" : ""}`} type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}><span className={tab.id === "train" ? "train-nav-icon" : "nav-icon"}><Icon name={tab.icon} size={tab.id === "train" ? 21 : 19} /></span><span>{tab.label}</span></button>)}</nav>{profileOpen ? <ProfileDrawer session={session} serverUser={serverUser} authLoading={authLoading} authBusy={authBusy} authMessage={authMessage} serverIdentityLoading={serverIdentityLoading} serverIdentityMessage={serverIdentityMessage} email={email} password={password} supabaseConfigured={supabase !== null} onClose={() => setProfileOpen(false)} onSubmit={(event) => void handleSubmit(event)} onEmailChange={setEmail} onPasswordChange={setPassword} onSignOut={() => void handleSignOut()} /> : null}{selectedRoutine ? <RoutineDetail routine={selectedRoutine} catalogExercises={catalogExercises ?? []} onClose={() => setSelectedRoutine(null)} onStart={() => { setSelectedRoutine(null); void startWorkout(selectedRoutine); }} onEdit={selectedRoutineForEdit === undefined || selectedRoutineForEdit === null ? undefined : () => { setSelectedRoutine(null); openRoutineEditor(selectedRoutineForEdit); }} /> : null}{routineEditorOpen ? <RoutineEditor routine={editingRoutine} exercises={catalogExercises ?? []} saving={routineSaving} online={online} onClose={() => setRoutineEditorOpen(false)} onSave={(name, description, exerciseIds) => void saveRoutine(name, description, exerciseIds)} /> : null}</div>;
}

function HomeView({ onStart, onCreate, onOpenRoutine }: { onStart: () => void; onCreate: () => void; onOpenRoutine: (routine: RoutineSummary) => void }): ReactElement {
  return <div className="screen-stack">
    <section className="welcome-block">
      <div><p className="eyebrow">MI ENTRENAMIENTO</p><h1>Entrená con intención.</h1><p className="screen-subtitle">Una sesión consistente vale más que una sesión perfecta.</p></div>
      <span className="home-status"><span className="status-check"><Icon name="check" size={12} /></span> Listo</span>
    </section>
    <section className="featured-workout">
      <div className="featured-glow" aria-hidden="true" />
      <div className="featured-copy"><span className="card-kicker">PRÓXIMO ENTRENAMIENTO</span><h2>Piernas <span>·</span> Fuerza</h2><p><Icon name="clock" size={15} /> 6 ejercicios <span className="bullet">•</span> 52 min</p><div className="featured-progress"><span><i style={{ width: "72%" }} /></span><small>72% de la semana completada</small></div><button className="primary-button" type="button" onClick={onStart}>Comenzar sesión <Icon name="arrow" size={17} /></button></div>
      <div className="muscle-orb" aria-label="Entrenamiento de piernas"><div className="orb-ring orb-ring-one" /><div className="orb-ring orb-ring-two" /><Icon name="train" size={33} /><span className="orb-caption">FOCUS<br /><b>LEGS</b></span></div>
    </section>
    <section className="quick-start-row"><div><span className="card-kicker">ÚLTIMA SESIÓN</span><strong>Torso · Hipertrofia</strong><small>Completada ayer · 48 min</small></div><button className="ghost-button" type="button" onClick={() => onOpenRoutine({ api: null, ...demoRoutines[1]! })}>Ver rutina <Icon name="chevron" size={15} /></button></section>
    <section><div className="section-heading"><div><p className="eyebrow">RESUMEN</p><h2>Tu semana</h2></div><button className="text-button" type="button">Ver todo <Icon name="chevron" size={15} /></button></div><div className="metric-grid"><MetricCard label="Sesiones" value="4" detail="+1 esta semana" accent="violet" /><MetricCard label="Volumen" value="12.480" detail="kg movidos" accent="blue" /><MetricCard label="Racha" value="12" detail="días seguidos" accent="orange" /></div></section>
    <section><div className="section-heading"><div><p className="eyebrow">TUS RUTINAS</p><h2>Seguí progresando</h2></div><button className="icon-button" type="button" aria-label="Agregar rutina" onClick={onCreate}><Icon name="plus" size={18} /></button></div><div className="routine-preview-list">{demoRoutines.slice(0, 2).map((routine) => <RoutinePreview key={routine.name} routine={routine} onOpen={() => onOpenRoutine({ api: null, ...routine })} />)}</div><small className="screen-footnote">Datos de demostración visual hasta conectar tu identidad y tu historial.</small></section>
  </div>;
}

function RoutinesView({ routines, loading, message, catalogExercises, onCreate, onEdit, onOpenRoutine }: { routines: ApiRoutine[] | null; loading: boolean; message: string | null; catalogExercises: ApiExercise[]; onCreate: () => void; onEdit: (routine: ApiRoutine) => void; onOpenRoutine: (routine: RoutineSummary) => void }): ReactElement {
  const real = routines !== null;
  const cards: RoutineSummary[] = real ? routines.map((api, index) => ({ api, name: api.name, detail: `${api.exercises.length} ejercicios · revisión ${api.revision}`, accent: (["violet", "blue", "green", "orange"] as RoutineAccent[])[index % 4] ?? "violet", progress: 0, muscleGroup: "Plan personal", note: "Estructura lista para entrenar" })) : demoRoutines.map((demo) => ({ api: null, ...demo }));
  return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">PLANIFICACIÓN</p><h1>Mis rutinas</h1><p className="screen-subtitle">Elegí una sesión, revisá el plan y entrená sin perder el foco.</p></div><button className="round-action" type="button" aria-label="Crear rutina" onClick={onCreate}><Icon name="plus" size={20} /></button></section><div className="segmented-control" role="tablist" aria-label="Tipos de rutina"><button className="is-selected" type="button">Mis rutinas</button><button type="button">Programas</button></div>{loading ? <p className="status-line">Cargando rutinas online…</p> : null}{message ? <p className="form-error" role="alert">{message}</p> : null}{!real ? <span className="demo-label section-demo-label">Datos demo · edición online disponible al iniciar sesión</span> : null}<div className="routine-card-list">{cards.map((card, index) => <div className={`routine-card-wrap routine-card-${card.accent}`} key={card.api?.id ?? card.name}><button className="routine-card" type="button" onClick={() => onOpenRoutine(card)}><span className="routine-card-top"><span>{index === 0 ? "HOY" : "PLANTILLA"}</span><Icon name="chevron" size={17} /></span><span className="routine-card-art"><span>{card.muscleGroup}</span><Icon name="train" size={25} /></span><span className="routine-card-title">{card.name}</span><span className="routine-card-detail">{card.detail}</span><span className="routine-progress"><span style={{ width: `${card.progress}%` }} /></span><span className="routine-card-footer"><span>{card.progress > 0 ? `${card.progress}% completado` : "Lista para entrenar"}</span><span>{card.note}</span></span></button>{card.api !== null ? <button className="routine-edit-button" type="button" onClick={() => { if (card.api !== null) onEdit(card.api); }}>Editar estructura</button> : null}</div>)}</div>{real && routines.length === 0 ? <div className="empty-workout-card compact-empty"><p className="eyebrow">SIN RUTINAS</p><h2>Creá tu primera rutina.</h2><p>La estructura se edita online y queda protegida por tu identidad.</p><button className="primary-button" type="button" onClick={onCreate}>Crear rutina <Icon name="plus" size={17} /></button></div> : null}<small className="screen-footnote">{real ? `${catalogExercises.length} ejercicios oficiales disponibles para editar.` : "La demo usa datos de ejemplo; los entrenamientos reales se guardan localmente."}</small></div>;
}

function TrainView({ started, activeSession, workoutName, currentExercise, nextExercise, currentExerciseIndex, totalExercises, exerciseCompletedSets, demoSetValues, completedSets, message, onStart, onCompleteSet, onNextExercise, onFinish }: { started: boolean; activeSession: WorkoutSession | null; workoutName: string; currentExercise: WorkoutExercise; nextExercise: WorkoutExercise | null; currentExerciseIndex: number; totalExercises: number; exerciseCompletedSets: number; demoSetValues: WorkoutSetInput[]; completedSets: number; message: string | null; onStart: () => void; onCompleteSet: (loadKg: number, repetitions: number) => void; onNextExercise: () => void; onFinish: () => void }): ReactElement {
  const [restSeconds, setRestSeconds] = useState(90);
  const [restRunning, setRestRunning] = useState(false);
  const [loadInput, setLoadInput] = useState("80");
  const [repetitionsInput, setRepetitionsInput] = useState("8");
  const [inputError, setInputError] = useState<string | null>(null);
  useEffect(() => {
    if (!restRunning || restSeconds <= 0) {
      if (restSeconds === 0) setRestRunning(false);
      return undefined;
    }
    const timer = window.setInterval(() => setRestSeconds((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [restRunning, restSeconds]);
  const actual = activeSession !== null;
  function saveCurrentSet(): void {
    const loadKg = Number(loadInput);
    const repetitions = Number(repetitionsInput);
    if (!Number.isFinite(loadKg) || loadKg < 0 || !Number.isInteger(repetitions) || repetitions <= 0) {
      setInputError("Usá una carga válida y reps enteras mayores a cero.");
      return;
    }
    setInputError(null);
    onCompleteSet(loadKg, repetitions);
    setRestSeconds(90);
    setRestRunning(true);
  }
  if (!started) return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">MODO ENTRENAMIENTO</p><h1>Entrenar</h1><p className="screen-subtitle">Tu sesión queda guardada localmente mientras entrenás.</p></div><span className="offline-badge"><Icon name="bolt" size={14} /> Offline ready</span></section>{message ? <p className="status-line">{message}</p> : null}<section className="empty-workout-card"><div className="empty-icon"><Icon name="train" size={28} /></div><p className="eyebrow">LISTO PARA EMPEZAR</p><h2>Tu próxima sesión está acá.</h2><p>Iniciá una rutina y registrá cada serie sin depender de la conexión.</p><button className="primary-button" type="button" onClick={onStart}>Comenzar Piernas <Icon name="arrow" size={17} /></button></section><section className="training-principles"><span><Icon name="bolt" size={16} /><b>Offline first</b><small>Guardado inmediato</small></span><span><Icon name="clock" size={16} /><b>Descanso</b><small>Controlá tu ritmo</small></span><span><Icon name="check" size={16} /><b>Progreso</b><small>Serie por serie</small></span></section></div>;
  const formattedRest = `${String(Math.floor(restSeconds / 60)).padStart(2, "0")}:${String(restSeconds % 60).padStart(2, "0")}`;
  return <div className="screen-stack workout-screen"><section className="active-workout-header"><div><span className="live-label"><span className="live-dot" /> SESIÓN ACTIVA</span><h1>{workoutName.split(" · ")[0]} <span>{workoutName.includes(" · ") ? `· ${workoutName.split(" · ").slice(1).join(" · ")}` : ""}</span></h1><p className="screen-subtitle">{actual ? "Guardado local" : "32 min"} <span className="bullet">•</span> {completedSets}/8 series</p></div><button className="round-action" type="button" aria-label="Más opciones">•••</button></section>{message ? <p className="status-line">{message}</p> : null}<div className="workout-progress"><span style={{ width: `${Math.min((completedSets / 8) * 100, 100)}%` }} /></div><section className="exercise-log-card"><div className={`exercise-visual exercise-visual-${currentExercise.color}`}><div className="exercise-visual-orbit" aria-hidden="true" /><span className="exercise-visual-kicker">EJERCICIO {String(currentExerciseIndex + 1).padStart(2, "0")} / {String(totalExercises).padStart(2, "0")}</span><Icon name="train" size={36} /><span className="exercise-visual-muscle">{currentExercise.muscle}</span></div><div className="exercise-log-heading"><div><span className="exercise-index">{String(currentExerciseIndex + 1).padStart(2, "0")}</span><div><h2>{currentExercise.name}</h2><p>{actual ? "Catálogo oficial" : currentExercise.muscle}</p></div></div><span className="exercise-status"><Icon name="check" size={14} /> {Math.min(exerciseCompletedSets, 3)}/3</span></div><div className="last-performance"><span>ÚLTIMA VEZ</span><strong>76 kg × 8</strong><small>Objetivo de hoy · 80 kg × 8</small></div><div className="set-entry"><label>Carga (kg)<input inputMode="decimal" min="0" step="0.5" type="number" value={loadInput} onChange={(event) => { setLoadInput(event.target.value); setInputError(null); }} /></label><label>Repeticiones<input inputMode="numeric" min="1" step="1" type="number" value={repetitionsInput} onChange={(event) => { setRepetitionsInput(event.target.value); setInputError(null); }} /></label><button className="primary-button set-save-button" type="button" onClick={saveCurrentSet}><Icon name="check" size={16} /> Guardar serie</button></div>{inputError ? <p className="form-error" role="alert">{inputError}</p> : null}<div className="set-header"><span>Serie</span><span>Kg</span><span>Reps</span><span /></div>{[1, 2, 3].map((set) => { const completedSet = actual ? activeSession.sets.filter((item) => item.exerciseId === currentExercise.id)[set - 1] ?? null : currentExerciseIndex === 0 ? demoSetValues[set - 1] ?? null : null; const load = completedSet?.loadKg ?? null; const reps = completedSet?.repetitions ?? null; return <div className={`set-row ${completedSet ? "is-complete" : ""}`} key={set}><span className="set-number">{set}</span><span>{load ?? "—"}</span><span>{reps ?? "—"}</span><button className="set-check" type="button" onClick={saveCurrentSet} aria-label={`Completar serie ${set}`}><Icon name="check" size={15} /></button></div>; })}<button className="add-set-button" type="button" onClick={saveCurrentSet}><Icon name="plus" size={15} /> Agregar serie</button><button className="secondary-button finish-button" type="button" onClick={onFinish}>Finalizar sesión</button></section><section className={`rest-card ${restRunning ? "is-running" : ""}`}><div><span className="card-kicker">DESCANSO</span><strong>{formattedRest}</strong><small>{restRunning ? "Recuperando para la próxima serie" : "Listo cuando termines la serie"}</small></div><button className="rest-toggle" type="button" onClick={() => { if (restSeconds === 0) setRestSeconds(90); setRestRunning((value) => !value); }}>{restRunning ? "Pausar" : "Iniciar"}</button></section>{currentExerciseIndex < totalExercises - 1 && nextExercise !== null ? <button className="next-exercise-card" type="button" onClick={onNextExercise}><span className="card-kicker">SIGUIENTE EJERCICIO</span><div><h2>{nextExercise.name}</h2><p>{nextExercise.muscle} · avanzar cuando termines tus series</p></div><Icon name="chevron" size={18} /></button> : <section className="next-exercise-card is-complete"><span className="card-kicker">PLAN COMPLETO</span><div><h2>Último ejercicio de la sesión</h2><p>Revisá tus series y finalizá cuando estés listo.</p></div><Icon name="check" size={18} /></section>}</div>;
}

function RoutineDetail({ routine, catalogExercises, onClose, onStart, onEdit }: { routine: RoutineSummary; catalogExercises: ApiExercise[]; onClose: () => void; onStart: () => void; onEdit: (() => void) | undefined }): ReactElement {
  const activeExercises = routine.api?.exercises.filter((item) => item.status === "active").sort((a, b) => a.position - b.position) ?? [];
  const names = activeExercises.length > 0 ? activeExercises.map((item) => catalogExercises.find((exercise) => exercise.id === item.exerciseId)?.name ?? "Ejercicio oficial") : ["Sentadilla con barra", "Prensa inclinada", "Peso muerto rumano", "Extensión de piernas"];
  return <div className="drawer-layer" role="presentation" onClick={onClose}><section className={`routine-detail routine-detail-${routine.accent}`} role="dialog" aria-modal="true" aria-labelledby="routine-detail-title" onClick={(event) => event.stopPropagation()}><div className="routine-detail-hero"><button className="close-button routine-detail-close" type="button" onClick={onClose} aria-label="Cerrar detalle">×</button><div className="routine-detail-art"><Icon name="train" size={39} /><span>{routine.muscleGroup}</span></div><span className="card-kicker">{routine.note.toUpperCase()}</span><h2 id="routine-detail-title">{routine.name}</h2><p>{routine.detail}</p></div><div className="routine-detail-body"><div className="routine-detail-stats"><span><strong>{names.length}</strong><small>ejercicios</small></span><span><strong>52</strong><small>minutos</small></span><span><strong>{routine.progress || "—"}</strong><small>{routine.progress ? "% completado" : "progreso"}</small></span></div><div className="section-heading compact"><div><p className="eyebrow">ESTRUCTURA</p><h3>Tu sesión</h3></div><span className="detail-session-note">{routine.progress > 0 ? "En progreso" : "Lista"}</span></div><div className="routine-exercise-list">{names.slice(0, 6).map((name, index) => <div className="routine-exercise-row" key={`${name}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{name}</strong><small>{index === 0 ? "Principal · 4 series" : "Accesorio · 3 series"}</small></div><Icon name="chevron" size={16} /></div>)}</div><div className="routine-detail-actions"><button className="primary-button full-button" type="button" onClick={onStart}>Comenzar sesión <Icon name="arrow" size={17} /></button>{onEdit ? <button className="secondary-button full-button" type="button" onClick={onEdit}>Editar estructura</button> : null}</div><p className="security-note">La estructura de la rutina se modifica online. El registro de cada serie se guarda localmente durante el entrenamiento.</p></div></section></div>;
}

function ExercisesView({ query, onQueryChange, exercises, loading, message, source }: { query: string; onQueryChange: (value: string) => void; exercises: ExerciseCard[]; loading: boolean; message: string | null; source: "demo" | "api" }): ReactElement { const [selected, setSelected] = useState<ExerciseCard | null>(null); return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">BIBLIOTECA OFICIAL</p><h1>Ejercicios</h1><p className="screen-subtitle">Técnica, objetivos y errores frecuentes en una sola ficha.</p></div><button className="round-action" type="button" aria-label="Agregar ejercicio"><Icon name="plus" size={20} /></button></section><div className="catalog-meta"><span className={source === "api" ? "live-label" : "demo-label"}>{source === "api" ? "Catálogo online" : "Datos demo"}</span>{loading ? <span className="muted">Actualizando…</span> : null}</div>{message ? <p className="form-error" role="alert">{message}</p> : null}<label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar ejercicio o músculo" /></label><div className="filter-row"><button className="filter-chip is-selected" type="button">Todos</button><button className="filter-chip" type="button">Pecho</button><button className="filter-chip" type="button">Espalda</button><button className="filter-chip" type="button">Piernas</button></div><div className="exercise-library-list">{exercises.map((exercise) => <button className="library-exercise" type="button" key={exercise.id} onClick={() => setSelected(exercise)}><span className={`exercise-avatar avatar-${exercise.color}`}><Icon name="train" size={20} /></span><span className="library-exercise-copy"><strong>{exercise.name}</strong><small>{exercise.muscle}</small></span><span className="exercise-rank">{exercise.rank}<Icon name="chevron" size={15} /></span></button>)}</div>{exercises.length === 0 ? <p className="empty-search">No encontramos ejercicios con esa búsqueda.</p> : null}{selected ? <ExerciseDetails exercise={selected} source={source} onClose={() => setSelected(null)} /> : null}</div>; }

function ExerciseDetails({ exercise, source, onClose }: { exercise: ExerciseCard; source: "demo" | "api"; onClose: () => void }): ReactElement { const info = exercise.education; return <div className="drawer-layer" role="presentation" onClick={onClose}><section className="exercise-details" role="dialog" aria-modal="true" aria-labelledby="exercise-detail-title" onClick={(event) => event.stopPropagation()}><div className={`exercise-detail-visual avatar-${exercise.color}`}><span className="exercise-detail-kicker">{source === "api" ? "CONTENIDO OFICIAL" : "FICHA DE REFERENCIA"}</span><Icon name="train" size={42} /><span>{info.movementPattern}</span></div><div className="drawer-header"><div><p className="eyebrow">{info.difficulty} · {info.equipment}</p><h2 id="exercise-detail-title">{exercise.name}</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar ficha">×</button></div><div className="detail-highlights"><span><b>{info.targetMuscles[0] ?? "Músculo principal"}</b><small>Foco principal</small></span><span><b>{info.equipment}</b><small>Equipamiento</small></span></div><DetailSection title="Ejecución técnica"><p>{info.instructions}</p></DetailSection><DetailSection title="Músculos principales"><div className="tag-list">{info.targetMuscles.map((item) => <span key={item}>{item}</span>)}</div></DetailSection><DetailSection title="Músculos secundarios"><div className="tag-list muted-tags">{info.secondaryMuscles.map((item) => <span key={item}>{item}</span>)}</div></DetailSection><DetailSection title="Errores frecuentes"><ul>{info.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul></DetailSection><DetailSection title="Cues de seguridad"><ul className="safety-list">{info.safetyNotes.map((item) => <li key={item}>{item}</li>)}</ul></DetailSection><p className="security-note">La ficha es educativa y no reemplaza una evaluación individual de un profesor de educación física o profesional de la salud.</p></section></div>; }
function DetailSection({ title, children }: { title: string; children: ReactNode }): ReactElement { return <section className="detail-section"><p className="eyebrow">{title}</p>{children}</section>; }

function RoutineEditor({ routine, exercises, saving, online, onClose, onSave }: { routine: ApiRoutine | null; exercises: ApiExercise[]; saving: boolean; online: boolean; onClose: () => void; onSave: (name: string, description: string, exerciseIds: string[]) => void }): ReactElement { const [name, setName] = useState(routine?.name ?? ""); const [description, setDescription] = useState(routine?.description ?? ""); const [selected, setSelected] = useState<string[]>(routine?.exercises.filter((item) => item.status === "active").sort((a, b) => a.position - b.position).map((item) => item.exerciseId) ?? []); const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); return <div className="drawer-layer" role="presentation" onClick={onClose}><section className="routine-editor" role="dialog" aria-modal="true" aria-labelledby="routine-editor-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">{routine === null ? "NUEVA RUTINA" : "EDICIÓN ONLINE"}</p><h2 id="routine-editor-title">{routine === null ? "Crear rutina" : "Editar rutina"}</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar editor">×</button></div><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ej. Piernas · Fuerza" /></label><label>Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Objetivo y notas de la rutina" /></label><div className="editor-section"><div className="section-heading compact"><div><p className="eyebrow">ESTRUCTURA</p><h3>Ejercicios oficiales</h3></div><span className="editor-count">{selected.length}</span></div>{exercises.length === 0 ? <p className="muted">Necesitás catálogo online para agregar ejercicios.</p> : <div className="exercise-picker">{exercises.map((exercise) => <label className={`exercise-picker-row ${selected.includes(exercise.id) ? "is-selected" : ""}`} key={exercise.id}><input type="checkbox" checked={selected.includes(exercise.id)} onChange={() => toggle(exercise.id)} /><span><strong>{exercise.name}</strong><small>{exercise.description || "Ejercicio oficial"}</small></span></label>)}</div>}</div><p className="security-note">La estructura se edita online. No se crea una rutina offline ni se envía una operación pendiente.</p><button className="primary-button full-button" type="button" disabled={saving || !online || name.trim().length === 0} onClick={() => onSave(name, description, selected)}>{saving ? "Guardando…" : routine === null ? "Crear rutina" : "Guardar cambios"} <Icon name="arrow" size={17} /></button>{!online ? <p className="form-error" role="alert">Conectate para guardar cambios estructurales.</p> : null}</section></div>; }

function ProfileDrawer({ session, serverUser, authLoading, authBusy, authMessage, serverIdentityLoading, serverIdentityMessage, email, password, supabaseConfigured, onClose, onSubmit, onEmailChange, onPasswordChange, onSignOut }: { session: Session | null; serverUser: ApiUser | null; authLoading: boolean; authBusy: boolean; authMessage: string | null; serverIdentityLoading: boolean; serverIdentityMessage: string | null; email: string; password: string; supabaseConfigured: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onSignOut: () => void }): ReactElement { return <div className="drawer-layer" role="presentation" onClick={onClose}><aside className="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">CUENTA</p><h2 id="profile-title">Tu perfil</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar perfil">×</button></div>{authLoading ? <p className="muted">Comprobando sesión…</p> : null}{!authLoading && session !== null ? <div className="profile-authenticated"><div className="profile-large-avatar">{session.user.email?.slice(0, 1).toUpperCase() ?? "N"}</div><h3>{session.user.email ?? "Atleta FORMA"}</h3><p className="muted">Sesión online activa</p>{serverIdentityLoading ? <p className="muted">Validando identidad interna…</p> : null}{serverUser !== null ? <p className="server-identity">Identidad FORMA validada · {serverUser.role}</p> : null}{serverIdentityMessage !== null ? <p className="form-error" role="alert">{serverIdentityMessage}</p> : null}<p className="security-note">La sesión offline todavía no conserva credenciales. Tus entrenamientos locales sí se guardan en el dispositivo.</p><button className="secondary-button" type="button" onClick={onSignOut} disabled={authBusy}><Icon name="logout" size={16} /> {authBusy ? "Cerrando…" : "Cerrar sesión"}</button></div> : null}{!authLoading && session === null ? <form className="drawer-auth-form" onSubmit={onSubmit}><div className="auth-intro"><div className="profile-large-avatar"><Icon name="profile" size={24} /></div><h3>Entrá a FORMA</h3><p className="muted">Sincronizá tu identidad cuando vuelvas a tener conexión.</p></div><label>Correo<input type="email" autoComplete="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required /></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} required /></label><button className="primary-button full-button" type="submit" disabled={authBusy || !supabaseConfigured}>{authBusy ? "Ingresando…" : "Iniciar sesión"}</button>{!supabaseConfigured ? <p className="security-note">Configurá las variables VITE_SUPABASE_* para habilitar este entorno.</p> : null}{authMessage !== null ? <p className="form-error" role="alert">{authMessage}</p> : null}</form> : null}<div className="drawer-footer"><span>FORMA · diseño inicial</span><span>v0.1</span></div></aside></div>; }

function RoutinePreview({ routine, onOpen }: { routine: (typeof demoRoutines)[number]; onOpen: () => void }): ReactElement { return <button className={`routine-preview routine-preview-${routine.accent}`} type="button" onClick={onOpen}><span className="routine-preview-icon"><Icon name="bolt" size={18} /></span><span><strong>{routine.name}</strong><small>{routine.detail}</small></span><Icon name="chevron" size={17} /></button>; }
function ProgressView({ sessions }: { sessions: WorkoutSession[] | null }): ReactElement {
  const demo = sessions === null;
  const finished = sessions?.filter((session) => session.status === "finished_local" || session.status === "finished_confirmed") ?? [];
  const recent = finished.filter((session) => session.finishedAt !== null && Date.now() - Date.parse(session.finishedAt) <= 30 * 24 * 60 * 60 * 1000);
  const volume = recent.reduce((total, session) => total + session.sets.reduce((sessionTotal, set) => sessionTotal + set.loadKg * set.repetitions, 0), 0);
  const bestSet = finished.flatMap((session) => session.sets).reduce<WorkoutSetInput | null>((best, set) => best === null || set.loadKg > best.loadKg ? { loadKg: set.loadKg, repetitions: set.repetitions } : best, null);
  const weeklyVolumes = buildWeeklyVolumes(finished);
  const maxWeeklyVolume = Math.max(...weeklyVolumes, 1);
  const formatKg = (value: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
  return <div className="screen-stack"><section className="screen-header-row"><div><p className="eyebrow">DATOS DE ENTRENAMIENTO</p><h1>Tu progreso</h1><p className="screen-subtitle">La constancia se ve cuando la medís.</p></div><div className={demo ? "demo-label" : "live-label"}>{demo ? "Datos demo" : "Calculado local"}</div></section><section className="progress-hero-card"><div><span className="card-kicker">VOLUMEN TOTAL · ÚLTIMOS 30 DÍAS</span><strong>{demo ? "48.620" : formatKg(volume)} <small>kg</small></strong><p className="positive-change">{demo ? "↗ 18,4% vs. período anterior" : `${recent.length} sesión${recent.length === 1 ? "" : "es"} finalizada${recent.length === 1 ? "" : "s"}`}</p></div><div className="chart-orb"><span>{demo ? "+18%" : `${finished.length} ses.`}</span></div></section><section className="chart-card"><div className="section-heading compact"><div><p className="eyebrow">EVOLUCIÓN</p><h2>Volumen semanal</h2></div><span className="chart-legend"><i /> kg</span></div><div className="bar-chart" aria-label="Gráfico de volumen semanal">{weeklyVolumes.map((weeklyVolume, index) => <span className={index === weeklyVolumes.length - 1 ? "is-current" : ""} style={{ height: demo ? `${[38, 52, 46, 70, 64, 88, 76][index]}%` : `${Math.max((weeklyVolume / maxWeeklyVolume) * 100, weeklyVolume > 0 ? 8 : 3)}%` }} key={index} />)}</div><div className="chart-labels"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div></section><div className="metric-grid progress-metrics"><MetricCard label="Mejor marca" value={demo ? "100 kg" : bestSet === null ? "—" : `${formatKg(bestSet.loadKg)} kg`} detail={demo ? "Sentadilla" : bestSet === null ? "Sin series todavía" : `${bestSet.repetitions} repeticiones`} accent="violet" /><MetricCard label="Sesiones" value={demo ? "16" : String(finished.length)} detail={demo ? "este mes" : "finalizadas"} accent="blue" /></div></div>;
}

function buildWeeklyVolumes(sessions: WorkoutSession[]): number[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const volumes = Array.from({ length: 7 }, () => 0);
  for (const session of sessions) {
    if (session.finishedAt === null) continue;
    const ageDays = Math.floor((now - Date.parse(session.finishedAt)) / day);
    const bucket = 6 - Math.floor(ageDays / 7);
    if (bucket < 0 || bucket >= volumes.length) continue;
    volumes[bucket] = (volumes[bucket] ?? 0) + session.sets.reduce((total, set) => total + set.loadKg * set.repetitions, 0);
  }
  return volumes;
}
function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }): ReactElement { return <article className={`metric-card metric-${accent}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function Icon({ name, size = 20 }: { name: IconName; size?: number }): ReactElement { const content: Record<IconName, ReactNode> = { home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v10h14V9" /><path d="M9 19v-6h6v6" /></>, routines: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>, train: <><path d="M6 5v14M18 5v14M3 8h6M15 8h6M3 16h6M15 16h6" /><path d="M9 12h6" /></>, progress: <><path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-7" /></>, exercises: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>, profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" /></>, arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>, bolt: <path d="m13 2-9 11h7l-1 9 9-12h-7l1-8Z" />, clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>, search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>, plus: <><path d="M12 5v14M5 12h14" /></>, check: <path d="m5 12 4 4L19 6" />, chevron: <path d="m9 5 7 7-7 7" />, logout: <><path d="M10 5H5v14h5" /><path d="m14 8 4 4-4 4M8 12h10" /></> }; return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content[name]}</svg>; }
function getClientInstanceId(ownerId: string): string { const key = `forma.client-instance.${ownerId}`; try { const existing = localStorage.getItem(key); if (existing !== null && existing.length > 0) return existing; const created = crypto.randomUUID(); localStorage.setItem(key, created); return created; } catch { return `memory-${ownerId}`; } }
function buildWorkoutExercises(routine: RoutineSummary | null, catalogExercises: ApiExercise[] | null): WorkoutExercise[] {
  if (routine?.api !== null && routine?.api !== undefined) {
    if (catalogExercises === null) return [];
    return routine.api.exercises
      .filter((item) => item.status === "active")
      .sort((left, right) => left.position - right.position)
      .flatMap((item, index) => {
        const exercise = catalogExercises.find((candidate) => candidate.id === item.exerciseId && candidate.status === "published");
        return exercise === undefined ? [] : [{ id: exercise.id, name: exercise.name, muscle: exercise.targetMuscles.join(" · ") || exercise.description || "Ejercicio oficial", color: ["violet", "blue", "green", "orange"][index % 4] ?? "violet" }];
      });
  }
  if (catalogExercises !== null) {
    return catalogExercises
      .filter((exercise) => exercise.status === "published")
      .slice(0, 4)
      .map((exercise, index) => ({ id: exercise.id, name: exercise.name, muscle: exercise.targetMuscles.join(" · ") || exercise.description || "Ejercicio oficial", color: ["violet", "blue", "green", "orange"][index % 4] ?? "violet" }));
  }
  return demoWorkoutExercises;
}
function difficultyLabel(value: ApiExercise["difficulty"]): string { return value === "beginner" ? "Principiante" : value === "advanced" ? "Avanzado" : "Intermedio"; }
function toAuthMessage(error: unknown): string { if (error !== null && typeof error === "object" && "message" in error) { const message = (error as WebAuthError).message; if (typeof message === "string" && message.length > 0) return message; } return "No se pudo completar la operación de autenticación."; }
function toApiMessage(error: unknown): string { if (error !== null && typeof error === "object" && "message" in error) { const message = (error as { message?: unknown }).message; if (typeof message === "string" && message.length > 0) return message; } return "No se pudo completar la solicitud online."; }
function toErrorMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message.length > 0 ? error.message : fallback; }
